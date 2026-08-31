import type {
  EvidenceClaim,
  EvidenceType,
  InvestigationAnalysis,
  MechanismEdge,
  MechanismResult,
  MoleculeSnapshot,
  PaperSnapshot,
} from "@capela/shared";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

const EXPERIMENTAL_TYPES = new Set<EvidenceType>(["direct_experimental", "indirect_experimental"]);

export class MechanismValidationError extends Error {
  constructor(
    readonly code: "INVALID_MECHANISM_ATTRIBUTION",
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class MechanismService {
  build(
    molecule: MoleculeSnapshot,
    claims: EvidenceClaim[],
    papers: PaperSnapshot[],
    analysis: InvestigationAnalysis,
  ): MechanismResult {
    const mechanismClaims = claims.filter(
      (claim) => claim.kind === "mechanism" && claim.evidenceType !== "insufficient",
    );
    const edgeGroups = new Map<string, MechanismEdge>();
    let completeExperimentalChain = false;
    for (const claim of mechanismClaims) {
      const components = [claim.molecularEvent, claim.pathway, claim.cellularEffect, claim.biologicalOutcome]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
      if (components.length < 2) continue;
      if (
        claim.molecularEvent &&
        claim.pathway &&
        claim.cellularEffect &&
        claim.biologicalOutcome &&
        EXPERIMENTAL_TYPES.has(claim.evidenceType)
      )
        completeExperimentalChain = true;
      const nodes = [molecule.preferredName, ...components].filter(
        (value, index, values) => index === 0 || this.normalize(value) !== this.normalize(values[index - 1]!),
      );
      for (let index = 0; index < nodes.length - 1; index += 1) {
        const from = nodes[index]!;
        const to = nodes[index + 1]!;
        const key = `${this.normalize(from)}=>${this.normalize(to)}`;
        const existing = edgeGroups.get(key);
        if (existing) {
          existing.evidenceIds = this.unique([...existing.evidenceIds, claim.id]);
          existing.paperIds = this.unique([...existing.paperIds, claim.paperId]);
          const evidenceType = this.strongerEvidence(existing.evidenceType, claim.evidenceType);
          if (evidenceType !== existing.evidenceType) existing.description = claim.finding;
          existing.evidenceType = evidenceType;
        } else {
          edgeGroups.set(key, {
            id: this.edgeId(from, to),
            from,
            to,
            description: claim.finding,
            evidenceType: claim.evidenceType,
            evidenceIds: [claim.id],
            paperIds: [claim.paperId],
          });
        }
      }
    }
    const edges = [...edgeGroups.values()];
    if (!edges.length)
      return {
        status: "insufficient_evidence",
        summary: "The retrieved literature does not establish a sufficiently supported molecular mechanism.",
        edges: [],
        evidenceIds: [],
        paperIds: [],
      };
    this.validateEdges(edges, claims, papers);
    const evidenceIds = this.unique(edges.flatMap((edge) => edge.evidenceIds));
    const paperIds = this.unique(edges.flatMap((edge) => edge.paperIds));
    const relevantConflict = analysis.conflicts.some(
      (conflict) => conflict.scope === "target" && conflict.paperIds.some((paperId) => paperIds.includes(paperId)),
    );
    if (relevantConflict)
      return {
        status: "conflicting_evidence",
        summary: "The retrieved evidence supports mechanistic links but includes conflicting target relationships.",
        edges,
        evidenceIds,
        paperIds,
      };
    if (completeExperimentalChain)
      return {
        status: "supported",
        summary: "The retrieved experimental evidence supports a molecular-to-biological mechanism chain.",
        edges,
        evidenceIds,
        paperIds,
      };
    return {
      status: "partially_supported",
      summary:
        "The retrieved evidence supports part of a mechanism chain, but one or more molecular-to-outcome links remain incomplete or non-experimental.",
      edges,
      evidenceIds,
      paperIds,
    };
  }

  private validateEdges(edges: MechanismEdge[], claims: EvidenceClaim[], papers: PaperSnapshot[]) {
    const evidenceIds = new Set(claims.map((claim) => claim.id));
    const paperIds = new Set(papers.map((paper) => paper.id));
    if (
      edges.some(
        (edge) =>
          !edge.evidenceIds.length ||
          !edge.paperIds.length ||
          edge.evidenceIds.some((id) => !evidenceIds.has(id)) ||
          edge.paperIds.some((id) => !paperIds.has(id)),
      )
    ) {
      throw new MechanismValidationError(
        "INVALID_MECHANISM_ATTRIBUTION",
        "A mechanism edge references evidence or literature that does not exist.",
      );
    }
  }

  private strongerEvidence(left: EvidenceType, right: EvidenceType): EvidenceType {
    const rank: Record<EvidenceType, number> = {
      insufficient: 0,
      capela_inference: 1,
      literature_reported: 2,
      computational_prediction: 3,
      indirect_experimental: 4,
      direct_experimental: 5,
    };
    return rank[right] > rank[left] ? right : left;
  }

  private edgeId(from: string, to: string) {
    return `edge_${createHash("sha256")
      .update(`${this.normalize(from)}=>${this.normalize(to)}`)
      .digest("hex")
      .slice(0, 16)}`;
  }
  private normalize(value: string) {
    return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  }
  private unique<T>(values: T[]) {
    return [...new Set(values)];
  }
}
