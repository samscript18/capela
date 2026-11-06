require("reflect-metadata");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const recorded = require("../../../evaluation/passage-live-verification.json").application;
const { decide, referenceValid } = require("../dist/research/provenance");
const { createPublicationHold, publicationDecisions } = require("../dist/research/publication-policy");
const { applyRecordedSourceAssessments } = require("../dist/research/publication-policy");
const { revisePublication } = require("../dist/research/publication-revision");
const { parseStoredResearchRun } = require("@capela/shared");
function original() {
  return {
    status: recorded.status,
    research: {
      version: "otari-evidence-v1",
      runId: "recorded-exact-regression",
      inferenceContract: "passage-selection-v1",
      snapshots: structuredClone(recorded.snapshots),
      decisions: structuredClone(recorded.decisions),
      models: structuredClone(recorded.models),
      budget: structuredClone(recorded.budget),
      events: structuredClone(recorded.events),
      audit: structuredClone(recorded.audit),
      limitations: structuredClone(recorded.limitations),
    },
    molecule: structuredClone(recorded.dossier.overview.molecule),
    papers: structuredClone(recorded.dossier.literature.items),
    evidence: structuredClone(recorded.evidence),
  };
}
const at = "2026-11-06T17:00:00.000Z";
const reason =
  "The added clause ‘a key regulator of inflammation and cell survival’ is not stated by the selected passage; withhold the complete finding pending adequate support.";
