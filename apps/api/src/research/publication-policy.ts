import {
  CandidateClaimSchema,
  ReviewSchema,
  PublicationHoldSchema,
  SupportSpanSchema,
  type PublicationHold,
  type ResearchRun,
  type ClaimDecision,
} from "@capela/shared";
import { decide, digest, ResearchError, referenceValid } from "./provenance";
import { RECORDED_SOURCE_ASSESSMENTS } from "./recorded-source-assessments";

export function applyRecordedSourceAssessments(run: ResearchRun, at = new Date().toISOString()) {
  for (const d of run.decisions) {
    const c = d.candidate;
    const source = run.snapshots.find((s) => s.id === c.snapshotId);
    if (!source || !referenceValid(c, run.snapshots)) continue;
    for (const a of RECORDED_SOURCE_ASSESSMENTS) {
      if (
        c.paperId !== a.paperId ||
        source.hash !== a.snapshotHash ||
        source.normalization !== a.normalization ||
        source.parserVersion !== a.parserVersion ||
        digest(c.finding) !== a.findingHash ||
        digest(JSON.stringify(c.spans.map((span) => SupportSpanSchema.parse(span)))) !== a.spanHash
      )
        continue;
      const existing = run.publicationHolds?.find((h) => h.claimId === c.id && h.assessmentId === a.id);
      if (existing) continue; // publicationDecisions still checks the exact run/review binding.
      const hold = createPublicationHold(
        run,
        c.id,
        `${a.reason} Origin: ${a.origin}.`,
        "recorded_source_assessment",
        at,
      );
      hold.assessmentId = a.id;
      hold.assessmentRecordedAt = a.recordedAt;
      (run.publicationHolds ??= []).push(hold);
    }
  }
}

export function reviewDigest(review: ClaimDecision["review"]) {
  // Canonical schema order avoids depending on BSON/JSON property ordering.
  return digest(JSON.stringify(review ? ReviewSchema.shape.reviews.element.parse(review) : null));
}
export function publicationBinding(decision: ClaimDecision) {
  const c = CandidateClaimSchema.parse(decision.candidate);
  return {
    claimId: c.id,
    snapshotId: c.snapshotId,
    snapshotHash: c.snapshotHash,
    findingHash: digest(c.finding),
    reviewHash: reviewDigest(decision.review),
  };
}
export function createPublicationHold(
  run: ResearchRun,
  claimId: string,
  reason: string,
  actor: PublicationHold["actor"],
  at: string,
): PublicationHold {
  const matches = run.decisions.filter((d) => d.candidate.id === claimId);
  if (matches.length !== 1 || !referenceValid(matches[0]!.candidate, run.snapshots))
    throw new ResearchError(
      "INVALID_PUBLICATION_HOLD",
      "Hold must identify exactly one source-validated recorded candidate.",
    );
  const binding = publicationBinding(matches[0]!);
  const originalRunId = run.publicationRevision?.originalRunId ?? run.runId;
  return PublicationHoldSchema.parse({
    version: "publication-hold-v1",
    id: `hold_${digest(JSON.stringify([originalRunId, binding, actor, at, reason]))}`,
    originalRunId,
    ...binding,
    actor,
    recordedAt: at,
    verdict: "unsupported",
    reason,
  });
}
export function publicationDecisions(run: ResearchRun): ClaimDecision[] {
  const holds = (run.publicationHolds ?? []).map((h) => PublicationHoldSchema.parse(h));
  if (new Set(holds.map((h) => h.id)).size !== holds.length)
    throw new ResearchError("INVALID_PUBLICATION_HOLD", "Duplicate publication hold IDs.");
  for (const h of holds) {
    const d = run.decisions.find((d) => d.candidate.id === h.claimId);
    if (
      !d ||
      h.originalRunId !== (run.publicationRevision?.originalRunId ?? run.runId) ||
      JSON.stringify(publicationBinding(d)) !==
        JSON.stringify({
          claimId: h.claimId,
          snapshotId: h.snapshotId,
          snapshotHash: h.snapshotHash,
          findingHash: h.findingHash,
          reviewHash: h.reviewHash,
        })
    )
      throw new ResearchError(
        "STALE_PUBLICATION_HOLD",
        "Publication hold does not match the exact recorded run, finding, source and review.",
      );
  }
  return run.decisions.map((d) => {
    const base = decide(d.candidate, d.review, run.snapshots);
    // Preserve earlier deterministic rejections/downgrades. Holds only remove publication permission.
    const prior = d.status === "rejected" || d.status === "unresolved" ? d : base;
    const matches = holds.filter((h) => h.claimId === d.candidate.id);
    if (!matches.length)
      return d.status === "accepted" || d.status === "revised"
        ? base.status === "accepted" || base.status === "revised"
          ? d
          : base
        : prior;
    return {
      candidate: d.candidate,
      ...(d.review ? { review: d.review } : {}),
      status: prior.status === "rejected" ? ("rejected" as const) : ("unresolved" as const),
      reason: `Publication withheld after ${matches.map((h) => `${h.actor} at ${h.recordedAt}: ${h.reason}`).join("; ")}. Original model verdict retained; no new model correction.`,
    };
  });
}
