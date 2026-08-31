import type {
  BiologicalActivitySummary,
  EvidenceClaim,
  EvidenceConflict,
  EvidenceStrength,
  EvidenceType,
  InvestigationAnalysis,
  PaperEvidence,
  PaperSnapshot,
  SourceContextSummary,
  TargetRelationship,
  TargetSummary,
} from "@capela/shared";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

const COMPUTATIONAL_PATTERN =
  /\b(docking|molecular dynamics|\bqsar\b|network pharmacology|in[ -]?silico|computational (?:prediction|model|simulation)|target prediction)\b/i;
const EXPRESSION_INCREASE_PATTERN =
  /(?:\b(expression|mrna|protein level|abundance).{0,50}\b(increas|up-?regulat|elevat)|\b(increas|up-?regulat|elevat).{0,50}\b(expression|mrna|protein level|abundance))/i;
const EXPRESSION_DECREASE_PATTERN =
  /(?:\b(expression|mrna|protein level|abundance).{0,50}\b(decreas|down-?regulat|reduc)|\b(decreas|down-?regulat|reduc).{0,50}\b(expression|mrna|protein level|abundance))/i;
const PATHWAY_PATTERN = /\b(pathway|signaling|downstream|biomarker)/i;
const DIRECT_ASSAY_PATTERN =
  /\b(binding assay|surface plasmon resonance|isothermal titration calorimetry|microscale thermophoresis|radioligand|enzyme inhibition assay)\b/i;
const NULL_FINDING_PATTERN =
  /\b(no significant|not significant|did not|failed to|not observed|no evidence|without effect)\b/i;
const EXPERIMENTAL_TYPES = new Set<EvidenceType>(["direct_experimental", "indirect_experimental"]);

export type ValidatedEvidenceResult = {
  claims: EvidenceClaim[];
  analysis: InvestigationAnalysis;
  counts: { experimentalFindings: number; computationalFindings: number; targetsEvaluated: number };
};

