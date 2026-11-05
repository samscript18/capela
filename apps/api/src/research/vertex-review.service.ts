import { CAPELA_GEMINI_MODEL, isPinnedGeminiVersion } from "./gemini-model";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { randomUUID } from "node:crypto";
import { ReviewSchema, type ResearchRun, type RunEvent } from "@capela/shared";
import { reserve, roleWireSchema, type SaveRun } from "./otari-gateway.service";
import { ResearchError, strictOutput } from "./provenance";

// This is a direct Google Cloud call. It never represents hosted Otari execution.
@Injectable()
export class VertexReviewService {
  private client?: GoogleGenAI;
  constructor(private readonly config: ConfigService) {}
  enabled() {
    return this.config.get<string>("OTARI_REVIEW_FALLBACK") === "vertex";
  }
  canFallback(error: unknown, run: ResearchRun) {
    if (!this.enabled() || run.budget.terminal || !(error instanceof ResearchError)) return false;
    return (
      ["OTARI_UPSTREAM_TIMEOUT", "OTARI_TRANSPORT_UNCERTAIN"].includes(error.code) ||
      (error.code === "OTARI_PROVIDER_ERROR" && [502, 503, 504].includes(run.events.at(-1)?.httpStatus ?? 0))
    );
  }
  async review(system: string, input: unknown, run: ResearchRun, save: SaveRun, maxOutputTokens: number) {
    if (!this.enabled()) throw new ResearchError("VERTEX_NOT_CONFIGURED", "Vertex review fallback is disabled.");
    const configuredOutput = Number(this.config.get<string>("GEMINI_MAX_OUTPUT_TOKENS") || 8000);
    if (!Number.isSafeInteger(configuredOutput) || configuredOutput < 256)
      throw new ResearchError("VERTEX_CONFIGURATION", "GEMINI_MAX_OUTPUT_TOKENS must be an integer of at least 256.");
    const model = this.config.get<string>("GEMINI_MODEL")?.trim() || CAPELA_GEMINI_MODEL;
    if (model !== CAPELA_GEMINI_MODEL)
      throw new ResearchError(
        "VERTEX_CONFIGURATION",
        `Only ${CAPELA_GEMINI_MODEL} is allowed for Vertex. No lower-model fallback is permitted.`,
      );
    const apiKey =
      this.config.get<string>("GOOGLE_CLOUD_API_KEY")?.trim() || this.config.get<string>("GOOGLE_API_KEY")?.trim();
    const project = this.config.get<string>("GOOGLE_CLOUD_PROJECT")?.trim();
    if (!model || (!apiKey && !project))
      throw new ResearchError(
        "VERTEX_NOT_CONFIGURED",
        "Configure the existing Google Cloud credentials and GEMINI_MODEL for Vertex review.",
      );
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 8000)
      throw new ResearchError("VERTEX_CONFIGURATION", "Invalid review output bound.");
    if (!this.client)
      this.client = new GoogleGenAI(
        apiKey
          ? { vertexai: true, apiKey }
          : {
              vertexai: true,
              project,
              location: this.config.get<string>("GOOGLE_CLOUD_LOCATION")?.trim() || "global",
            },
      );
    if (run.events.length >= 100) throw new ResearchError("RUN_EVENT_LIMIT", "Run event bound reached.");
    // Unknown external cost retains a conservative $0.10 reservation; it is not Otari credit.
    reserve(run, 100000);
    const event: RunEvent = {
      sequence: run.events.length + 1,
      at: new Date().toISOString(),
      operation: "vertex_review",
      status: "started",
      correlationId: randomUUID(),
      provider: "vertex-ai",
      fallback: true,
    };
    if (input && typeof input === "object" && "expectedClaimIds" in input && Array.isArray(input.expectedClaimIds))
      event.claimIds = input.expectedClaimIds
        .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200)
        .slice(0, 60);
    run.events.push(event);
    run.limitations.push(
      "Hybrid review: Vertex AI is called directly and billed by Google separately from Otari credits. This run is not fully hosted through Otari. Vertex USD cost is unreported; its $0.10 estimated reservation remains counted.",
    );
    const priorUncertainty = run.dispatchUncertain === true;
    run.dispatchUncertain = true;
    await save(); // Fence and persist before the external dispatch.
    const started = Date.now();
    let dispatched = false;
    try {
      dispatched = true;
      const response = await this.client.models.generateContent({
        model,
        contents: JSON.stringify(input),
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: roleWireSchema("review"),
          temperature: 0,
          maxOutputTokens: Math.min(maxOutputTokens, configuredOutput, 8000),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: AbortSignal.timeout(90000),
          httpOptions: { retryOptions: { attempts: 1 } },
        },
      });
      // Save bounded response metadata, never source text, prompts or the generated response.
      const text = response.text;
      const safeCode = (value: unknown) =>
        typeof value === "string" && /^[A-Z_]{1,100}$/.test(value) ? value : "UNKNOWN";
      event.candidateCount = response.candidates?.length ?? 0;
      event.finishReason = response.candidates?.[0]?.finishReason
        ? safeCode(response.candidates[0].finishReason)
        : "MISSING";
      event.outputCharacters = typeof text === "string" ? text.length : 0;
      if (response.promptFeedback?.blockReason) event.blockReason = safeCode(response.promptFeedback.blockReason);
      for (const [key, value] of [
        ["inputTokens", response.usageMetadata?.promptTokenCount],
        ["outputTokens", response.usageMetadata?.candidatesTokenCount],
        ["thoughtTokens", response.usageMetadata?.thoughtsTokenCount],
      ] as const)
        if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) event[key] = value;
      const observed = response.modelVersion;
      if (observed && /^[a-zA-Z0-9._:/-]{1,180}$/.test(observed)) event.model = observed;
      if (response.responseId && /^[a-zA-Z0-9._:/-]{1,200}$/.test(response.responseId))
        event.requestId = response.responseId;
      if (event.finishReason === "MAX_TOKENS")
        throw new ResearchError(
          "VERTEX_OUTPUT_TRUNCATED",
          `Vertex review reached its output limit (${event.outputCharacters} characters; ${event.outputTokens ?? "unknown"} output tokens, ${event.thoughtTokens ?? "unknown"} thinking tokens). Incomplete JSON was not accepted; no automatic replay was attempted.`,
        );
      if (
        (event.blockReason &&
          !["BLOCK_REASON_UNSPECIFIED", "BLOCKED_REASON_UNSPECIFIED"].includes(event.blockReason)) ||
        ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "MODEL_ARMOR"].includes(event.finishReason)
      )
        throw new ResearchError(
          "VERTEX_REVIEW_BLOCKED",
          `Vertex blocked review (${event.blockReason ?? event.finishReason}). No retry or provider bypass was attempted.`,
        );
      if (event.candidateCount !== 1 || event.finishReason !== "STOP")
        throw new ResearchError(
          "VERTEX_INVALID_COMPLETION",
          `Vertex returned ${event.candidateCount} candidates with finish reason ${event.finishReason}. No automatic replay was attempted.`,
        );
      if (typeof text !== "string" || text.length === 0)
        throw new ResearchError(
          "VERTEX_EMPTY_COMPLETION",
          "Vertex returned no review text despite a STOP finish reason. No automatic replay was attempted.",
        );
      if (text.length > 100000)
        throw new ResearchError("VERTEX_RESPONSE_LIMIT", "Vertex review exceeded the response size limit.");
      if (!event.model || !isPinnedGeminiVersion(event.model))
        throw new ResearchError(
          "VERTEX_MODEL_UNVERIFIED",
          "Vertex did not confirm gemini-3.8-flash as the resolved model. The response was not accepted.",
        );
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new ResearchError("VERTEX_INVALID_JSON", "Vertex review is not valid JSON.");
      }
      const parsed = strictOutput(ReviewSchema, data);
      event.status = "completed";
      run.models.review = event.model;
      run.models.distinct = !!run.models.extraction && run.models.extraction !== event.model;
      run.dispatchUncertain = priorUncertainty;
      return parsed;
    } catch (error) {
      event.status = "failed";
      const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
      if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599)
        event.httpStatus = status;
      const failure =
        error instanceof ResearchError
          ? error
          : status === 404
            ? new ResearchError(
                "VERTEX_MODEL_UNAVAILABLE",
                "The configured Vertex model is unavailable. Check GEMINI_MODEL and its availability for this Google Cloud account.",
              )
            : status === 401 || status === 403
              ? new ResearchError(
                  "VERTEX_AUTHORIZATION_DENIED",
                  "Google Cloud refused Vertex access. Check the existing credentials and model permissions; no automatic retry was attempted.",
                )
              : status === 429
                ? new ResearchError(
                    "VERTEX_RATE_LIMITED",
                    "Vertex refused the request because of a quota or rate limit. No automatic retry was attempted.",
                  )
                : new ResearchError(
                    "VERTEX_REVIEW_UNAVAILABLE",
                    "Vertex review failed or timed out; its reservation remains counted. No automatic replay was attempted.",
                  );
      event.code = failure.code;
      throw failure;
    } finally {
      if (dispatched) run.budget.unknownCostCalls += 1;
      event.durationMs = Date.now() - started;
      await save();
    }
  }
}