test("recorded source assessment automatically withholds an exact recurrence across runs and reviewer wording", () => {
  const run = original().research;
  run.runId = "new-run-exact-recurrence";
  run.decisions[1].candidate.id = "new-claim-id";
  run.decisions[1].review.claimId = "new-claim-id";
  run.decisions[1].review.reason = "New independent reviewer still missed the extra clause.";
  run.decisions[1].candidate.spans = run.decisions[1].candidate.spans.map((span) =>
    Object.fromEntries(Object.entries(span).reverse()),
  ); // Persistence field order cannot disable an otherwise identical assessment.
  applyRecordedSourceAssessments(run, at);
  applyRecordedSourceAssessments(run, at);
  assert.equal(run.publicationHolds.length, 1);
  assert.equal(run.publicationHolds[0].actor, "recorded_source_assessment");
  assert.equal(run.publicationHolds[0].assessmentRecordedAt, "2026-11-06T16:17:22.789Z");
  assert.equal(run.publicationHolds[0].originalRunId, run.runId);
  const decisions = publicationDecisions(run);
  assert.equal(decisions[0].status, "accepted");
  assert.equal(decisions[1].status, "unresolved");
  assert.equal(decisions[1].publishedFinding, undefined);
  assert.equal(decisions[1].review.verdict, "supported");
  assert.match(decisions[1].reason, /not detected by the model reviewer/);
  assert.doesNotThrow(() => parseStoredResearchRun(run));
  const repeated = original().research;
  repeated.runId = "actual-second-output-offline-replay";
  repeated.decisions = structuredClone(
    require("../../../evaluation/isolated-routing-verification.json").originalModelAssistedDecisions,
  );
  applyRecordedSourceAssessments(repeated, at);
  assert.equal(publicationDecisions(repeated)[1].status, "unresolved");
  assert.equal(repeated.publicationHolds[0].actor, "recorded_source_assessment");
});
test("recorded assessment is source/finding/passage specific and does not pretend to grade novel claims", () => {
  for (const change of [
    (r) => (r.decisions[1].candidate.finding += " (different wording)"),
    (r) => (r.snapshots[0].parserVersion = "different-parser"),
    (r) => {
      r.decisions[1].candidate.spans = [r.decisions[0].candidate.spans[0]];
    },
    (r) => (r.snapshots[0].hash = "0".repeat(64)),
  ]) {
    const run = original().research;
    change(run);
    applyRecordedSourceAssessments(run, at);
    assert.equal(run.publicationHolds?.length ?? 0, 0);
  }
  const run = original().research;
  applyRecordedSourceAssessments(run, at);
  run.decisions[1].review.reason += " altered after binding";
  assert.throws(() => publicationDecisions(run), { code: "STALE_PUBLICATION_HOLD" });
});
test("controlled recovery requires an actual output-limit refusal, never a budget or unrelated error", () => {
  const { isOutputLimitRefusal } = require("../../../scripts/verify-controlled-recovery.cjs");
  assert.equal(isOutputLimitRefusal(400, { error: { message: "max_tokens must be at most 16384" } }), true);
  for (const [status, body] of [
    [403, { error: { message: "max_tokens must be at most 16384" } }],
    [400, { error: { message: "Invalid response_format" } }],
    [400, { error: { message: "max_tokens must be at most 8192" } }],
    [400, { error: { message: 16384 } }],
    [200, {}],
  ])
    assert.equal(isOutputLimitRefusal(status, body), false);
  const { spawnSync } = require("node:child_process");
  const p = spawnSync(
    process.execPath,
    [require("node:path").resolve(__dirname, "../../../scripts/verify-credential-recovery.cjs")],
    {
      cwd: require("node:os").tmpdir(),
      encoding: "utf8",
      env: { ...process.env, OTARI_CEILING_TEST_API_KEY: "test-only-placeholder" },
    },
  );
  assert.equal(p.status, 2);
  assert.equal(JSON.parse(p.stdout).requestsSent, 0);
});
test("recovery identity uses exact catalogued provider/model spellings without collapsing scientific roles", () => {
  const { canonicalRoleModel } = require("../../../scripts/verify-credential-recovery.cjs");
  const event = { provider: "ovhcloud", model: "gpt-oss-20b" };
  assert.equal(canonicalRoleModel("extraction", event), "openai/gpt-oss-20b");
  assert.equal(event.model, "gpt-oss-20b");
  assert.equal(canonicalRoleModel("review", event), undefined);
  assert.equal(canonicalRoleModel("extraction", { provider: "other", model: "openai/gpt-oss-20b" }), undefined);
  assert.equal(
    canonicalRoleModel("review", { provider: "deepinfra", model: "openai/gpt-oss-120b" }),
    "openai/gpt-oss-120b",
  );
});
test("production publication gate withholds the recurrence before claim assembly and sandbox auditing", async () => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const { OtariEvidenceService } = require("../dist/research/otari-evidence.service");
  const { EvidenceClassifierService } = require("../dist/research/evidence-classifier.service");
  const { localAudit } = require("../dist/research/evidence-audit");
  const { selectionCandidate, selectionReview } = require("./passage-fixtures");
  const g = new OtariGatewayService({ get: () => undefined });
  const run = g.createRun("automatic-publication-fixture");
  run.snapshots = structuredClone(recorded.snapshots);
  const source = run.snapshots[0];
  g.complete = async (role) => {
    run.models[role] = role === "extraction" ? "fixture-20b" : "fixture-120b";
    run.models.distinct = !!run.models.review;
    run.events.push({
      sequence: run.events.length + 1,
      at,
      operation: role,
      status: "completed",
      correlationId: `fixture-${role}`,
      model: run.models[role],
    });
    return role === "extraction"
      ? {
          version: "passage-selection-v1",
          papers: [
            {
              paperId: source.paperId,
              limitations: [],
              claims: recorded.decisions.map((d) => selectionCandidate(d.candidate, source)),
            },
          ],
        }
      : { version: "passage-selection-v1", reviews: recorded.decisions.map((d) => selectionReview(d.review, source)) };
  };
  g.request = async (path) => {
    assert.equal(path, "/code/execute");
    assert.equal(run.decisions[1].status, "unresolved");
    assert.equal(run.publicationHolds[0].actor, "recorded_source_assessment");
    return {
      data: {
        return_code: 0,
        stderr: "",
        stdout: JSON.stringify(localAudit([recorded.decisions[0].candidate], run.snapshots)),
      },
      event: {},
    };
  };
  const result = await new OtariEvidenceService(g, new EvidenceClassifierService()).extract(
    recorded.dossier.literature.items,
    recorded.dossier.overview.molecule,
    run,
    async () => {},
  );
  assert.equal(result.claims.length, 1);
  assert.equal(result.claims[0].id, recorded.decisions[0].candidate.id);
  assert.equal(run.audit.accepted, 1);
  assert.equal(run.decisions[1].review.verdict, "supported");
});
test("exact recorded finding/passage/review explains original acceptance without claiming failed model checks", () => {
  const o = original(),
    d = o.research.decisions[1];
  assert.equal(
    d.candidate.finding,
    "Curcumin inhibits nuclear factor kappa B (NF‑κB) activity, which is a key regulator of inflammation and cell survival",
  );
  assert.equal(d.review.verdict, "supported");
  assert.ok(Object.values(d.review.checks).every(Boolean));
  assert.ok(referenceValid(d.candidate, o.research.snapshots));
  assert.equal(decide(d.candidate, d.review, o.research.snapshots).status, "accepted");
  assert.ok(!d.review.spans[0].quote.includes("cell survival"));
});
test("exact spans never override unsupported, uncertain or failed support checks", () => {
  const o = original(),
    d = o.research.decisions[1];
  for (const review of [
    { ...d.review, verdict: "unsupported" },
    { ...d.review, verdict: "uncertain" },
    { ...d.review, checks: { ...d.review.checks, sourceLimitations: false } },
  ]) {
    assert.ok(referenceValid(d.candidate, o.research.snapshots));
    const outcome = decide(d.candidate, review, o.research.snapshots);
    assert.ok(["rejected", "unresolved"].includes(outcome.status));
    assert.equal(outcome.publishedFinding, undefined);
  }
});
test("evidence-bound post-run support hold overrides valid spans and original supported verdict", () => {
  const o = original(),
    before = JSON.stringify(o),
    hold = createPublicationHold(
      o.research,
      o.research.decisions[1].candidate.id,
      reason,
      "assistant_source_inspection",
      at,
    );
  const r = revisePublication(o, [hold], at, "test-implementation");
  assert.equal(r.research.decisions[0].status, "accepted");
  assert.equal(r.research.decisions[1].status, "unresolved");
  assert.equal(r.research.decisions[1].publishedFinding, undefined);
  assert.deepEqual(r.research.decisions[1].candidate, o.research.decisions[1].candidate);
  assert.deepEqual(r.research.decisions[1].review, o.research.decisions[1].review);
  assert.equal(r.evidence.length, 1);
  assert.equal(r.dossier.literature.items[0].extractedFindings.length, 1);
  assert.equal(r.research.audit.accepted, 1);
  assert.equal(r.research.audit.remote, false);
  assert.deepEqual(r.research.publicationRevision.originalAudit, o.research.audit);
  assert.deepEqual(r.research.events, o.research.events);
  assert.deepEqual(r.research.budget, o.research.budget);
  assert.equal(r.research.publicationRevision.provenance, "post-run-source-inspection; no new inference");
  assert.equal(JSON.stringify(o), before);
  assert.ok(parseStoredResearchRun(JSON.parse(JSON.stringify(r.research))));
});
test("hold binding rejects changed source, finding, review, run or stale identifiers", () => {
  const o = original(),
    hold = createPublicationHold(
      o.research,
      o.research.decisions[1].candidate.id,
      reason,
      "assistant_source_inspection",
      at,
    );
  for (const field of ["snapshotHash", "findingHash", "reviewHash", "originalRunId", "claimId"]) {
    const changed = { ...hold, [field]: field.endsWith("Hash") ? "0".repeat(64) : "stale" };
    assert.throws(() => publicationDecisions({ ...o.research, publicationHolds: [changed] }), {
      code: "STALE_PUBLICATION_HOLD",
    });
  }
  assert.throws(() => publicationDecisions({ ...o.research, publicationHolds: [hold, hold] }), {
    code: "INVALID_PUBLICATION_HOLD",
  });
});
test("support holds are explicit assessments, not keyword entailment rules or model corrections", () => {
  const o = original();
  assert.equal(publicationDecisions(o.research)[1].status, "accepted");
  const hold = createPublicationHold(
    o.research,
    o.research.decisions[0].candidate.id,
    "Separate source-inspection concern",
    "owner_source_inspection",
    at,
  );
  const decisions = publicationDecisions({ ...o.research, publicationHolds: [hold] });
  assert.equal(decisions[0].status, "unresolved");
  assert.equal(decisions[1].status, "accepted");
  assert.equal(decisions[0].review.revisedFinding, null);
});