export class EvidenceValidationError extends Error {
  constructor(
    readonly code: "INVALID_EVIDENCE_ATTRIBUTION",
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class EvidenceClassifierService {
  classify(extractions: PaperEvidence[], papers: PaperSnapshot[]): ValidatedEvidenceResult {
    this.validateAttribution(extractions, papers);
    const claims = extractions.flatMap((paper) => this.paperClaims(paper));
    const activityResult = this.aggregateActivities(claims.filter((claim) => claim.kind === "activity"));
    const targetResult = this.aggregateTargets(claims.filter((claim) => claim.kind === "target"));
    const analysis: InvestigationAnalysis = {
      activities: activityResult.summaries,
      targets: targetResult.summaries,
      sourceContexts: this.aggregateSourceContexts(claims.filter((claim) => claim.kind === "source_context")),
      conflicts: [...activityResult.conflicts, ...targetResult.conflicts],
      limitations: extractions
        .filter((paper) => paper.limitations.length)
        .map((paper) => ({
          paperId: paper.paperId,
          items: this.unique(paper.limitations.map((item) => item.trim()).filter(Boolean)),
        })),
    };
    return {
      claims,
      analysis,
      counts: {
        experimentalFindings: claims.filter((claim) => EXPERIMENTAL_TYPES.has(claim.evidenceType)).length,
        computationalFindings: claims.filter((claim) => claim.evidenceType === "computational_prediction").length,
        targetsEvaluated: analysis.targets.length,
      },
    };
  }

  private validateAttribution(extractions: PaperEvidence[], papers: PaperSnapshot[]) {
    const known = new Set(papers.map((paper) => paper.id));
    const seen = new Set<string>();
    for (const extraction of extractions) {
      if (!known.has(extraction.paperId) || seen.has(extraction.paperId))
        throw new EvidenceValidationError(
          "INVALID_EVIDENCE_ATTRIBUTION",
          "Extracted evidence does not map one-to-one to retrieved papers.",
        );
      seen.add(extraction.paperId);
    }
  }

  private paperClaims(paper: PaperEvidence): EvidenceClaim[] {
    const claims: EvidenceClaim[] = [];
    paper.sourceContexts.forEach((item, index) => {
      const source = item.source.trim();
      const finding = item.context.trim();
      if (!source || !finding) return;
      claims.push({
        id: this.evidenceId(paper.paperId, "source_context", index),
        paperId: paper.paperId,
        kind: "source_context",
        source,
        finding,
        evidenceType: "literature_reported",
        confidence: "medium",
        studyType: paper.studyType,
        analyzedSource: paper.analyzedSource,
      });
    });
    paper.activities.forEach((activity, index) => {
      const originalActivity = activity.activity.trim();
      const finding = activity.finding.trim();
      if (!originalActivity || !finding) return;
      const activityName = this.normalizeActivity(originalActivity);
      claims.push({
        id: this.evidenceId(paper.paperId, "activity", index),
        paperId: paper.paperId,
        kind: "activity",
        activity: activityName,
        originalActivity,
        finding,
        evidenceType: this.safeEvidenceType(
          activity.evidenceType,
          `${originalActivity} ${finding} ${activity.measuredOutcome ?? ""}`,
          paper.studyType,
        ),
        confidence: activity.confidence,
        studyType: paper.studyType,
        analyzedSource: paper.analyzedSource,
        model: activity.model?.trim() || undefined,
        measuredOutcome: activity.measuredOutcome?.trim() || undefined,
      });
    });
    paper.targets.forEach((target, index) => {
      const originalTarget = target.target.trim();
      const finding = target.finding.trim();
      if (!originalTarget || !finding) return;
      const safe = this.safeTarget(target, paper.studyType);
      claims.push({
        id: this.evidenceId(paper.paperId, "target", index),
        paperId: paper.paperId,
        kind: "target",
        target: this.normalizeTarget(originalTarget),
        originalTarget,
        finding,
        evidenceType: safe.evidenceType,
        confidence: target.confidence,
        studyType: paper.studyType,
        analyzedSource: paper.analyzedSource,
        relationship: safe.relationship,
        directExperimentalConfirmation: safe.directExperimentalConfirmation,
      });
    });
    paper.mechanisms.forEach((mechanism, index) => {
      const finding = mechanism.finding.trim();
      if (!finding) return;
      const context = `${finding} ${mechanism.pathway ?? ""} ${mechanism.molecularEvent ?? ""}`;
      claims.push({
        id: this.evidenceId(paper.paperId, "mechanism", index),
        paperId: paper.paperId,
        kind: "mechanism",
        finding,
        evidenceType: this.safeEvidenceType(mechanism.evidenceType, context, paper.studyType),
        confidence: mechanism.confidence,
        studyType: paper.studyType,
        analyzedSource: paper.analyzedSource,
        pathway: mechanism.pathway?.trim() || undefined,
        molecularEvent: mechanism.molecularEvent?.trim() || undefined,
        cellularEffect: mechanism.cellularEffect?.trim() || undefined,
        biologicalOutcome: mechanism.biologicalOutcome?.trim() || undefined,
      });
    });
    return claims;
  }

  private safeEvidenceType(type: EvidenceType, context: string, studyType: PaperEvidence["studyType"]): EvidenceType {
    if (studyType === "review") return "literature_reported";
    if (studyType === "computational" || COMPUTATIONAL_PATTERN.test(context)) return "computational_prediction";
    if (type === "capela_inference") return "insufficient";
    return type;
  }

  private safeTarget(
    target: PaperEvidence["targets"][number],
    studyType: PaperEvidence["studyType"],
  ): { relationship: TargetRelationship; directExperimentalConfirmation: boolean; evidenceType: EvidenceType } {
    const context = `${target.finding} ${target.relationship}`;
    let evidenceType = this.safeEvidenceType(target.evidenceType, context, studyType);
    if (
      studyType === "computational" ||
      COMPUTATIONAL_PATTERN.test(context) ||
      target.relationship === "predicted_binding" ||
      evidenceType === "computational_prediction"
    )
      return {
        relationship: "predicted_binding",
        directExperimentalConfirmation: false,
        evidenceType: "computational_prediction",
      };
    if (EXPRESSION_INCREASE_PATTERN.test(context))
      return {
        relationship: "expression_increase",
        directExperimentalConfirmation: false,
        evidenceType: evidenceType === "literature_reported" ? evidenceType : "indirect_experimental",
      };
    if (EXPRESSION_DECREASE_PATTERN.test(context))
      return {
        relationship: "expression_decrease",
        directExperimentalConfirmation: false,
        evidenceType: evidenceType === "literature_reported" ? evidenceType : "indirect_experimental",
      };
    if (
      PATHWAY_PATTERN.test(context) &&
      !DIRECT_ASSAY_PATTERN.test(context) &&
      ["direct_binding", "activation", "inhibition"].includes(target.relationship)
    )
      return {
        relationship: "pathway_association",
        directExperimentalConfirmation: false,
        evidenceType: evidenceType === "literature_reported" ? evidenceType : "indirect_experimental",
      };
    if (studyType === "review")
      return {
        relationship: target.relationship,
        directExperimentalConfirmation: false,
        evidenceType: "literature_reported",
      };
    if (target.relationship === "direct_binding" && !target.directExperimentalConfirmation) {
      evidenceType = evidenceType === "literature_reported" ? evidenceType : "indirect_experimental";
      return { relationship: "indirect_association", directExperimentalConfirmation: false, evidenceType };
    }
    if (target.relationship === "direct_binding" && evidenceType === "indirect_experimental")
      return { relationship: "indirect_association", directExperimentalConfirmation: false, evidenceType };
    if (target.relationship === "direct_binding" && evidenceType === "insufficient")
      return { relationship: "unknown", directExperimentalConfirmation: false, evidenceType };
    return {
      relationship: target.relationship,
      directExperimentalConfirmation: target.directExperimentalConfirmation && evidenceType === "direct_experimental",
      evidenceType,
    };
  }

  private aggregateActivities(claims: EvidenceClaim[]): {
    summaries: BiologicalActivitySummary[];
    conflicts: EvidenceConflict[];
  } {
    const groups = new Map<string, EvidenceClaim[]>();
    for (const claim of claims) groups.set(claim.activity!, [...(groups.get(claim.activity!) ?? []), claim]);
    const conflicts: EvidenceConflict[] = [];
    const summaries = [...groups.entries()].map(([name, group]) => {
      const paperIds = this.unique(group.map((claim) => claim.paperId));
      const experimentalCount = group.filter((claim) => EXPERIMENTAL_TYPES.has(claim.evidenceType)).length;
      const computationalCount = group.filter((claim) => claim.evidenceType === "computational_prediction").length;
      const nullClaims = group.filter((claim) => NULL_FINDING_PATTERN.test(claim.finding));
      const supportingClaims = group.filter(
        (claim) => claim.evidenceType !== "insufficient" && !NULL_FINDING_PATTERN.test(claim.finding),
      );
      const conflictMessages: string[] = [];
      if (
        new Set(nullClaims.map((claim) => claim.paperId)).size &&
        new Set(supportingClaims.map((claim) => claim.paperId)).size
      ) {
        const description = "Retrieved findings include both reported activity and null or non-significant results.";
        conflictMessages.push(description);
        conflicts.push({
          scope: "activity",
          label: name,
          description,
          evidenceIds: group.map((claim) => claim.id),
          paperIds: paperIds,
        });
      }
      return {
        name,
        originalNames: this.unique(group.map((claim) => claim.originalActivity!)),
        summary: `${group.length} extracted ${group.length === 1 ? "finding" : "findings"} across ${paperIds.length} ${paperIds.length === 1 ? "paper" : "papers"}; ${experimentalCount} experimental and ${computationalCount} computational.`,
        strength: this.strength(group),
        supportingEvidenceIds: group.map((claim) => claim.id),
        supportingPaperIds: paperIds,
        studyModels: this.unique(group.map((claim) => claim.model).filter((model): model is string => Boolean(model))),
        experimentalCount,
        computationalCount,
        conflicts: conflictMessages,
      } satisfies BiologicalActivitySummary;
    });
    return {
      summaries: summaries.sort(
        (left, right) =>
          this.strengthRank(right.strength) - this.strengthRank(left.strength) || left.name.localeCompare(right.name),
      ),
      conflicts,
    };
  }

  private aggregateTargets(claims: EvidenceClaim[]): { summaries: TargetSummary[]; conflicts: EvidenceConflict[] } {
    const groups = new Map<string, EvidenceClaim[]>();
    for (const claim of claims) groups.set(claim.target!, [...(groups.get(claim.target!) ?? []), claim]);
    const conflicts: EvidenceConflict[] = [];
    const summaries = [...groups.entries()].map(([normalizedTarget, group]) => {
      const target = group[0]?.originalTarget ?? normalizedTarget;
      const relationships = new Set(group.map((claim) => claim.relationship!));
      const opposing =
        (relationships.has("activation") && relationships.has("inhibition")) ||
        (relationships.has("expression_increase") && relationships.has("expression_decrease"));
      const conflictMessages: string[] = [];
      if (opposing) {
        const description = "Retrieved evidence reports opposing target relationships.";
        conflictMessages.push(description);
        conflicts.push({
          scope: "target",
          label: target,
          description,
          evidenceIds: group.map((claim) => claim.id),
          paperIds: this.unique(group.map((claim) => claim.paperId)),
        });
      }
      const relationship = opposing ? "unknown" : this.strongestRelationship([...relationships]);
      const paperIds = this.unique(group.map((claim) => claim.paperId));
      const directExperimentalConfirmation = group.some(
        (claim) => claim.directExperimentalConfirmation && claim.evidenceType === "direct_experimental",
      );
      return {
        target,
        normalizedTarget,
        originalNames: this.unique(group.map((claim) => claim.originalTarget!)),
        relationship,
        summary: `${group.length} extracted ${group.length === 1 ? "finding" : "findings"} across ${paperIds.length} ${paperIds.length === 1 ? "paper" : "papers"}.`,
        directExperimentalConfirmation,
        strength: this.strength(group),
        evidenceTypes: this.unique(group.map((claim) => claim.evidenceType)),
        evidenceIds: group.map((claim) => claim.id),
        paperIds,
        conflicts: conflictMessages,
      } satisfies TargetSummary;
    });
    return {
      summaries: summaries.sort(
        (left, right) =>
          this.strengthRank(right.strength) - this.strengthRank(left.strength) ||
          left.target.localeCompare(right.target),
      ),
      conflicts,
    };
  }

  private aggregateSourceContexts(claims: EvidenceClaim[]): SourceContextSummary[] {
    const groups = new Map<string, SourceContextSummary>();
    for (const claim of claims) {
      const source = claim.source!;
      const context = claim.finding;
      const key = this.normalizeLabel(source);
      const existing = groups.get(key) ?? { source, contexts: [], evidenceIds: [], paperIds: [] };
      existing.contexts = this.unique([...existing.contexts, context]);
      existing.evidenceIds = this.unique([...existing.evidenceIds, claim.id]);
      existing.paperIds = this.unique([...existing.paperIds, claim.paperId]);
      groups.set(key, existing);
    }
    return [...groups.values()].sort((left, right) => left.source.localeCompare(right.source));
  }

  private strength(claims: EvidenceClaim[]): EvidenceStrength {
    const directPapers = new Set(
      claims.filter((claim) => claim.evidenceType === "direct_experimental").map((claim) => claim.paperId),
    ).size;
    const indirectPapers = new Set(
      claims.filter((claim) => claim.evidenceType === "indirect_experimental").map((claim) => claim.paperId),
    ).size;
    if (directPapers >= 2) return "Strong";
    if (directPapers === 1 || indirectPapers >= 2) return "Moderate";
    if (claims.some((claim) => claim.evidenceType !== "insufficient")) return "Limited";
    return "Insufficient";
  }

  private strongestRelationship(relationships: TargetRelationship[]): TargetRelationship {
    const order: TargetRelationship[] = [
      "direct_binding",
      "inhibition",
      "activation",
      "expression_decrease",
      "expression_increase",
      "pathway_association",
      "predicted_binding",
      "indirect_association",
      "unknown",
    ];
    return order.find((relationship) => relationships.includes(relationship)) ?? "unknown";
  }

  private normalizeActivity(value: string) {
    const normalized = this.normalizeLabel(value).replace(/^anti\s+/, "anti-");
    const aliases: Record<string, string> = {
      "anti-oxidant": "antioxidant",
      "anti-microbial": "antimicrobial",
      "anti-bacterial": "antibacterial",
      "anti-fungal": "antifungal",
      "anti-cancer": "anticancer",
    };
    return aliases[normalized] ?? normalized;
  }

  private normalizeTarget(value: string) {
    return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  }
  private normalizeLabel(value: string) {
    return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  }
  private evidenceId(paperId: string, kind: EvidenceClaim["kind"], index: number) {
    return `ev_${createHash("sha256").update(`${paperId}:${kind}:${index}`).digest("hex").slice(0, 16)}`;
  }
  private unique<T>(values: T[]): T[] {
    return [...new Set(values)];
  }
  private strengthRank(value: EvidenceStrength) {
    return { Insufficient: 0, Limited: 1, Moderate: 2, Strong: 3 }[value];
  }
}
