import { z } from "zod";
import {
  CandidateClaimSchema,
  ReviewSchema,
  ExtractionSelectionSchema,
  ReviewSelectionSchema,
  PassageIndexSchema,
  type SourceSnapshot,
  type CandidateClaim,
} from "@capela/shared";
import { digest, sourcePassages, spansValid, ResearchError, strictOutput } from "./provenance";

export const INFERENCE_CONTRACT = "passage-selection-v1" as const;
function passageId(source: SourceSnapshot, span: z.infer<typeof PassageIndexSchema>["passages"][number]["span"]) {
  return `psg_${digest(JSON.stringify(["passage-index-v1", source.id, source.hash, source.normalization, span]))}`;
}
function indexHash(index: Omit<z.infer<typeof PassageIndexSchema>, "hash">) {
  return digest(JSON.stringify(index));
}
export function indexedSource(source: SourceSnapshot): SourceSnapshot {
  if (digest(source.text) !== source.hash)
    throw new ResearchError("SNAPSHOT_HASH_MISMATCH", "Immutable source hash does not match its text.");
  if (source.passageIndex) {
    const index = strictOutput(PassageIndexSchema, source.passageIndex);
    const { hash, ...manifest } = index;
    if (
      index.snapshotId !== source.id ||
      index.snapshotHash !== source.hash ||
      index.normalization !== source.normalization ||
      hash !== indexHash(manifest) ||
      new Set(index.passages.map((p) => p.id)).size !== index.passages.length ||
      index.passages.some((p) => p.id !== passageId(source, p.span) || !spansValid([p.span], source))
    )
      throw new ResearchError(
        "INVALID_PASSAGE_INDEX",
        "Stored passage index is stale, altered or belongs to another snapshot.",
      );
    return source; // Never re-segment a persisted index, even on a different ICU version.
  }
  const manifest = {
    version: "passage-index-v1" as const,
    snapshotId: source.id,
    snapshotHash: source.hash,
    normalization: source.normalization,
    segmenter: "intl-en-sentence-v1" as const,
    runtime: `node-${process.versions.node};icu-${process.versions.icu}`,
    passages: sourcePassages(source).map((span) => ({ id: passageId(source, span), span })),
  };
  return { ...source, passageIndex: PassageIndexSchema.parse({ ...manifest, hash: indexHash(manifest) }) };
}
export function resolvePassages(ids: string[], source: SourceSnapshot) {
  if (!source.passageIndex) throw new ResearchError("MISSING_PASSAGE_INDEX", "Source has no durable passage index.");
  indexedSource(source);
  if (!ids.length || ids.length > 4 || new Set(ids).size !== ids.length)
    throw new ResearchError(
      "INVALID_PASSAGE_REFERENCE",
      "Passage selection is empty, duplicated or exceeds its bound.",
    );
  return ids.map((id) => {
    const passage = source.passageIndex!.passages.find((p) => p.id === id);
    if (!passage)
      throw new ResearchError("INVALID_PASSAGE_REFERENCE", "Unknown, stale or cross-source passage reference.");
    return { ...passage.span };
  });
}
function exactSource(paperId: string, sources: SourceSnapshot[]) {
  const matches = sources.filter((s) => s.paperId === paperId);
  if (matches.length !== 1)
    throw new ResearchError("INVALID_SOURCE_REFERENCE", "Expected one exact supplied snapshot per paper.");
  return matches[0]!;
}
export function hydrateExtraction(input: unknown, sources: SourceSnapshot[]) {
  const output = strictOutput(ExtractionSelectionSchema, input);
  return {
    papers: output.papers.map((p) => {
      const source = exactSource(p.paperId, sources);
      return {
        ...p,
        claims: p.claims.map((c) => {
          if (c.paperId !== p.paperId)
            throw new ResearchError("INVALID_IDS", "Claim belongs to the wrong paper group.");
          const { passageIds, ...candidate } = c;
          return CandidateClaimSchema.parse({
            ...candidate,
            snapshotId: source.id,
            snapshotHash: source.hash,
            analyzedSource: source.scope,
            spans: resolvePassages(passageIds, source),
            passageSelection: { version: INFERENCE_CONTRACT, indexHash: source.passageIndex!.hash, passageIds },
          });
        }),
      };
    }),
  };
}
export function hydrateReviews(input: unknown, claims: CandidateClaim[], sources: SourceSnapshot[]) {
  const output = strictOutput(ReviewSelectionSchema, input);
  return {
    reviews: output.reviews.map((r) => {
      const matches = claims.filter((c) => c.id === r.claimId);
      if (matches.length !== 1)
        throw new ResearchError("INVALID_IDS", "Reviewer claim reference is unknown or duplicated.");
      const claim = matches[0]!,
        source = exactSource(claim.paperId, sources);
      if (source.id !== claim.snapshotId || source.hash !== claim.snapshotHash)
        throw new ResearchError("INVALID_SOURCE_REFERENCE", "Reviewer source differs from the candidate snapshot.");
      const { passageIds, revisionPassageId, ...review } = r;
      const spans = resolvePassages(passageIds, source);
      if (
        (r.verdict === "overstated") !== (revisionPassageId !== null) ||
        (revisionPassageId !== null && !passageIds.includes(revisionPassageId))
      )
        throw new ResearchError(
          "INVALID_CORRECTION_REFERENCE",
          "Only an overstated finding may select one supporting passage as its correction.",
        );
      const revisedFinding = revisionPassageId === null ? null : resolvePassages([revisionPassageId], source)[0]!.quote;
      return ReviewSchema.shape.reviews.element.parse({
        ...review,
        revisedFinding,
        spans,
        passageSelection: {
          version: INFERENCE_CONTRACT,
          indexHash: source.passageIndex!.hash,
          passageIds,
          revisionPassageId,
        },
      });
    }),
  };
}
