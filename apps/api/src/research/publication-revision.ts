import {
  type EvidenceClaim,
  type MoleculeSnapshot,
  type PaperSnapshot,
  type ResearchRun,
  PublicationRevisionSchema,
  ResearchRunSchema,
} from "@capela/shared";
import { publicationDecisions } from "./publication-policy";
import { digest, ResearchError } from "./provenance";
import { AUDIT_PROGRAM, AUDIT_VERSION, localAudit } from "./evidence-audit";
import { EvidenceClassifierService } from "./evidence-classifier.service";
import { MechanismService } from "./mechanism.service";
import { ResearchAssessmentService } from "./research-assessment.service";
import { DossierService } from "./dossier.service";

export function revisePublication(
  original: {
    status: string;
    research: ResearchRun;
    molecule: MoleculeSnapshot;
    papers: PaperSnapshot[];
    evidence: EvidenceClaim[];
  },
  holds: NonNullable<ResearchRun["publicationHolds"]>,
  at: string,
  codeCommit: string,
) {
  if (original.status !== "completed" || !holds.length || original.research.publicationRevision)
    throw new ResearchError(
      "INVALID_PUBLICATION_REVISION",
      "Revise a completed original run with explicit evidence-bound holds; never rewrite an existing revision.",
    );
  const research: ResearchRun = structuredClone(original.research);
  research.publicationHolds = [...(research.publicationHolds ?? []), ...holds];
  research.publicationRevision = PublicationRevisionSchema.parse({
    version: "publication-revision-v1",
    originalRunId: original.research.runId,
    originalRecordHash: digest(JSON.stringify(original)),
    recordedAt: at,
    provenance: "post-run-source-inspection; no new inference",
    codeCommit,
    ...(original.research.audit ? { originalAudit: original.research.audit } : {}),
  });
  research.decisions = publicationDecisions(research);
  const allowed = new Set(
    research.decisions.filter((d) => d.status === "accepted" || d.status === "revised").map((d) => d.candidate.id),
  );
  // A hold can remove a published claim, never manufacture a replacement or approve a prior rejection.
  const evidence = structuredClone(original.evidence.filter((c) => allowed.has(c.id)));
  if (evidence.length !== allowed.size)
    throw new ResearchError(
      "INVALID_PUBLICATION_REVISION",
      "Every retained published decision must have its original evidence record.",
    );
  const auditClaims = evidence.map((c) => {
    const d = research.decisions.find((d) => d.candidate.id === c.id)!;
    if (c.finding !== d.publishedFinding || c.evidenceType !== d.publishedClass || !c.provenance)
      throw new ResearchError(
        "INVALID_PUBLICATION_REVISION",
        "Publication evidence differs from its validated decision.",
      );
    return {
      ...d.candidate,
      finding: c.finding,
      proposedClass: c.evidenceType,
      spans: c.provenance.spans,
      passageSelection: d.review?.passageSelection,
    };
  });
  const audit = localAudit(auditClaims, research.snapshots);
  if (!audit.valid)
    throw new ResearchError("INVALID_PUBLICATION_REVISION", "Retained publication evidence failed local audit.");
  research.runId = `pubrev_${digest(JSON.stringify([original.research.runId, holds]))}`;
  research.audit = { ...audit, version: AUDIT_VERSION, programHash: digest(AUDIT_PROGRAM), remote: false };
  research.limitations.push(
    "Publication revision after source inspection: original model responses, events, and cost ledger are retained. No new inference or hosted audit ran; the current evidence set was checked locally. Withheld candidates remain in the review trail.",
  );
  const classifier = new EvidenceClassifierService();
  const validated = classifier.aggregateReviewed(
    evidence,
    holds.map((h) => ({
      paperId: research.decisions.find((d) => d.candidate.id === h.claimId)!.candidate.paperId,
      items: [h.reason],
    })),
  );
  const mechanism = new MechanismService().build(original.molecule, evidence, original.papers, validated.analysis);
  const assessment = new ResearchAssessmentService().assess(
    evidence,
    validated.analysis,
    mechanism,
    original.papers.map(() => ({ analyzedSource: "abstract" as const })),
  );
  assessment.basis.papersAnalyzed = original.papers.length;
  assessment.basis.abstractOnlyPapers = original.papers.length;
  assessment.majorEvidenceGaps.push(
    `${holds.length} publication support hold(s): unsupported wording is withheld. Original model agreement did not establish complete source support.`,
  );
  const dossier = new DossierService().build(
    original.molecule,
    original.papers,
    evidence,
    validated.analysis,
    mechanism,
    assessment,
  );
  dossier.generatedAt = at;
  ResearchRunSchema.parse(research);
  return { research, evidence, analysis: validated.analysis, mechanism, assessment, dossier, counts: validated.counts };
}
