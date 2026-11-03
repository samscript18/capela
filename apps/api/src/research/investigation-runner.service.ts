import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { randomUUID } from "node:crypto";
import {
  ACTIVE_INVESTIGATION_STATUSES,
  ResearchRunSchema,
  type ResearchRun,
  type InvestigationStatus,
  type MoleculeSnapshot,
} from "@capela/shared";
import { Investigation, type InvestigationDocument } from "../investigations/schemas/investigation.schema";
import { AiEvidenceService } from "./ai-evidence.service";
import { DossierService } from "./dossier.service";
import { TavilyLiteratureService } from "./tavily-literature.service";
import { EvidenceClassifierService } from "./evidence-classifier.service";
import { MechanismService } from "./mechanism.service";
import { PubChemService, PubChemResolutionError } from "./pubchem.service";
import { ResearchAssessmentService } from "./research-assessment.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OtariGatewayService } from "./otari-gateway.service";
import { OtariRetrievalService } from "./otari-retrieval.service";
import { OtariEvidenceService } from "./otari-evidence.service";
import { ResearchError } from "./provenance";

const LEASE_MS = 120000;
@Injectable()
export class InvestigationRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvestigationRunnerService.name);
  private sweep?: ReturnType<typeof setInterval>;
  constructor(
    @InjectModel(Investigation.name) private readonly investigations: Model<InvestigationDocument>,
    private readonly pubChem: PubChemService,
    private readonly literature: TavilyLiteratureService,
    private readonly ai: AiEvidenceService,
    private readonly classifier: EvidenceClassifierService,
    private readonly mechanismService: MechanismService,
    private readonly assessmentService: ResearchAssessmentService,
    private readonly dossiers: DossierService,
    private readonly notifications: NotificationsService,
    private readonly gateway: OtariGatewayService,
    private readonly retrieval: OtariRetrievalService,
    private readonly extraction: OtariEvidenceService,
    private readonly config: ConfigService,
  ) {}
  async onModuleInit() {
    await this.recover();
    this.sweep = setInterval(() => {
      void this.recover().catch(() => this.logger.warn("Recovery sweep unavailable"));
    }, 30000);
    this.sweep.unref();
  }
  onModuleDestroy() {
    if (this.sweep) clearInterval(this.sweep);
  }
  async recover() {
    // Interrupted paid calls are never replayed. Durable snapshots/reviews remain inspectable.
    await this.investigations
      .updateMany(
        {
          status: { $in: ACTIVE_INVESTIGATION_STATUSES.filter((s) => s !== "queued") },
          $or: [{ leaseExpiresAt: { $lt: new Date() } }, { leaseExpiresAt: { $exists: false } }],
        },
        {
          $set: {
            status: "failed",
            error: {
              code: "RUN_INTERRUPTED",
              message: "Worker interrupted. Stored work is partial; an in-flight provider call may have been charged.",
            },
            "progress.message": "Interrupted; saved checkpoints retained",
          },
          $unset: { leaseToken: 1, leaseExpiresAt: 1, activeFreeSlot: 1 },
        },
      )
      .exec();
    const queued = await this.investigations
      .find({ status: "queued", leaseToken: { $exists: false } })
      .select("_id")
      .limit(10)
      .lean()
      .exec();
    for (const q of queued)
      void this.run(q._id.toString()).catch(() => this.logger.warn("Queued run could not be claimed"));
  }
  async run(id: string) {
    const token = randomUUID();
    const item = await this.investigations
      .findOneAndUpdate(
        { _id: id, status: "queued", leaseToken: { $exists: false } },
        {
          $set: {
            leaseToken: token,
            leaseExpiresAt: new Date(Date.now() + LEASE_MS),
            status: "resolving_molecule",
            startedAt: new Date(),
          },
          $inc: { attempt: 1 },
        },
        { returnDocument: "after" },
      )
      .lean()
      .exec();
    if (!item) return;
    let lost = false;
    const filter = () => ({
      _id: id,
      leaseToken: token,
      leaseExpiresAt: { $gt: new Date() },
      status: { $in: ACTIVE_INVESTIGATION_STATUSES },
    });
    const heartbeat = setInterval(() => {
      void this.investigations
        .updateOne(filter(), { $set: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) } })
        .exec()
        .then((r) => {
          if (!r.matchedCount) lost = true;
        })
        .catch(() => {
          lost = true;
        });
    }, 15000);
    heartbeat.unref();
    let research: ResearchRun | undefined;
    const write = async (fields: Record<string, unknown>) => {
      if (lost) throw new ResearchError("LEASE_LOST", "Run ownership expired or was cancelled.");
      const r = await this.investigations.updateOne(filter(), { $set: fields }).exec();
      if (!r.matchedCount) {
        lost = true;
        throw new ResearchError("LEASE_LOST", "Run ownership expired or was cancelled.");
      }
    };
    const save = async () => {
      if (research) ResearchRunSchema.parse(research);
      const last = research?.events.at(-1);
      const messages: Record<string, string> = {
        extraction: "Extracting candidate claims from stored abstracts",
        review: "Reviewing source support and overstatement",
        sandbox_audit: "Auditing accepted evidence in the hosted sandbox",
        publication_metadata: "Retrieving canonical publication metadata via hosted MCP",
        scientific_search: "Searching scientific literature through Otari",
      };
      await write({
        research,
        ...(last?.status === "started" && messages[last.operation]
          ? { "progress.message": messages[last.operation] }
          : {}),
      });
    };
    const stage = async (status: InvestigationStatus, message: string, extra: Record<string, unknown> = {}) =>
      write({ status, "progress.message": message, ...extra });
    try {
      const legacy = this.config.get<string>("RESEARCH_PROVIDER") === "legacy";
      if (!legacy) {
        research = this.gateway.createRun(randomUUID());
        await save();
        this.gateway.assertConfigured();
        if (research.budget.capMicrousd <= 0)
          throw new ResearchError(
            "LIVE_BUDGET_NOT_CONFIGURED",
            "Otari spending is disabled. Configure a finite local run cap and hosted key ceiling.",
          );
      }
      const molecule: MoleculeSnapshot = await this.pubChem.resolve(item.originalInput);
      await stage(
        "searching_literature",
        legacy ? "Searching scientific literature (legacy)" : "Searching scientific literature through Otari",
        { molecule },
      );
      const literature = legacy
        ? await this.literature.search(molecule, item.originalInput)
        : await this.retrieval.search(molecule, research!, save);
      await stage("ranking_studies", `${literature.papers.length} canonical abstracts selected`, {
        papers: literature.papers,
        "progress.papersDiscovered": literature.discoveredCount,
        "progress.papersSelected": literature.papers.length,
      });
      await stage("extracting_evidence", "Extracting and reviewing source passages");
      const legacyEvidence = legacy ? await this.ai.extract(literature.papers, molecule) : [];
      const validated = legacy
        ? this.classifier.classify(legacyEvidence, literature.papers)
        : await this.extraction.extract(literature.papers, molecule, research!, save);
      await stage("classifying_evidence", "Passage and review validation complete", {
        evidence: validated.claims,
        paperEvidence: legacyEvidence,
        "progress.papersAnalyzed": literature.papers.length,
        analysis: validated.analysis,
        "progress.experimentalFindings": validated.counts.experimentalFindings,
        "progress.computationalFindings": validated.counts.computationalFindings,
        "progress.targetsEvaluated": validated.counts.targetsEvaluated,
      });
      await stage("analyzing_findings", "Building accepted-evidence mechanism");
      const mechanism = this.mechanismService.build(molecule, validated.claims, literature.papers, validated.analysis);
      await stage("building_assessment", "Assessing strength, conflicts and gaps", { mechanism });
      const assessment = this.assessmentService.assess(
        validated.claims,
        validated.analysis,
        mechanism,
        legacy ? legacyEvidence : literature.papers.map(() => ({ analyzedSource: "abstract" as const })),
      );
      // New extraction uses claim records rather than the legacy paper-extraction schema.
      if (!legacy) {
        assessment.basis.papersAnalyzed = literature.papers.length;
        assessment.basis.abstractOnlyPapers = literature.papers.length;
        assessment.majorEvidenceGaps.push(
          "Abstract-only, bounded retrieval. Evidence score is a heuristic, not an efficacy probability.",
        );
      }
      await stage("generating_dossier", "Assembling eight-section dossier", { assessment });
      const dossier = this.dossiers.build(
        molecule,
        literature.papers,
        validated.claims,
        validated.analysis,
        mechanism,
        assessment,
      );
      if (research) {
        research.checkpoint = "completed";
        await save();
      }
      const done = await this.investigations
        .findOneAndUpdate(
          filter(),
          {
            $set: {
              status: "completed",
              dossier,
              completedAt: new Date(),
              "progress.message": "Dossier complete; source limitations retained",
            },
            $unset: { activeFreeSlot: 1, leaseToken: 1, leaseExpiresAt: 1 },
          },
          { returnDocument: "after" },
        )
        .lean()
        .exec();
      if (done)
        await this.notifications
          .recordInvestigation(done)
          .catch(() => this.logger.warn("Completion notification unavailable"));
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error && typeof error.code === "string"
          ? error.code
          : "RESEARCH_FAILED";
      const safe = error instanceof ResearchError || error instanceof PubChemResolutionError;
      this.logger.warn(`Run stopped: ${code}`);
      await this.investigations
        .updateOne(filter(), {
          $set: {
            status: "failed",
            ...(research ? { research } : {}),
            error: {
              code,
              message: safe ? error.message : "Research could not be validated. Saved work remains partial.",
            },
            "progress.message": "Investigation stopped; saved work is partial",
          },
          $unset: { activeFreeSlot: 1, leaseToken: 1, leaseExpiresAt: 1 },
        })
        .exec()
        .catch(() => undefined);
    } finally {
      clearInterval(heartbeat);
    }
  }
}
