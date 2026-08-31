import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Investigation, type InvestigationDocument } from "../investigations/schemas/investigation.schema";
import { AiEvidenceError, AiEvidenceService } from "./ai-evidence.service";
import { DossierService, DossierValidationError } from "./dossier.service";
import { TavilyLiteratureError, TavilyLiteratureService } from "./tavily-literature.service";
import { EvidenceClassifierService, EvidenceValidationError } from "./evidence-classifier.service";
import { MechanismService, MechanismValidationError } from "./mechanism.service";
import { PubChemResolutionError, PubChemService } from "./pubchem.service";
import { ResearchAssessmentService } from "./research-assessment.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class InvestigationRunnerService {
  private readonly logger = new Logger(InvestigationRunnerService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    @InjectModel(Investigation.name) private readonly investigations: Model<InvestigationDocument>,
    private readonly pubChem: PubChemService,
    private readonly literatureSearch: TavilyLiteratureService,
    private readonly aiEvidence: AiEvidenceService,
    private readonly evidenceClassifier: EvidenceClassifierService,
    private readonly mechanismService: MechanismService,
    private readonly researchAssessment: ResearchAssessmentService,
    private readonly dossierService: DossierService,
    private readonly notifications: NotificationsService,
  ) {}

  async run(investigationId: string) {
    if (this.inFlight.has(investigationId)) return;
    this.inFlight.add(investigationId);
    try {
      const investigation = await this.investigations.findById(investigationId).lean().exec();
      if (!investigation || investigation.status === "completed" || investigation.status === "failed") return;
      await this.wait(600);
      const resolving = await this.investigations
        .updateOne(
          { _id: investigationId, status: "queued" },
          {
            $set: {
              status: "resolving_molecule",
              "progress.message": "Resolving molecule identity",
              startedAt: new Date(),
            },
          },
        )
        .exec();
      if (!resolving.matchedCount) return;
      const molecule = await this.pubChem.resolve(investigation.originalInput);
      await this.investigations
        .updateOne(
          { _id: investigationId, status: "resolving_molecule" },
          { $set: { molecule, "progress.message": "Chemical information retrieved" } },
        )
        .exec();
      await this.wait(500);
      const searching = await this.investigations
        .updateOne(
          { _id: investigationId, status: "resolving_molecule" },
          {
            $set: { status: "searching_literature", "progress.message": "Searching scientific literature with Tavily" },
          },
        )
        .exec();
      if (!searching.matchedCount) return;
      const literature = await this.literatureSearch.search(molecule, investigation.originalInput);
      const ranked = await this.investigations
        .updateOne(
          { _id: investigationId, status: "searching_literature" },
          {
            $set: {
              status: "ranking_studies",
              "progress.message": `Ranking ${literature.discoveredCount} retrieved publications`,
              "progress.papersDiscovered": literature.discoveredCount,
            },
          },
        )
        .exec();
      if (!ranked.matchedCount) return;
      await this.investigations
        .updateOne(
          { _id: investigationId, status: "ranking_studies" },
          {
            $set: {
              papers: literature.papers,
              "progress.message": `${literature.papers.length} relevant studies selected`,
              "progress.papersSelected": literature.papers.length,
            },
          },
        )
        .exec();
      await this.wait(500);
      const extracting = await this.investigations
        .updateOne(
          { _id: investigationId, status: "ranking_studies" },
          {
            $set: {
              status: "extracting_evidence",
              "progress.message": "Extracting structured evidence from selected abstracts",
            },
          },
        )
        .exec();
      if (!extracting.matchedCount) return;
      const evidence = await this.aiEvidence.extract(literature.papers, molecule, async (partialEvidence) => {
        await this.investigations
          .updateOne(
            { _id: investigationId, status: "extracting_evidence" },
            {
              $set: {
                paperEvidence: partialEvidence,
                "progress.papersAnalyzed": partialEvidence.length,
                "progress.message": `${partialEvidence.length} studies analyzed`,
              },
            },
          )
          .exec();
      });
      const classified = await this.investigations
        .updateOne(
          { _id: investigationId, status: "extracting_evidence" },
          {
            $set: {
              status: "classifying_evidence",
              paperEvidence: evidence,
              "progress.papersAnalyzed": evidence.length,
              "progress.message": "Validating extracted evidence",
            },
          },
        )
        .exec();
      if (!classified.matchedCount) return;
      const validated = this.evidenceClassifier.classify(evidence, literature.papers);
      const analyzed = await this.investigations
        .updateOne(
          { _id: investigationId, status: "classifying_evidence" },
          {
            $set: {
              status: "analyzing_findings",
              evidence: validated.claims,
              analysis: validated.analysis,
              "progress.message": `Aggregated ${validated.analysis.activities.length} activities and ${validated.analysis.targets.length} targets`,
              "progress.experimentalFindings": validated.counts.experimentalFindings,
              "progress.computationalFindings": validated.counts.computationalFindings,
              "progress.targetsEvaluated": validated.counts.targetsEvaluated,
            },
          },
        )
        .exec();
      if (!analyzed.matchedCount) return;
      await this.wait(500);
      const mechanism = this.mechanismService.build(molecule, validated.claims, literature.papers, validated.analysis);
      const assessing = await this.investigations
        .updateOne(
          { _id: investigationId, status: "analyzing_findings" },
          {
            $set: {
              status: "building_assessment",
              mechanism,
              "progress.message": "Assessing evidence strength and consistency",
            },
          },
        )
        .exec();
      if (!assessing.matchedCount) return;
      const assessment = this.researchAssessment.assess(validated.claims, validated.analysis, mechanism, evidence);
      const dossierStage = await this.investigations
        .updateOne(
          { _id: investigationId, status: "building_assessment" },
          {
            $set: {
              status: "generating_dossier",
              assessment,
              "progress.message": "Preparing validated findings for the research dossier",
            },
          },
        )
        .exec();
      if (!dossierStage.matchedCount) return;
      const dossier = this.dossierService.build(
        molecule,
        literature.papers,
        validated.claims,
        validated.analysis,
        mechanism,
        assessment,
      );
      const dossierSaved = await this.investigations
        .updateOne(
          { _id: investigationId, status: "generating_dossier" },
          { $set: { dossier, "progress.message": "Research dossier complete" } },
        )
        .exec();
      if (!dossierSaved.matchedCount) return;
      await this.wait(800);
      const completed = await this.investigations
        .findOneAndUpdate(
          { _id: investigationId, status: "generating_dossier" },
          {
            $set: {
              status: "completed",
              "progress.message": "Investigation workflow complete",
              completedAt: new Date(),
            },
            $unset: { activeFreeSlot: 1 },
          },
          { returnDocument: "after" },
        )
        .lean()
        .exec();
      if (completed) await this.recordNotification(completed);
    } catch (error) {
      const known =
        error instanceof PubChemResolutionError ||
        error instanceof TavilyLiteratureError ||
        error instanceof AiEvidenceError ||
        error instanceof EvidenceValidationError ||
        error instanceof MechanismValidationError ||
        error instanceof DossierValidationError;
      if (!known)
        this.logger.error(
          `Investigation runner failed for ${investigationId}`,
          error instanceof Error ? error.stack : undefined,
        );
      else this.logger.warn(`Investigation ${investigationId} stopped with ${error.code}`);
      await this.investigations
        .updateOne(
          { _id: investigationId, status: { $nin: ["completed", "failed"] } },
          {
            $set: {
              status: "failed",
              "progress.message": known ? error.message : "Investigation failed",
              error: {
                code: known ? error.code : "RUNNER_FAILED",
                message: known ? error.message : "The investigation workflow could not be completed.",
              },
            },
            $unset: { activeFreeSlot: 1 },
          },
        )
        .exec()
        .catch(() => undefined);
    } finally {
      this.inFlight.delete(investigationId);
    }
  }

  private wait(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private async recordNotification(investigation: {
    _id: import("mongoose").Types.ObjectId;
    userId: import("mongoose").Types.ObjectId;
    originalInput: string;
    status: string;
    molecule?: Record<string, unknown>;
    error?: { code: string; message: string };
  }) {
    if (!this.notifications || !investigation?._id || !investigation.userId) return;
    try {
      await this.notifications.recordInvestigation(investigation);
    } catch (error) {
      this.logger.warn(
        `Investigation notification could not be recorded for ${investigation._id.toString()}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
}
