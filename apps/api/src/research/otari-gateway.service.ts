import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import {
  ExtractionSelectionSchema,
  ReviewSelectionSchema,
  ExtractionSchema,
  ReviewSchema,
  type ResearchRun,
  type RunEvent,
} from "@capela/shared";
import { z } from "zod";
import { ResearchError } from "./provenance";
import { guardrailMetadata, guardrailRefusalMetadata } from "./guardrail-metadata";

export type SaveRun = () => Promise<void>;
export function usdMicros(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^\d+\.\d{6}$/.test(value)) return undefined;
  const [whole, part] = value.split(".");
  const result = Number(whole) * 1000000 + Number(part);
  return Number.isSafeInteger(result) ? result : undefined;
}
export function reserve(run: ResearchRun, amount: number) {
  const b = run.budget;
  if (
    b.terminal ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    b.calls >= b.maxCalls ||
    b.reservedMicrousd + b.reportedMicrousd + amount > b.capMicrousd
  ) {
    b.terminal = true;
    throw new ResearchError(
      "RUN_BUDGET_EXHAUSTED",
      "The application run allowance is exhausted. Saved findings remain partial.",
    );
  }
  b.reservedMicrousd += amount;
  b.calls += 1;
}
@Injectable()
export class OtariGatewayService {
  constructor(private readonly config: ConfigService) {}
  value(key: string) {
    return this.config.get<string>(key)?.trim() ?? "";
  }
  integer(key: string, fallback: number, max: number): number {
    const n = Number(this.value(key) || fallback);
    if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new ResearchError("OTARI_CONFIGURATION", `Invalid ${key}.`);
    return n;
  }
  createRun(runId: string): ResearchRun {
    return {
      version: "otari-evidence-v1",
      runId,
      snapshots: [],
      decisions: [],
      events: [],
      models: { distinct: false },
      budget: {
        currency: "USD",
        capMicrousd: this.integer("OTARI_RUN_BUDGET_MICROUSD", 0, 100000000),
        reservedMicrousd: 0,
        reportedMicrousd: 0,
        unknownCostCalls: 0,
        calls: 0,
        maxCalls: this.integer("OTARI_RUN_MAX_CALLS", this.value("OTARI_REVIEW_FALLBACK") === "vertex" ? 24 : 16, 24),
        terminal: false,
      },
      limitations: [
        "At most five abstracts; no full-text or exhaustive coverage.",
        "Model-assisted review is not proof of scientific truth.",
        "Application reservations are estimates; hosted ceiling enforcement must be independently verified.",
        "Direct PubChem/NCBI calls are external to Otari billing.",
      ],
    };
  }
  assertConfigured() {
    if (!this.value("OTARI_API_KEY"))
      throw new ResearchError(
        "OTARI_NOT_CONFIGURED",
        "Configure a server-only Otari runtime key locally; set its finite ceiling in hosted Otari.",
      );
  }
  async request(
    path: string,
    body: Record<string, unknown> | undefined,
    operation: string,
    run: ResearchRun,
    save: SaveRun,
    reservationMicrousd?: number,
  ) {
    this.assertConfigured();
    const paid = body !== undefined;
    const amount = reservationMicrousd ?? this.integer("OTARI_CALL_RESERVATION_MICROUSD", 10000, 100000000);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000)
      throw new ResearchError("OTARI_CONFIGURATION", "Invalid dispatch reservation.");
    const requestedPolicy = operation === "extraction" || operation === "review" ? body?.model : undefined;
    if (
      requestedPolicy !== undefined &&
      (typeof requestedPolicy !== "string" ||
        !/^[a-zA-Z0-9._:/-]{1,200}$/.test(requestedPolicy) ||
        /bearer|tk-|https?:/i.test(requestedPolicy))
    )
      throw new ResearchError("OTARI_CONFIGURATION", "Invalid role policy identifier.");
    if (paid) reserve(run, amount);
    if (run.budget.terminal) throw new ResearchError("RUN_BUDGET_EXHAUSTED", "No further spending is allowed.");
    if (run.events.length >= 100) throw new ResearchError("RUN_EVENT_LIMIT", "Run event bound reached.");
    const event: RunEvent = {
      sequence: run.events.length + 1,
      at: new Date().toISOString(),
      operation,
      status: "started",
      correlationId: randomUUID(),
    };
    // Configuration is distinct from observed resolution; retain it before dispatch,
    // including denied calls. Never infer attempted providers from this alias.
    if (typeof requestedPolicy === "string") event.requestedPolicy = requestedPolicy;
    run.events.push(event);
    run.dispatchUncertain = paid;
    await save(); // Durable reservation and fencing check BEFORE dispatch.
    const started = Date.now();
    try {
      const response = await fetch(`https://otari.ai/api/v1${path}`, {
        method: paid ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(90000),
        headers: { Authorization: `Bearer ${this.value("OTARI_API_KEY")}`, "Content-Type": "application/json" },
        ...(paid ? { body: JSON.stringify(body) } : {}),
      });
      event.httpStatus = response.status;
      event.guardrails = guardrailMetadata(response.headers.get("Otari-Guardrails"));
      const requestId = safeHeader(response, "Otari-Request-ID");
      const provider = safeHeader(response, "Otari-Provider");
      const model = safeHeader(response, "Otari-Model");
      const budgetScope = safeHeader(response, "Otari-Budget-Scope");
      if (budgetScope) event.budgetScope = budgetScope;
      if (requestId) event.requestId = requestId;
      if (provider) event.provider = provider;
      if (model) event.model = model;
      const fallback = response.headers.get("Otari-Fallback");
      if (fallback === "true" || fallback === "false") event.fallback = fallback === "true";
      if (!response.ok) {
        let upstreamCode = knownErrorCode(response.headers.get("Otari-Error-Code"));
        try {
          const failure = await boundedJson(response, 8192);
          event.guardrails ??= guardrailRefusalMetadata(failure, response.status);
          upstreamCode ??=
            knownErrorCode(failure.code) ??
            knownErrorCode((failure.error as { code?: unknown } | undefined)?.code) ??
            knownErrorCode((failure.detail as { code?: unknown } | undefined)?.code);
        } catch {
          /* Error bodies are untrusted; never retain raw provider messages. */
        }
        if (upstreamCode) event.upstreamCode = upstreamCode;
        if (response.status === 402 || upstreamCode === "budget_exceeded" || upstreamCode === "insufficient_funds")
          run.budget.terminal = true;
        const code =
          upstreamCode === "insufficient_funds"
            ? "OTARI_INSUFFICIENT_FUNDS"
            : upstreamCode === "pricing_required"
              ? "OTARI_PRICING_REQUIRED"
              : upstreamCode === "budget_exceeded"
                ? "OTARI_BUDGET_DENIED"
                : response.status === 402
                  ? "OTARI_SPENDING_DENIED"
                  : response.status === 401
                    ? "OTARI_AUTH_DENIED"
                    : response.status === 403 &&
                        (upstreamCode === "guardrail_blocked" || upstreamCode === "guardrail_violation")
                      ? "OTARI_GUARDRAIL_BLOCKED"
                      : operation === "mcp_discovery" && [502, 503, 504].includes(response.status)
                        ? "OTARI_MCP_UNAVAILABLE"
                        : response.status === 504
                          ? "OTARI_UPSTREAM_TIMEOUT"
                          : "OTARI_PROVIDER_ERROR";
        throw new ResearchError(
          code,
          code === "OTARI_INSUFFICIENT_FUNDS"
            ? "Otari reported insufficient funds. No automatic retry or provider bypass is allowed."
            : code === "OTARI_PRICING_REQUIRED"
              ? "Otari requires configured pricing before this request can run."
              : run.budget.terminal
                ? "Otari refused spending. No provider bypass or automatic retry is allowed."
                : code === "OTARI_GUARDRAIL_BLOCKED"
                  ? "Otari blocked this request under an inference guardrail. No automatic retry or provider bypass is allowed."
                  : code === "OTARI_MCP_UNAVAILABLE"
                    ? `Otari could not discover the publication MCP server (HTTP ${response.status}). Check the registered remote URL, authentication header and server availability in Otari. Saved search remains partial; no automatic replay was attempted.`
                    : code === "OTARI_UPSTREAM_TIMEOUT"
                      ? `Otari ${operation} timed out upstream (HTTP 504). The request may have been charged; its reservation is retained and automatic replay is disabled. Saved sources and completed work remain available.`
                      : `Otari ${operation} failed (HTTP ${response.status}).`,
        );
      }

      const data = await boundedJson(response, 300000);
      const cost = usdMicros((data as { usage?: { cost_usd?: unknown } }).usage?.cost_usd);
      if (paid && cost !== undefined) {
        run.budget.reservedMicrousd -= amount;
        run.budget.reportedMicrousd += cost;
        event.costMicrousd = cost;
        if (cost > amount)
          run.limitations.push(
            `Reported ${operation} cost exceeded its estimated reservation (${cost} versus ${amount} USD microdollars). The actual charge is counted against the run allowance.`,
          );
        if (run.budget.reportedMicrousd + run.budget.reservedMicrousd >= run.budget.capMicrousd)
          run.budget.terminal = true;
      } else if (paid) run.budget.unknownCostCalls += 1;
      run.dispatchUncertain = false;
      event.status = "completed";
      event.durationMs = Date.now() - started;
      await save();
      return { data, event };
    } catch (error) {
      event.status = "failed";
      event.code = error instanceof ResearchError ? error.code : "OTARI_TRANSPORT_UNCERTAIN";
      event.durationMs = Date.now() - started;
      if (paid) run.budget.unknownCostCalls += 1;
      await save();
      throw error instanceof ResearchError
        ? error
        : new ResearchError(
            "OTARI_TRANSPORT_UNCERTAIN",
            "Otari request interrupted; a charge may have occurred. Automatic replay is disabled.",
          );
    }
  }
  async complete(
    role: "extraction" | "review",
    system: string,
    input: unknown,
    run: ResearchRun,
    save: SaveRun,
    bounds?: { maxOutputTokens: number; reasoningEffort: "low" | "medium" | "high" },
  ) {
    if (
      bounds &&
      (!Number.isSafeInteger(bounds.maxOutputTokens) || bounds.maxOutputTokens < 256 || bounds.maxOutputTokens > 8000)
    )
      throw new ResearchError("OTARI_CONFIGURATION", "Role output bounds are invalid.");
    const policy = this.value(role === "extraction" ? "OTARI_EXTRACTION_POLICY" : "OTARI_REVIEW_POLICY");
    if (!policy)
      throw new ResearchError("OTARI_CONFIGURATION", `Configure the ${role} policy from the hosted catalog.`);
    const { data, event } = await this.request(
      "/chat/completions",
      {
        model: policy,
        stream: false,
        max_tokens: bounds?.maxOutputTokens ?? 8000,
        reasoning_effort: bounds?.reasoningEffort ?? "low",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: run.inferenceContract
              ? `capela_${role}_passages_v1`
              : role === "extraction"
                ? "capela_extraction_v1"
                : "capela_review_v1",
            strict: true,
            schema: roleWireSchema(role, run.inferenceContract),
          },
        },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
      },
      role,
      run,
      save,
    );
    const d = data as { choices?: { finish_reason?: string; message?: { content?: unknown } }[] };
    if (
      !Array.isArray(d.choices) ||
      d.choices.length !== 1 ||
      d.choices[0]?.finish_reason !== "stop" ||
      typeof d.choices[0].message?.content !== "string"
    )
      throw new ResearchError(
        "OTARI_INVALID_COMPLETION",
        "Completion is missing, truncated or has an unsupported shape.",
      );
    const content = d.choices[0].message.content;
    if (content.length > 100000)
      throw new ResearchError("OTARI_INVALID_COMPLETION", "Completion exceeds output bound.");
    // Observed provider+model headers, never the policy alias, establish role identity.
    if (event.model) run.models[role] = event.model;
    run.models.distinct = !!run.models.extraction && !!run.models.review && run.models.extraction !== run.models.review;
    await save();
    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new ResearchError("OTARI_INVALID_JSON", "Model output is not strict JSON. No paid repair is attempted.");
    }
  }
}
function safeHeader(response: Response, name: string) {
  const s = response.headers.get(name);
  return s && /^[\x20-\x7E]{1,200}$/.test(s) && !/bearer|https?:|tk-/i.test(s) ? s : undefined;
}
export async function boundedJson(response: Response, max: number): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new ResearchError("INVALID_RESPONSE", "Empty response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > max) {
      await reader.cancel();
      throw new ResearchError("RESPONSE_LIMIT", "Provider response exceeds its bound.");
    }
    chunks.push(next.value);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ResearchError("INVALID_RESPONSE", "Provider returned invalid JSON.");
  }
}

function knownErrorCode(value: unknown): string | undefined {
  return typeof value === "string" &&
    [
      "budget_exceeded",
      "insufficient_funds",
      "pricing_required",
      "guardrail_blocked",
      "guardrail_violation",
      "invalid_request",
      "provider_not_configured",
      "provider_credential_rejected",
      "model_not_allowed",
    ].includes(value)
    ? value
    : undefined;
}

// Constrain shape on the provider; enforce bounds/patterns again with the full local Zod schema.
export function roleWireSchema(role: "extraction" | "review", contract?: "passage-selection-v1") {
  const full = z.toJSONSchema(
    contract
      ? role === "extraction"
        ? ExtractionSelectionSchema
        : ReviewSelectionSchema
      : role === "extraction"
        ? ExtractionSchema
        : ReviewSchema,
  );
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (
        [
          "$schema",
          "minLength",
          "maxLength",
          "pattern",
          "format",
          "minimum",
          "maximum",
          "minItems",
          "maxItems",
        ].includes(key)
      )
        continue;
      if (key === "const") out.enum = [item];
      else out[key] = strip(item);
    }
    return out;
  };
  return strip(full);
}
