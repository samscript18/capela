import type {
  EvidenceClaim,
  EvidenceStrength,
  EvidenceType,
  InvestigationAnalysis,
  MechanismResult,
  PaperEvidence,
  ResearchAssessment,
} from "@capela/shared";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ResearchAssessmentService {
  assess(
    claims: EvidenceClaim[],
    analysis: InvestigationAnalysis,
    mechanism: MechanismResult,
    paperEvidence: PaperEvidence[],
  ): ResearchAssessment {
    const papersByType = (type: EvidenceType) =>
      new Set(claims.filter((claim) => claim.evidenceType === type).map((claim) => claim.paperId)).size;
    const directExperimentalPapers = papersByType("direct_experimental");
    const indirectExperimentalPapers = papersByType("indirect_experimental");
    const computationalPapers = papersByType("computational_prediction");
    const literatureReportedPapers = papersByType("literature_reported");
    const directlyConfirmedTargets = analysis.targets.filter((target) => target.directExperimentalConfirmation).length;
    const abstractOnlyPapers = paperEvidence.filter((paper) => paper.analyzedSource === "abstract").length;
    let score = claims.length ? 5 : 0;
    score += Math.min(45, directExperimentalPapers * 15);
    score += Math.min(21, indirectExperimentalPapers * 7);
    score += Math.min(8, computationalPapers * 2);
    score += Math.min(4, literatureReportedPapers);
    score += Math.min(20, directlyConfirmedTargets * 10);
    score +=
      mechanism.status === "supported"
        ? 15
        : mechanism.status === "partially_supported"
          ? 7
          : mechanism.status === "conflicting_evidence"
            ? -5
            : 0;
    score -= Math.min(20, analysis.conflicts.length * 10);
    if (paperEvidence.length > 0 && abstractOnlyPapers === paperEvidence.length) score -= 5;
    score = Math.max(0, Math.min(100, score));
    if (claims.some((claim) => claim.evidenceType !== "insufficient") && score < 15) score = 15;
    const overallStrength = this.scoreStrength(score);
    const biologicalActivityEvidence = this.strongest(analysis.activities.map((activity) => activity.strength));
    const targetEvidence = this.strongest(analysis.targets.map((target) => target.strength));
    const mechanisticEvidence = this.mechanismStrength(mechanism, claims);
    const consistency =
      claims.length === 0
        ? "insufficient"
        : analysis.conflicts.length >= 2
          ? "conflicting"
          : analysis.conflicts.length === 1
            ? "mixed"
            : "consistent";
    const strongestEvidence: string[] = [];
    if (directExperimentalPapers)
      strongestEvidence.push(
        `${directExperimentalPapers} independent ${directExperimentalPapers === 1 ? "paper contains" : "papers contain"} direct experimental evidence.`,
      );
    if (indirectExperimentalPapers)
      strongestEvidence.push(
        `${indirectExperimentalPapers} independent ${indirectExperimentalPapers === 1 ? "paper contains" : "papers contain"} indirect experimental evidence.`,
      );
    if (directlyConfirmedTargets)
      strongestEvidence.push(
        `${directlyConfirmedTargets} ${directlyConfirmedTargets === 1 ? "target has" : "targets have"} direct experimental confirmation.`,
      );
    if (mechanism.status === "supported")
      strongestEvidence.push("An experimental mechanism chain is supported by stored evidence.");
    const majorEvidenceGaps: string[] = [];
    if (!directExperimentalPapers)
      majorEvidenceGaps.push("No direct experimental evidence was identified in the analyzed material.");
    if (!directlyConfirmedTargets)
      majorEvidenceGaps.push("No molecular target has direct experimental confirmation in the analyzed material.");
    if (mechanism.status === "insufficient_evidence")
      majorEvidenceGaps.push(
        "The retrieved literature does not establish a sufficiently supported molecular mechanism.",
      );
    if (mechanism.status === "partially_supported")
      majorEvidenceGaps.push("The mechanism chain contains unsupported or non-experimental links.");
    if (computationalPapers && !directExperimentalPapers && !indirectExperimentalPapers)
      majorEvidenceGaps.push("The available findings depend entirely on computational evidence.");
    if (paperEvidence.length > 0 && abstractOnlyPapers === paperEvidence.length)
      majorEvidenceGaps.push("Capela analyzed abstracts only; no full text was analyzed.");
    if (analysis.conflicts.length)
      majorEvidenceGaps.push(
        `${analysis.conflicts.length} evidence ${analysis.conflicts.length === 1 ? "conflict was" : "conflicts were"} identified.`,
      );
    if (!analysis.activities.length) majorEvidenceGaps.push("No supported biological activity was extracted.");
    return {
      overallStrength,
      score,
      biologicalActivityEvidence,
      targetEvidence,
      mechanisticEvidence,
      consistency,
      strongestEvidence,
      majorEvidenceGaps: this.unique(majorEvidenceGaps),
      conflicts: analysis.conflicts,
      explanation: `Evidence strength is ${overallStrength.toLocaleLowerCase()} based on ${directExperimentalPapers} direct experimental, ${indirectExperimentalPapers} indirect experimental, and ${computationalPapers} computational source papers; mechanism status is ${mechanism.status.replaceAll("_", " ")}.`,
      basis: {
        papersAnalyzed: paperEvidence.length,
        abstractOnlyPapers,
        directExperimentalPapers,
        indirectExperimentalPapers,
        computationalPapers,
        literatureReportedPapers,
        directlyConfirmedTargets,
        mechanismStatus: mechanism.status,
      },
    };
  }

  private mechanismStrength(mechanism: MechanismResult, claims: EvidenceClaim[]): EvidenceStrength {
    if (mechanism.status === "insufficient_evidence") return "Insufficient";
    if (mechanism.status === "conflicting_evidence") return "Limited";
    const directPapers = new Set(
      claims
        .filter((claim) => mechanism.evidenceIds.includes(claim.id) && claim.evidenceType === "direct_experimental")
        .map((claim) => claim.paperId),
    ).size;
    if (mechanism.status === "supported" && directPapers >= 2) return "Strong";
    if (mechanism.status === "supported") return "Moderate";
    return "Limited";
  }

  private scoreStrength(score: number): EvidenceStrength {
    return score >= 70 ? "Strong" : score >= 40 ? "Moderate" : score >= 15 ? "Limited" : "Insufficient";
  }
  private strongest(values: EvidenceStrength[]): EvidenceStrength {
    const order: EvidenceStrength[] = ["Strong", "Moderate", "Limited", "Insufficient"];
    return order.find((value) => values.includes(value)) ?? "Insufficient";
  }
  private unique<T>(values: T[]) {
    return [...new Set(values)];
  }
}