test("hosted monetary-denial adapter retains budget scope and blocks every later dispatch", async (t) => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return Response.json(
      { error: { code: "budget_exceeded" } },
      {
        status: 403,
        headers: {
          "Otari-Error-Code": "budget_exceeded",
          "Otari-Budget-Scope": "api_key",
          "Otari-Request-ID": "fixture-budget-denial",
        },
      },
    );
  });
  const g = new OtariGatewayService({
      get: (k) => ({ OTARI_API_KEY: "fixture-only", OTARI_RUN_BUDGET_MICROUSD: "10000" })[k],
    }),
    run = g.createRun("controlled-denial-fixture");
  await assert.rejects(
    g.request("/chat/completions", {}, "controlled_ceiling_denial", run, async () => {}),
    { code: "OTARI_BUDGET_DENIED" },
  );
  assert.equal(run.events[0].budgetScope, "api_key");
  assert.equal(run.budget.terminal, true);
  await assert.rejects(
    g.request("/chat/completions", {}, "must-not-dispatch", run, async () => {}),
    { code: "RUN_BUDGET_EXHAUSTED" },
  );
  assert.equal(calls, 1);
});

test("controlled check commands refuse missing isolated configuration without a second spending pool", () => {
  const { spawnSync } = require("node:child_process"),
    fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "capela-controlled-ready-"));
  try {
    for (const mode of ["routing", "ceiling"]) {
      const p = spawnSync(
        process.execPath,
        [path.resolve(__dirname, "../../../scripts/controlled-hosted-checks.cjs"), mode],
        {
          cwd: dir,
          encoding: "utf8",
          env: { ...process.env, OTARI_ROUTING_TEST_API_KEY: "", OTARI_CEILING_TEST_API_KEY: "" },
        },
      );
      assert.equal(p.status, 2);
      const output = JSON.parse(p.stdout);
      assert.equal(output.requestsSent, 0);
      assert.equal(output.status, "blocked");
      assert.equal(fs.existsSync(path.join(dir, ".local-evaluation")), false);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("one-cent hosted ceiling can refuse a priced hold under a separate two-cent single-call allocation", () => {
  const { controlledAllocationCap } = require("../../../scripts/controlled-hosted-checks.cjs");
  const settings = { hostedLimitMicrousd: 10000, requestHoldMicrousd: 12288, maxOutputTokens: 4096 };
  assert.equal(controlledAllocationCap("ceiling", settings), 20000);
  for (const patch of [
    { requestHoldMicrousd: 10000 },
    { requestHoldMicrousd: 20001 },
    { hostedLimitMicrousd: 0 },
    { maxOutputTokens: 4097 },
    { maxOutputTokens: undefined },
  ])
    assert.equal(controlledAllocationCap("ceiling", { ...settings, ...patch }), undefined);
  assert.equal(controlledAllocationCap("routing", { requestHoldMicrousd: 10001 }), undefined);
});
test("isolated routing check refuses the working key before ledger access and validates complete source coverage", () => {
  const { spawnSync } = require("node:child_process"),
    path = require("node:path");
  const p = spawnSync(process.execPath, [path.resolve(__dirname, "../../../scripts/verify-isolated-routing.cjs")], {
    cwd: require("node:os").tmpdir(),
    encoding: "utf8",
    env: { ...process.env, OTARI_API_KEY: "same-test-fixture", OTARI_CEILING_TEST_API_KEY: "same-test-fixture" },
  });
  assert.equal(p.status, 2);
  assert.equal(JSON.parse(p.stdout).requestsSent, 0);
  const { verifySelection } = require("../../../scripts/verify-isolated-routing.cjs");
  const { selectionCandidate } = require("./passage-fixtures");
  const source = recorded.snapshots[0],
    candidate = recorded.decisions[0].candidate;
  const output = {
    version: "passage-selection-v1",
    papers: [{ paperId: source.paperId, claims: [selectionCandidate(candidate, source)], limitations: [] }],
  };
  assert.equal(verifySelection(output, [source], source.paperId)[0].spans[0].quote, candidate.spans[0].quote);
  assert.throws(() => verifySelection(output, [source], "wrong-paper"));
  assert.throws(() =>
    verifySelection({ ...output, papers: [...output.papers, ...output.papers] }, [source], source.paperId),
  );
});
