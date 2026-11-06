require("reflect-metadata");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const recorded = require("../../../evaluation/passage-live-verification.json").application;
const { decide, referenceValid } = require("../dist/research/provenance");
const { createPublicationHold, publicationDecisions } = require("../dist/research/publication-policy");
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
