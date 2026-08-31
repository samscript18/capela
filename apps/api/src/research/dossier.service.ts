import {
  EVIDENCE_TYPES,
  type CapelaDossier,
  type EvidenceClaim,
  type EvidenceType,
  type InvestigationAnalysis,
  type MechanismResult,
  type MoleculeSnapshot,
  type PaperSnapshot,
  type ResearchAssessment,
} from "@capela/shared";
import { Injectable } from "@nestjs/common";

export class DossierValidationError extends Error {
  constructor(
    readonly code: "INVALID_DOSSIER_REFERENCE",
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class DossierService {
  build(
    molecule: MoleculeSnapshot,
    papers: PaperSnapshot[],
    evidence: EvidenceClaim[],
    analysis: InvestigationAnalysis,
    mechanism: MechanismResult,
    assessment: ResearchAssessment,
  ): CapelaDossier {
    const claimsByPaper = new Map<string, EvidenceClaim[]>();
    for (const claim of evidence)
      claimsByPaper.set(claim.paperId, [...(claimsByPaper.get(claim.paperId) ?? []), claim]);
    const activityEvidenceIds = this.unique(analysis.activities.flatMap((activity) => activity.supportingEvidenceIds));
    const activityPaperIds = this.unique(analysis.activities.flatMap((activity) => activity.supportingPaperIds));
    const targetEvidenceIds = this.unique(analysis.targets.flatMap((target) => target.evidenceIds));
    const targetPaperIds = this.unique(analysis.targets.flatMap((target) => target.paperIds));
    const sourceEvidenceIds = this.unique(analysis.sourceContexts.flatMap((source) => source.evidenceIds));
    const sourcePaperIds = this.unique(analysis.sourceContexts.flatMap((source) => source.paperIds));
    const literatureItems = papers.map((paper) => {
      const claims = claimsByPaper.get(paper.id) ?? [];
      return {
        ...paper,
        analyzedSource: paper.abstract ? ("abstract" as const) : ("not_analyzed" as const),
        evidenceIds: claims.map((claim) => claim.id),
        evidenceTypes: this.unique(claims.map((claim) => claim.evidenceType)),
        extractedFindings: this.unique(claims.map((claim) => claim.finding)),
      };
    });
    const distribution = Object.fromEntries(
      EVIDENCE_TYPES.map((type) => [type, evidence.filter((claim) => claim.evidenceType === type).length]),
    ) as Record<EvidenceType, number>;
    const allEvidenceIds = evidence.map((claim) => claim.id);
    const allPaperIds = this.unique(evidence.map((claim) => claim.paperId));
    const dossier: CapelaDossier = {
      generatedAt: new Date().toISOString(),
      overview: { molecule },
      sources: { items: analysis.sourceContexts, paperIds: sourcePaperIds, evidenceIds: sourceEvidenceIds },
      biologicalActivity: { items: analysis.activities, paperIds: activityPaperIds, evidenceIds: activityEvidenceIds },
      molecularTargets: { items: analysis.targets, paperIds: targetPaperIds, evidenceIds: targetEvidenceIds },
      mechanism,
      literature: { items: literatureItems, paperIds: papers.map((paper) => paper.id), evidenceIds: allEvidenceIds },
      evidenceVsPrediction: {
        distribution,
        examples: this.examples(evidence),
        paperIds: allPaperIds,
        evidenceIds: allEvidenceIds,
      },
      researchAssessment: { ...assessment, paperIds: allPaperIds, evidenceIds: allEvidenceIds },
    };
    this.validate(dossier, papers, evidence);
    return dossier;
  }

  validate(dossier: CapelaDossier, papers: PaperSnapshot[], evidence: EvidenceClaim[]) {
    const validPaperIds = new Set(papers.map((paper) => paper.id));
    const validEvidenceIds = new Set(evidence.map((claim) => claim.id));
    const references: { paperIds: string[]; evidenceIds: string[] }[] = [
      dossier.sources,
      dossier.biologicalActivity,
      dossier.molecularTargets,
      dossier.mechanism,
      dossier.literature,
      dossier.evidenceVsPrediction,
      dossier.researchAssessment,
      ...dossier.sources.items,
      ...dossier.biologicalActivity.items.map((item) => ({
        paperIds: item.supportingPaperIds,
        evidenceIds: item.supportingEvidenceIds,
      })),
      ...dossier.molecularTargets.items,
      ...dossier.mechanism.edges,
      ...dossier.literature.items.map((item) => ({ paperIds: [item.id], evidenceIds: item.evidenceIds })),
      ...dossier.researchAssessment.conflicts,
    ];
    const invalid = references.some(
      (reference) =>
        reference.paperIds.some((id) => !validPaperIds.has(id)) ||
        reference.evidenceIds.some((id) => !validEvidenceIds.has(id)),
    );
    const invalidExample = dossier.evidenceVsPrediction.examples.some(
      (claim) => !validEvidenceIds.has(claim.id) || !validPaperIds.has(claim.paperId),
    );
    if (invalid || invalidExample)
      throw new DossierValidationError(
        "INVALID_DOSSIER_REFERENCE",
        "The dossier contains a scientific claim that cannot be traced to stored evidence and literature.",
      );
  }

  private examples(evidence: EvidenceClaim[]) {
    const examples: EvidenceClaim[] = [];
    for (const type of EVIDENCE_TYPES)
      examples.push(...evidence.filter((claim) => claim.evidenceType === type).slice(0, 2));
    return examples;
  }

  private unique<T>(values: T[]) {
    return [...new Set(values)];
  }
}
