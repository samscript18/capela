require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { guardrailMetadata, evaluatedGuardrailRefusal } = require("../dist/research/guardrail-metadata");
const { guardrailRefusalMetadata } = require("../dist/research/guardrail-metadata");
const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
const { ResearchRunSchema, parseStoredResearchRun } = require("@capela/shared");
const { observedBlock: observedVerification } = require("../../../scripts/verify-guardrail-metadata.cjs");
const { VertexReviewService } = require("../dist/research/vertex-review.service");
const { ResearchError } = require("../dist/research/provenance");
const verdict = (extra = {}) => ({
  profile: "capela-prompt-injection-test",
  mode: "block",
  status: "evaluated",
  valid: false,
  score: 0.99,
  ...extra,
});
const gateway = () =>
  new OtariGatewayService({
    get: (k) =>
      ({
        OTARI_API_KEY: "offline-fixture-key",
        OTARI_RUN_BUDGET_MICROUSD: "5000",
        OTARI_RUN_MAX_CALLS: "1",
        OTARI_CALL_RESERVATION_MICROUSD: "5000",
      })[k],
  });

test("documented verdict parser bounds input and strips profiles, explanations, credentials and payload", () => {
  const raw = JSON.stringify([
    verdict({
      profile: "private@example.test",
      explanation: "source text and Bearer secret",
      payload: { api_key: "credential" },
      vendorRequestId: "untrusted-id",
      score: "credential",
    }),
  ]);
  const parsed = guardrailMetadata(raw);
  assert.equal(parsed.state, "valid");
  assert.equal(parsed.results[0].profileHash, createHash("sha256").update("private@example.test").digest("hex"));
  assert.deepEqual(Object.keys(parsed.results[0]).sort(), ["mode", "profileHash", "status", "valid"]);
  for (const text of ["private@example.test", "source text", "Bearer", "credential", "untrusted-id"])
    assert.equal(JSON.stringify(parsed).includes(text), false);
  assert.equal(guardrailMetadata("x".repeat(8193)).state, "oversized");
  assert.equal(guardrailMetadata("é".repeat(4097)).state, "oversized");
  assert.equal(guardrailMetadata(JSON.stringify(Array(9).fill(verdict()))).state, "malformed");
  assert.equal(guardrailMetadata(null), undefined);
  for (const raw of [
    "not JSON",
    "{}",
    JSON.stringify([verdict({ valid: "false" })]),
    JSON.stringify([verdict({ status: "evaluated", valid: null })]),
    JSON.stringify([verdict({ status: "unavailable", valid: false })]),
    JSON.stringify([verdict({ mode: "unknown" })]),
    JSON.stringify([verdict({ reason: "source text" })]),
  ])
    assert.equal(guardrailMetadata(raw).state, "malformed");
});

test("missing, empty, unavailable, inconclusive and monitor verdicts never prove a blocking evaluation", () => {
  for (const raw of [
    null,
    "[]",
    JSON.stringify([verdict({ status: "unavailable", valid: null, reason: "evaluation_failed" })]),
    JSON.stringify([verdict({ status: "inconclusive", valid: null })]),
    JSON.stringify([verdict({ mode: "monitor" })]),
    JSON.stringify([verdict({ valid: true })]),
  ]) {
    const event = {
      requestId: "fixture-request",
      httpStatus: 403,
      upstreamCode: "guardrail_violation",
      guardrails: guardrailMetadata(raw),
    };
    assert.equal(evaluatedGuardrailRefusal(event), false);
  }
});

test("direct compatibility fallback cannot bypass present, unavailable or malformed Otari protection", () => {
  const v = new VertexReviewService({ get: (k) => (k === "OTARI_REVIEW_FALLBACK" ? "vertex" : undefined) });
  for (const raw of [
    JSON.stringify([verdict()]),
    JSON.stringify([verdict({ status: "unavailable", valid: null, reason: "evaluation_failed" })]),
    JSON.stringify([verdict({ status: "inconclusive", valid: null })]),
    "malformed",
  ]) {
    const run = gateway().createRun("guarded-transient");
    run.events = [
      {
        sequence: 1,
        at: new Date().toISOString(),
        operation: "review",
        status: "failed",
        correlationId: "fixture",
        httpStatus: 502,
        guardrails: guardrailMetadata(raw),
      },
    ];
    for (const code of ["OTARI_PROVIDER_ERROR", "OTARI_UPSTREAM_TIMEOUT", "OTARI_TRANSPORT_UNCERTAIN"])
      assert.equal(v.canFallback(new ResearchError(code, "Fixture"), run), false);
  }
});

