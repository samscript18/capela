import { createHash } from "node:crypto";
import type { GuardrailMetadata, RunEvent } from "@capela/shared";

// Official guardrails-reference.md: never retain explanations, vendor payloads or raw profiles.
export function guardrailMetadata(raw: string | null): GuardrailMetadata | undefined {
  if (raw === null) return undefined;
  const base = { version: "otari-guardrails-v1", source: "Otari-Guardrails" } as const;
  const invalid = (state: "malformed" | "oversized"): GuardrailMetadata => ({ ...base, state, results: [] });
  if (Buffer.byteLength(raw, "utf8") > 8192) return invalid("oversized");
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values) || values.length > 8) return invalid("malformed");
    const results: GuardrailMetadata["results"] = [];
    for (const entry of values) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return invalid("malformed");
      const { profile, mode, status, valid, score, reason } = entry;
      if (
        typeof profile !== "string" ||
        !profile.length ||
        profile.length > 128 ||
        !["block", "monitor"].includes(mode) ||
        !["evaluated", "inconclusive", "unavailable"].includes(status) ||
        (status === "evaluated" ? typeof valid !== "boolean" : valid !== null) ||
        (reason !== undefined &&
          (status !== "unavailable" || !["not_configured", "evaluation_failed"].includes(reason)))
      )
        return invalid("malformed");
      results.push({
        profileHash: createHash("sha256").update(profile).digest("hex"),
        mode,
        status,
        valid,
        ...(typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1 ? { score } : {}),
        ...(reason !== undefined ? { reason } : {}),
      });
    }
    return { ...base, state: "valid", results };
  } catch {
    return invalid("malformed");
  }
}

export function evaluatedGuardrailRefusal(event: RunEvent | undefined): boolean {
  return Boolean(
    event?.httpStatus === 403 &&
      event.requestId &&
      ["guardrail_violation", "guardrail_blocked"].includes(event.upstreamCode ?? "") &&
      event.guardrails?.state === "valid" &&
      event.guardrails.results.some((r) => r.status === "evaluated" && r.valid === false && r.mode === "block"),
  );
}

// Pinned official _helpers.py: a blocking evaluated result is emitted in HTTPException.detail,
// not the non-blocking summary header. This envelope's list contains only flagged block checks.
export function guardrailRefusalMetadata(body: Record<string, unknown>, status: number): GuardrailMetadata | undefined {
  if (status !== 403 || !body.detail || typeof body.detail !== "object" || Array.isArray(body.detail)) return;
  const detail = body.detail as Record<string, unknown>;
  if (detail.code !== "guardrail_violation") return;
  const base = { version: "otari-guardrails-v1", source: "error.detail.guardrails" } as const;
  const malformed: GuardrailMetadata = { ...base, state: "malformed", results: [] };
  if (!Array.isArray(detail.guardrails) || !detail.guardrails.length || detail.guardrails.length > 8) return malformed;
  const results: GuardrailMetadata["results"] = [];
  for (const value of detail.guardrails) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      typeof value.profile !== "string" ||
      !value.profile.length ||
      value.profile.length > 128
    )
      return malformed;
    results.push({
      profileHash: createHash("sha256").update(value.profile).digest("hex"),
      mode: "block",
      status: "evaluated",
      valid: false,
      ...(typeof value.score === "number" && Number.isFinite(value.score) && value.score >= 0 && value.score <= 1
        ? { score: value.score }
        : {}),
    });
  }
  return { ...base, state: "valid", results };
}
