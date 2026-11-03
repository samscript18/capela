import { z } from "zod";
import { EvidenceTypeSchema, PaperEvidenceSchema, TargetRelationshipSchema } from "./index";

const Id = z.string().min(1).max(200);
const Text = z.string().min(1).max(1500);
export const SupportSpanSchema = z
  .object({
    blockId: z.literal("abstract"),
    quote: Text,
    start: z.number().int().min(0),
    end: z.number().int().positive(),
    convention: z.literal("utf16-zero-based-end-exclusive"),
  })
  .strict();
export const SourceSnapshotSchema = z
  .object({
    id: Id,
    paperId: Id,
    canonicalUrl: z.string().url(),
    retrievedAt: z.string().datetime(),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    text: z.string().max(12000),
    scope: z.literal("abstract"),
    mime: z.literal("text/plain"),
    sourceKind: z.literal("canonical-publication-metadata"),
    normalization: z.literal("NFC-LF-v1"),
    parserVersion: z.literal("publication-abstract-v1"),
    truncated: z.boolean(),
    coverage: z.literal("abstract-only"),
  })
  .strict();
export const CandidateClaimSchema = z
  .object({
    id: Id,
    paperId: Id,
    snapshotId: Id,
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    analyzedSource: z.literal("abstract"),
    finding: Text,
    proposedClass: EvidenceTypeSchema,
    kind: z.enum(["activity", "target", "mechanism", "source_context"]),
    studyType: PaperEvidenceSchema.shape.studyType,
    model: Text.nullable(),
    measuredOutcome: Text.nullable(),
    label: Text,
    relationship: TargetRelationshipSchema.nullable(),
    spans: z.array(SupportSpanSchema).min(1).max(4),
  })
  .strict();
export const ExtractionSchema = z
  .object({
    papers: z
      .array(
        z
          .object({
            paperId: Id,
            claims: z.array(CandidateClaimSchema).max(12),
            limitations: z.array(Text).max(8),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
export const ReviewSchema = z
  .object({
    reviews: z
      .array(
        z
          .object({
            claimId: Id,
            verdict: z.enum(["supported", "overstated", "unsupported", "contradicted", "uncertain"]),
            reason: Text,
            evidenceType: EvidenceTypeSchema,
            revisedFinding: Text.nullable(),
            spans: z.array(SupportSpanSchema).min(1).max(4),
            checks: z
              .object({
                molecule: z.boolean(),
                negation: z.boolean(),
                studyContext: z.boolean(),
                directness: z.boolean(),
                sourceLimitations: z.boolean(),
              })
              .strict(),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();
export type SourceSnapshot = z.infer<typeof SourceSnapshotSchema>;
export type SupportSpan = z.infer<typeof SupportSpanSchema>;
export type CandidateClaim = z.infer<typeof CandidateClaimSchema>;
export type ClaimReview = z.infer<typeof ReviewSchema>["reviews"][number];
export type ClaimDecision = {
  candidate: CandidateClaim;
  review?: ClaimReview;
  status: "accepted" | "revised" | "rejected" | "unresolved";
  reason: string;
  publishedFinding?: string;
  publishedClass?: z.infer<typeof EvidenceTypeSchema>;
};
export type RunEvent = {
  sequence: number;
  at: string;
  operation: string;
  status: "started" | "completed" | "failed";
  correlationId: string;
  requestId?: string;
  provider?: string;
  model?: string;
  fallback?: boolean;
  costMicrousd?: number;
  durationMs?: number;
  httpStatus?: number;
  upstreamCode?: string;
  toolCallId?: string;
  code?: string;
};
export type ResearchRun = {
  version: "otari-evidence-v1";
  runId: string;
  snapshots: SourceSnapshot[];
  decisions: ClaimDecision[];
  events: RunEvent[];
  models: { extraction?: string; review?: string; distinct: boolean };
  budget: {
    currency: "USD";
    capMicrousd: number;
    reservedMicrousd: number;
    reportedMicrousd: number;
    unknownCostCalls: number;
    calls: number;
    maxCalls: number;
    terminal: boolean;
  };
  audit?: {
    version: string;
    programHash: string;
    valid: boolean;
    accepted: number;
    sources: number;
    distribution: Record<string, number>;
    invalidIds: string[];
    remote: boolean;
    requestId?: string;
  };
  limitations: string[];
  checkpoint?: string;
  dispatchUncertain?: boolean;
};

export const ResearchRunSchema = z
  .object({
    version: z.literal("otari-evidence-v1"),
    runId: Id,
    snapshots: z.array(SourceSnapshotSchema).max(5),
    decisions: z
      .array(
        z
          .object({
            candidate: CandidateClaimSchema,
            review: ReviewSchema.shape.reviews.element.optional(),
            status: z.enum(["accepted", "revised", "rejected", "unresolved"]),
            reason: z.string(),
            publishedFinding: z.string().optional(),
            publishedClass: EvidenceTypeSchema.optional(),
          })
          .strict(),
      )
      .max(60),
    events: z
      .array(
        z
          .object({
            sequence: z.number().int(),
            at: z.string(),
            operation: z.string(),
            status: z.enum(["started", "completed", "failed"]),
            correlationId: Id,
            requestId: Id.optional(),
            provider: Id.optional(),
            model: Id.optional(),
            fallback: z.boolean().optional(),
            costMicrousd: z.number().int().optional(),
            durationMs: z.number().optional(),
            httpStatus: z.number().int().min(100).max(599).optional(),
            upstreamCode: Id.optional(),
            toolCallId: Id.optional(),
            code: Id.optional(),
          })
          .strict(),
      )
      .max(100),
    models: z.object({ extraction: Id.optional(), review: Id.optional(), distinct: z.boolean() }).strict(),
    budget: z
      .object({
        currency: z.literal("USD"),
        capMicrousd: z.number().int().nonnegative(),
        reservedMicrousd: z.number().int().nonnegative(),
        reportedMicrousd: z.number().int().nonnegative(),
        unknownCostCalls: z.number().int().nonnegative(),
        calls: z.number().int().nonnegative(),
        maxCalls: z.number().int().positive(),
        terminal: z.boolean(),
      })
      .strict(),
    audit: z
      .object({
        version: Id,
        programHash: z.string(),
        valid: z.boolean(),
        accepted: z.number().int(),
        sources: z.number().int(),
        distribution: z.record(z.string(), z.number().int()),
        invalidIds: z.array(Id),
        remote: z.boolean(),
        requestId: Id.optional(),
      })
      .strict()
      .optional(),
    limitations: z.array(z.string()),
    checkpoint: Id.optional(),
    dispatchUncertain: z.boolean().optional(),
  })
  .strict();