test("same-response explicit refusal retains sanitized verdict with request identity and storage compatibility", async (t) => {
  t.mock.method(global, "fetch", async () =>
    Response.json(
      { error: { code: "guardrail_violation", message: "do not store this" } },
      {
        status: 403,
        headers: { "Otari-Request-ID": "fixture-request", "Otari-Guardrails": JSON.stringify([verdict()]) },
      },
    ),
  );
  const g = gateway(),
    run = g.createRun("fixture-run");
  await assert.rejects(
    g.request("/chat/completions", { model: "fixture-policy" }, "extraction", run, async () => {}),
    { code: "OTARI_GUARDRAIL_BLOCKED" },
  );
  assert.equal(evaluatedGuardrailRefusal(run.events[0]), true);
  assert.equal(run.events[0].requestId, "fixture-request");
  assert.equal(run.budget.calls, 1);
  assert.equal(run.budget.unknownCostCalls, 1);
  assert.equal(run.budget.reservedMicrousd, 5000);
  assert.equal(JSON.stringify(run).includes("do not store"), false);
  assert.doesNotThrow(() => ResearchRunSchema.parse(run));
  assert.deepEqual(parseStoredResearchRun(JSON.parse(JSON.stringify(run))).events, run.events);
  delete run.events[0].guardrails;
  assert.doesNotThrow(() => parseStoredResearchRun(run));
});

test("budget/authentication and bare 403 cannot be classified as evaluated guardrail refusals", async (t) => {
  for (const [status, code] of [
    [403, "budget_exceeded"],
    [401, "invalid_request"],
    [403, undefined],
  ])
    await t.test(String(code), async (t) => {
      let calls = 0;
      t.mock.method(global, "fetch", async () => {
        calls++;
        return Response.json(code ? { code } : { detail: "credential must not be stored" }, {
          status,
          headers: { "Otari-Request-ID": "fixture-denial", "Otari-Guardrails": JSON.stringify([verdict()]) },
        });
      });
      const g = gateway(),
        run = g.createRun("denial");
      await assert.rejects(g.request("/chat/completions", {}, "extraction", run, async () => {}));
      assert.equal(evaluatedGuardrailRefusal(run.events[0]), false);
      assert.equal(calls, 1);
      assert.equal(JSON.stringify(run).includes("credential must"), false);
      if (code === "budget_exceeded") assert.equal(run.budget.terminal, true);
    });
});

test("explicit code without evaluated metadata or request ID remains insufficient", () => {
  const e = {
    httpStatus: 403,
    upstreamCode: "guardrail_violation",
    requestId: "fixture",
    guardrails: guardrailMetadata(JSON.stringify([verdict()])),
  };
  assert.equal(evaluatedGuardrailRefusal(e), true);
  assert.equal(observedVerification({ events: [e] }, { code: "OTARI_GUARDRAIL_BLOCKED" }), true);
  assert.equal(
    observedVerification(
      { events: [{ ...e, guardrails: guardrailMetadata(JSON.stringify([verdict({ profile: "another-profile" })])) }] },
      { code: "OTARI_GUARDRAIL_BLOCKED" },
    ),
    false,
  );
  assert.equal(evaluatedGuardrailRefusal({ ...e, guardrails: undefined }), false);
  assert.equal(evaluatedGuardrailRefusal({ ...e, requestId: undefined }), false);
  assert.equal(evaluatedGuardrailRefusal({ ...e, httpStatus: 502 }), false);
  assert.equal(evaluatedGuardrailRefusal({ ...e, upstreamCode: "budget_exceeded" }), false);
});

test("official FastAPI refusal envelope binds evaluated block metadata while redacting free text", async (t) => {
  for (const header of [false, true])
    await t.test(String(header), async (t) => {
      t.mock.method(global, "fetch", async () =>
        Response.json(
          {
            detail: {
              code: "guardrail_violation",
              message: "private source text",
              guardrails: [
                {
                  profile: "private@example.test",
                  explanation: "Bearer vendor-secret",
                  score: 0.95,
                  payload: { text: "private" },
                },
              ],
            },
          },
          {
            status: 403,
            headers: {
              "Otari-Request-ID": "fixture-body-request",
              ...(header ? { "Otari-Error-Code": "guardrail_violation" } : {}),
            },
          },
        ),
      );
      const g = gateway(),
        run = g.createRun("body-refusal");
      await assert.rejects(
        g.request("/chat/completions", {}, "extraction", run, async () => {}),
        { code: "OTARI_GUARDRAIL_BLOCKED" },
      );
      assert.equal(evaluatedGuardrailRefusal(run.events[0]), true);
      assert.equal(run.events[0].guardrails.source, "error.detail.guardrails");
      for (const s of ["private@example.test", "vendor-secret", "private source text"])
        assert.equal(JSON.stringify(run).includes(s), false);
    });
  for (const body of [
    { detail: { code: "budget_exceeded", guardrails: [{ profile: "example" }] } },
    { detail: { code: "guardrail_violation" } },
    { detail: { code: "guardrail_violation", guardrails: [] } },
  ])
    assert.notEqual(guardrailRefusalMetadata(body, 403)?.state, "valid");
  assert.equal(
    guardrailRefusalMetadata({ detail: { code: "guardrail_violation", guardrails: [{ profile: "example" }] } }, 401),
    undefined,
  );
});
