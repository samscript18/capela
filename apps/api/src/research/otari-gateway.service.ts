import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { ResearchRun, RunEvent } from "@capela/shared";
import { ResearchError } from "./provenance";

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
        maxCalls: 16,
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
  ) {
    this.assertConfigured();
    const paid = body !== undefined;
    const amount = this.integer("OTARI_CALL_RESERVATION_MICROUSD", 10000, 100000000);
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
      event.requestId = safeHeader(response, "Otari-Request-ID");
      event.provider = safeHeader(response, "Otari-Provider");
      event.model = safeHeader(response, "Otari-Model");
      const fallback = response.headers.get("Otari-Fallback");
      if (fallback === "true" || fallback === "false") event.fallback = fallback === "true";
      if (!response.ok) {
        const upstreamCode = safeHeader(response, "Otari-Error-Code");
        if (response.status === 402 || upstreamCode === "budget_exceeded" || upstreamCode === "insufficient_funds")
          run.budget.terminal = true;
        throw new ResearchError(
          run.budget.terminal
            ? "OTARI_BUDGET_DENIED"
            : upstreamCode === "guardrail_blocked"
              ? "OTARI_GUARDRAIL_BLOCKED"
              : "OTARI_PROVIDER_ERROR",
          run.budget.terminal
            ? "Otari denied spending. No provider bypass or automatic retry is allowed."
            : `Otari ${operation} failed (HTTP ${response.status}).`,
        );
      }
      const data = await boundedJson(response, 300000);
      const cost = usdMicros((data as { usage?: { cost_usd?: unknown } }).usage?.cost_usd);
      if (paid && cost !== undefined) {
        run.budget.reservedMicrousd -= amount;
        run.budget.reportedMicrousd += cost;
        event.costMicrousd = cost;
        if (cost > amount || run.budget.reportedMicrousd + run.budget.reservedMicrousd > run.budget.capMicrousd)
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
  async complete(role: "extraction" | "review", system: string, input: unknown, run: ResearchRun, save: SaveRun) {
    const policy = this.value(role === "extraction" ? "OTARI_EXTRACTION_POLICY" : "OTARI_REVIEW_POLICY");
    if (!policy)
      throw new ResearchError("OTARI_CONFIGURATION", `Configure the ${role} policy from the hosted catalog.`);
    const { data, event } = await this.request(
      "/chat/completions",
      {
        model: policy,
        stream: false,
        max_tokens: 8000,
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
