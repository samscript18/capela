import { z } from "zod";
import { createHash } from "node:crypto";
import {
  SourceSnapshotSchema,
  type SourceSnapshot,
  type CandidateClaim,
  type ClaimReview,
  type ClaimDecision,
  type EvidenceType,
  type SupportSpan,
} from "@capela/shared";

export class ResearchError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const digest = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
export function scientificUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !["pubmed.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov", "europepmc.org"].includes(url.hostname)
  )
    throw new ResearchError("UNSAFE_SOURCE_URL", "Publication URL is outside the scientific allowlist.");
  url.hash = "";
  return url.toString();
}
export function snapshot(
  paperId: string,
  url: string,
  abstract: string,
  at = new Date().toISOString(),
): SourceSnapshot {
  const normalized = abstract.normalize("NFC").replace(/\r\n?/g, "\n");
  // Do not cut a surrogate pair at the boundary.
  const text = normalized.slice(0, 12000).replace(/[\uD800-\uDBFF]$/, "");
  const hash = digest(text);
  return SourceSnapshotSchema.parse({
    id: `src_${digest(`${paperId}:${hash}`).slice(0, 32)}`,
    paperId,
    canonicalUrl: scientificUrl(url),
    retrievedAt: at,
    hash,
    text,
    scope: "abstract",
    mime: "text/plain",
    sourceKind: "canonical-publication-metadata",
    normalization: "NFC-LF-v1",
    parserVersion: "publication-abstract-v1",
    truncated: normalized.length > text.length,
    coverage: "abstract-only",
  });
}
export function spansValid(spans: SupportSpan[], source: SourceSnapshot): boolean {
  return (
    spans.length > 0 &&
    spans.every(
      (s) =>
        s.blockId === "abstract" &&
        s.convention === "utf16-zero-based-end-exclusive" &&
        Number.isSafeInteger(s.start) &&
        Number.isSafeInteger(s.end) &&
        s.start >= 0 &&
        s.end > s.start &&
        s.end <= source.text.length &&
        source.text.slice(s.start, s.end) === s.quote,
    )
  );
}
export function referenceValid(c: CandidateClaim, sources: SourceSnapshot[]): boolean {
  const source = sources.find((s) => s.id === c.snapshotId && s.paperId === c.paperId && s.hash === c.snapshotHash);
  return !!source && digest(source.text) === source.hash && spansValid(c.spans, source);
}
export function exactIds(expected: string[], actual: string[]) {
  if (
    new Set(expected).size !== expected.length ||
    new Set(actual).size !== actual.length ||
    expected.length !== actual.length ||
    actual.some((id) => !expected.includes(id))
  )
    throw new ResearchError("INVALID_IDS", "Output has missing, duplicate or unknown references.");
}
// A partial order: computational and reported evidence cannot become experiments or each other.
export function canDowngrade(from: EvidenceType, to: EvidenceType): boolean {
  return from === to || to === "insufficient" || (from === "direct_experimental" && to === "indirect_experimental");
}
export function decide(
  candidate: CandidateClaim,
  review: ClaimReview | undefined,
  sources: SourceSnapshot[],
): ClaimDecision {
  const reject = (reason: string, status: ClaimDecision["status"] = "rejected"): ClaimDecision => ({
    candidate,
    review,
    status,
    reason,
  });
  if (!referenceValid(candidate, sources)) return reject("Candidate source or exact passage is invalid.");
  if (!review) return reject("Review unavailable; exact passage is not entailment.", "unresolved");
  const source = sources.find((s) => s.id === candidate.snapshotId)!;
  if (review.claimId !== candidate.id || !spansValid(review.spans, source))
    return reject("Reviewer reference is invalid.");
  if (!canDowngrade(candidate.proposedClass, review.evidenceType))
    return reject("Reviewer attempted an evidence-class upgrade or incomparable class change.");
  if (["unsupported", "contradicted"].includes(review.verdict)) return reject(review.reason);
  if (review.verdict === "uncertain" || !Object.values(review.checks).every(Boolean))
    return reject(review.reason, "unresolved");
  if (review.verdict === "supported" && review.revisedFinding !== null)
    return reject("Supported claims cannot silently change wording.");
  if (review.verdict === "overstated" && !review.revisedFinding)
    return reject("Overstatement has no bounded correction.", "unresolved");
  // Corrections are restricted to an exact source passage: no unreviewed generated revision.
  const finding = review.revisedFinding ?? candidate.finding;
  if (review.revisedFinding && !review.spans.some((s) => s.quote === review.revisedFinding))
    return reject("Correction must be an exact reviewed passage.", "unresolved");
  if (candidate.kind === "source_context" && !["literature_reported", "insufficient"].includes(review.evidenceType))
    return reject("Source context is literature reported, not an experimental result.");
  const quotes = candidate.spans.map((s) => s.quote).join(" ");
  const context = `${quotes} ${finding}`;
  if (candidate.studyType === "review" && !["literature_reported", "insufficient"].includes(review.evidenceType))
    return reject("Review cannot establish primary experimental evidence.");
  if (
    /docking|molecular dynamics|in[ -]silico|network pharmacology|\bQSAR\b/i.test(context) &&
    !["computational_prediction", "insufficient"].includes(review.evidenceType)
  )
    return reject("Computational methods cannot establish experimental evidence.");
  if (
    /\b(no significant|did not|not observed|no evidence|failed to)\b/i.test(quotes) &&
    !/\b(no significant|did not|not observed|no evidence|failed to)\b/i.test(finding)
  )
    return reject("Finding drops a source negation.");
  if (
    candidate.relationship === "direct_binding" &&
    !/binding assay|surface plasmon resonance|isothermal titration|radioligand/i.test(quotes)
  )
    return reject("Direct binding requires a reported binding assay.");
  if (
    /\b(human|patient|clinical efficacy)\b/i.test(finding) &&
    /\b(mice|mouse|rat|cell line|in vitro)\b/i.test(quotes) &&
    !/\b(human|patient)\b/i.test(quotes)
  )
    return reject("Finding promotes non-human context to human outcome.");
  return {
    candidate,
    review,
    status: review.verdict === "overstated" || review.evidenceType !== candidate.proposedClass ? "revised" : "accepted",
    reason: review.reason,
    publishedFinding: finding,
    publishedClass: review.evidenceType,
  };
}

export function strictOutput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ResearchError("INVALID_RESEARCH_SCHEMA", "Structured research output failed strict schema validation.");
  return result.data;
}
