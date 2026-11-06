require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Types } = require("mongoose");
const { InvestigationRunnerService } = require("../dist/research/investigation-runner.service");
const { InvestigationsService } = require("../dist/investigations/investigations.service");
const query = (value) => ({
  lean() {
    return this;
  },
  select() {
    return this;
  },
  limit() {
    return this;
  },
  exec: async () => value,
});
const user = { _id: new Types.ObjectId() };
function service(model) {
  return new InvestigationsService(
    model,
    { ensureUser: async () => user },
    { get: () => undefined },
    { run: async () => {} },
    {},
  );
}
test("get/source/event/dossier access uses verified owner and hides lease authority", async () => {
  let filter;
  const record = {
    _id: new Types.ObjectId(),
    userId: user._id,
    status: "failed",
    leaseToken: "private-fence",
    leaseExpiresAt: new Date(),
    research: { snapshots: [], events: [] },
  };
  const s = service({
    findOne: (f) => {
      filter = f;
      return query(record);
    },
  });
  const result = await s.get("verified-privy-owner", record._id.toString());
  assert.deepEqual(filter.userId, user._id);
  assert.equal(result.leaseToken, undefined);
  assert.equal(result.leaseExpiresAt, undefined);
  assert.ok(result.research);
});
test("cross-owner missing record cannot read embedded snapshots/events/dossier", async () => {
  const s = service({
    findOne: (f) => {
      assert.deepEqual(f.userId, user._id);
      return query(null);
    },
  });
  await assert.rejects(s.get("verified-owner", new Types.ObjectId().toString()), /not found/);
});
test("cancellation is owner-scoped and atomically removes the writer fence", async () => {
  let filter, update;
  const s = service({
    findOneAndUpdate: (f, u) => {
      filter = f;
      update = u;
      return query({ status: "failed" });
    },
  });
  await s.cancel("verified-owner", new Types.ObjectId().toString());
  assert.deepEqual(filter.userId, user._id);
  assert.ok(filter.status.$in.includes("extracting_evidence"));
  assert.equal(update.$unset.leaseToken, 1);
  assert.equal(update.$set.error.code, "RUN_CANCELLED");
});
test("paid attempts cannot reset budget or snapshots on retry", async () => {
  let writes = 0;
  const s = service({
    findOne: () => query({ status: "failed", research: { budget: { calls: 1 } } }),
    findOneAndUpdate: () => {
      writes++;
      return query({});
    },
  });
  await assert.rejects(s.retry("verified-owner", new Types.ObjectId().toString()), /Saved budget data/);
  assert.equal(writes, 0);
});
test("explicit extraction retry retains sources and budget, is owner-scoped and atomically queues", async () => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const { canRetryExtraction } = require("@capela/shared");
  const run = new OtariGatewayService({ get: () => undefined }).createRun("retained-run");
  run.budget.capMicrousd = 100000;
  run.budget.reservedMicrousd = 10000;
  run.budget.calls = 4;
  const { snapshot } = require("../dist/research/provenance");
  run.snapshots = [snapshot("123", "https://pubmed.ncbi.nlm.nih.gov/123/", "Synthetic abstract.")];
  run.events = [
    {
      sequence: 1,
      at: new Date().toISOString(),
      correlationId: "fixture",
      operation: "extraction",
      status: "completed",
    },
  ];
  assert.equal(canRetryExtraction(run, ["123"]), true);
  for (const altered of [
    { ...run, dispatchUncertain: true },
    { ...run, budget: { ...run.budget, terminal: true } },
    { ...run, checkpoint: "extracted" },
    { ...run, events: [{ operation: "review", status: "completed" }] },
    { ...run, snapshots: [] },
  ])
    assert.equal(canRetryExtraction(altered, ["123"]), false);
  const record = {
    _id: new Types.ObjectId(),
    status: "failed",
    access: { type: "free" },
    molecule: {},
    papers: [{ id: "123" }],
    research: run,
  };
  let update, filter;
  const s = service({
    findOne: () => query(record),
    exists: async () => false,
    findOneAndUpdate: (f, u) => {
      filter = f;
      update = u;
      return query({ ...record, id: record._id.toString() });
    },
  });
  await s.retry("verified-owner", record._id.toString());
  assert.equal(filter.status, "failed");
  assert.deepEqual(filter.userId, user._id);
  for (const field of ["research", "molecule", "papers"]) assert.equal(update.$unset[field], undefined);
  assert.notEqual(update.$set.research.runId, run.runId);
  assert.deepEqual(update.$push.previousResearchRuns.research, run);
  assert.equal(run.budget.calls, 4);
  assert.equal(run.budget.reservedMicrousd, 10000);
  run.budget.reservedMicrousd = 95000;
  await assert.rejects(s.retry("verified-owner", record._id.toString()), /remaining allowance/);
});
test("restart expires only stale active runs and never replays paid work", async () => {
  let stale;
  const ids = [];
  const model = {
    updateMany: (f, u) => {
      stale = { f, u };
      return query({});
    },
    find: (f) => {
      assert.deepEqual(f, { status: "queued", leaseToken: { $exists: false } });
      return query([]);
    },
  };
  const runner = new InvestigationRunnerService(model);
  runner.run = async (id) => ids.push(id);
  await runner.recover();
  assert.ok(stale.f.$or[0].leaseExpiresAt.$lt instanceof Date);
  assert.equal(stale.u.$set.error.code, "RUN_INTERRUPTED");
  assert.equal(stale.u.$unset.leaseToken, 1);
  assert.equal(ids.length, 0);
});
test("atomic claim permits one worker; stale/deleted writer cannot publish", async () => {
  let claimed = false,
    writeFilter;
  const id = new Types.ObjectId().toString();
  const model = {
    findOneAndUpdate: (f) => {
      assert.equal(f.status, "queued");
      assert.deepEqual(f.leaseToken, { $exists: false });
      if (claimed) return query(null);
      claimed = true;
      return query({ _id: new Types.ObjectId(id), originalInput: "aspirin" });
    },
    updateOne: (f) => {
      writeFilter = f;
      return query({ matchedCount: 0 });
    },
  };
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const g = new OtariGatewayService({ get: () => undefined });
  const runner = new InvestigationRunnerService(
    model,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    g,
    undefined,
    undefined,
    { get: () => "otari" },
  );
  await Promise.all([runner.run(id), runner.run(id)]);
  assert.equal(writeFilter._id, id);
  assert.ok(writeFilter.leaseToken);
  assert.ok(writeFilter.leaseExpiresAt.$gt instanceof Date);
  assert.ok(writeFilter.status.$in.includes("generating_dossier"));
});
test("resumed extraction reuses the original run and budget without repeating retrieval", async () => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const { snapshot, ResearchError } = require("../dist/research/provenance");
  const g = new OtariGatewayService({ get: (k) => (k === "OTARI_API_KEY" ? "fixture-only" : undefined) });
  const run = g.createRun("original-run");
  run.budget.capMicrousd = 100000;
  run.budget.calls = 4;
  run.budget.reservedMicrousd = 10000;
  run.snapshots = [snapshot("123", "https://pubmed.ncbi.nlm.nih.gov/123/", "Synthetic abstract.")];
  run.events = [
    {
      sequence: 1,
      at: new Date().toISOString(),
      operation: "extraction",
      status: "completed",
      correlationId: "fixture",
      provider: null,
      model: null,
      upstreamCode: null,
    },
  ];
  const paper = { id: "123", abstract: run.snapshots[0].text };
  const molecule = { preferredName: "fixture" };
  const item = { research: run, molecule, papers: [paper], progress: { papersDiscovered: 1 } };
  let extracted = 0;
  const model = {
    findOneAndUpdate: () => query(item),
    updateOne: () => query({ matchedCount: 1 }),
  };
  const forbidden = async () => {
    throw new Error("Retrieval must not repeat");
  };
  const runner = new InvestigationRunnerService(
    model,
    { resolve: forbidden },
    { search: forbidden },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    g,
    { search: forbidden },
    {
      extract: async (papers, resolved, retained) => {
        extracted++;
        assert.deepEqual(papers, [paper]);
        assert.deepEqual(resolved, molecule);
        assert.equal(retained.runId, "original-run");
        if (!item.retryMode) {
          assert.equal(retained.events[0].provider, undefined);
          assert.equal(retained.events[0].model, undefined);
          assert.equal(retained.events[0].upstreamCode, undefined);
        } else {
          assert.deepEqual(retained.events, []);
        }
        assert.equal(retained.budget.calls, 4);
        assert.equal(retained.budget.reservedMicrousd, 10000);
        throw new ResearchError("FIXTURE_STOP", "Stop before new spending.");
      },
    },
    { get: () => undefined },
  );
  await runner.run("fixture-investigation");
  assert.equal(extracted, 1);
  item.retryMode = "saved_sources";
  run.events = [];
  await runner.run("fixture-investigation");
  assert.equal(extracted, 2, "a prepared retry reuses sources even without the narrow extraction-failure predicate");
});

test("legacy record arrays need no synthetic provenance or review history", () => {
  const legacy = { evidence: [{ id: "old", finding: "Historical record" }], dossier: { generatedAt: "2020-01-01" } };
  assert.equal(legacy.research, undefined);
  assert.equal(legacy.evidence[0].provenance, undefined);
});

test("explicit retry after timeout archives prior decisions and keeps unknown charges while reusing sources", async () => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const { snapshot } = require("../dist/research/provenance");
  const run = new OtariGatewayService({ get: () => undefined }).createRun("old-attempt");
  run.snapshots = [snapshot("123", "https://pubmed.ncbi.nlm.nih.gov/123/", "Synthetic abstract.")];
  run.checkpoint = "extracting";
  run.audit = {
    version: "old-audit",
    programHash: "old-hash",
    valid: false,
    accepted: 0,
    sources: 0,
    distribution: {},
    invalidIds: [],
    remote: true,
  };
  run.dispatchUncertain = true;
  run.decisions = [
    {
      candidate: {
        id: "c1",
        paperId: "123",
        snapshotId: run.snapshots[0].id,
        snapshotHash: run.snapshots[0].hash,
        analyzedSource: "abstract",
        finding: "Synthetic finding",
        proposedClass: "insufficient",
        kind: "activity",
        studyType: "other",
        model: null,
        measuredOutcome: null,
        label: "Synthetic",
        relationship: null,
        spans: [
          {
            blockId: "abstract",
            quote: "Synthetic abstract.",
            start: 0,
            end: 18,
            convention: "utf16-zero-based-end-exclusive",
          },
        ],
      },
      review: null,
      status: "rejected",
      reason: "Fixture unsupported claim",
      publishedFinding: null,
      publishedClass: null,
    },
  ];
  run.budget = {
    ...run.budget,
    capMicrousd: 50000,
    calls: 5,
    reportedMicrousd: 5000,
    reservedMicrousd: 10000,
    unknownCostCalls: 1,
  };
  const record = {
    _id: new Types.ObjectId(),
    status: "failed",
    molecule: {},
    papers: [{ id: "123" }],
    research: run,
    access: { type: "free" },
    updatedAt: new Date(),
    error: { code: "OTARI_UPSTREAM_TIMEOUT", message: "Timeout" },
  };
  let update,
    filter,
    launched = 0;
  const model = {
    findOne: () => query(record),
    exists: async () => false,
    findOneAndUpdate: (f, u) => {
      filter = f;
      update = u;
      return query({ ...record, ...u.$set, id: record._id.toString() });
    },
  };
  const config = { get: (k) => (k === "OTARI_RUN_BUDGET_MICROUSD" ? "20000000" : undefined) };
  const s = new InvestigationsService(
    model,
    { ensureUser: async () => user },
    config,
    {
      run: async () => {
        launched++;
      },
    },
    {},
  );
  await s.retry("owner", record._id.toString());
  assert.equal(launched, 1);
  assert.deepEqual(filter.userId, user._id);
  assert.deepEqual(filter.updatedAt, record.updatedAt);
  assert.equal(update.$set.retryMode, "saved_sources");
  const next = update.$set.research;
  assert.equal(Object.hasOwn(next, "audit"), false);
  assert.equal(Object.hasOwn(next, "checkpoint"), false);
  assert.notEqual(next.runId, run.runId);
  assert.deepEqual(next.snapshots, run.snapshots);
  assert.deepEqual(update.$push.previousResearchRuns.research, run);
  for (const key of ["calls", "reportedMicrousd", "reservedMicrousd", "unknownCostCalls"])
    assert.equal(next.budget[key], run.budget[key]);
  assert.equal(next.budget.capMicrousd, 20000000);
  assert.equal(next.budget.maxCalls, run.budget.maxCalls);
  assert.equal(next.dispatchUncertain, false);
  assert.equal(run.dispatchUncertain, true);
  assert.equal(update.$unset.molecule, undefined);
  assert.equal(update.$unset.papers, undefined);
  record.research = { ...run, budget: { ...run.budget, capMicrousd: 20000000, terminal: true } };
  record.error.code = "OTARI_BUDGET_DENIED";
  await assert.rejects(s.retry("owner", record._id.toString()), /hosted limit/);
  record.error.code = "OTARI_PROVIDER_ERROR";
  record.research.budget.reservedMicrousd = 19995000;
  await assert.rejects(s.retry("owner", record._id.toString()), /remaining allowance/);
});

test("retry without canonical abstracts restarts retrieval and retains the original ledger", async () => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const run = new OtariGatewayService({ get: () => undefined }).createRun("old-search");
  run.budget.capMicrousd = 200000;
  run.budget.calls = 1;
  run.budget.reservedMicrousd = 10000;
  run.dispatchUncertain = true;
  const record = {
    _id: new Types.ObjectId(),
    status: "failed",
    access: { type: "free" },
    research: run,
    papers: [],
    error: { code: "OTARI_MCP_UNAVAILABLE", message: "Unavailable" },
  };
  let update;
  const s = service({
    findOne: () => query(record),
    exists: async () => false,
    findOneAndUpdate: (_, u) => {
      update = u;
      return query({ ...record, ...u.$set, id: record._id.toString() });
    },
  });
  await s.retry("owner", record._id.toString());
  assert.equal(update.$set.retryMode, "restart");
  assert.equal(update.$unset.papers, 1);
  assert.equal(update.$set.research.budget.reservedMicrousd, 10000);
  assert.deepEqual(update.$push.previousResearchRuns.research, run);
});

test("prepared retrieval restart carries cumulative budget instead of creating a new allowance", async () => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const { ResearchError } = require("../dist/research/provenance");
  const gateway = new OtariGatewayService({ get: (k) => (k === "OTARI_API_KEY" ? "fixture-only" : undefined) });
  const research = gateway.createRun("retry-attempt");
  research.budget.capMicrousd = 100000;
  research.budget.calls = 6;
  research.budget.reservedMicrousd = 15000;
  const item = { retryMode: "restart", research, papers: [], progress: {} };
  const model = { findOneAndUpdate: () => query(item), updateOne: () => query({ matchedCount: 1 }) };
  let searched = 0;
  gateway.createRun = () => {
    throw new Error("Retry must not create a separate allowance");
  };
  const runner = new InvestigationRunnerService(
    model,
    { resolve: async () => ({ preferredName: "fixture" }) },
    {},
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    gateway,
    {
      search: async (_, retained) => {
        searched++;
        assert.equal(retained.runId, "retry-attempt");
        assert.equal(retained.budget.calls, 6);
        assert.equal(retained.budget.reservedMicrousd, 15000);
        throw new ResearchError("FIXTURE_STOP", "Stop before spending");
      },
    },
    {},
    { get: () => undefined },
  );
  await runner.run("fixture-investigation");
  assert.equal(searched, 1);
});

test("retry of a timed-out review preserves extraction and routes directly to explicitly enabled Vertex", async () => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const { snapshot } = require("../dist/research/provenance");
  const source = snapshot("123", "https://pubmed.ncbi.nlm.nih.gov/123/", "Synthetic abstract.");
  const run = new OtariGatewayService({ get: () => undefined }).createRun("timed-out-review");
  run.snapshots = [source];
  run.checkpoint = "extracted";
  run.models = { extraction: "actual-fixture-extractor", distinct: false };
  run.budget = { ...run.budget, capMicrousd: 20000000, calls: 4, reservedMicrousd: 10000, unknownCostCalls: 1 };
  run.dispatchUncertain = true;
  run.events = [
    {
      sequence: 1,
      at: new Date().toISOString(),
      operation: "review",
      status: "failed",
      correlationId: "fixture",
      code: "OTARI_UPSTREAM_TIMEOUT",
      httpStatus: 504,
    },
  ];
  run.decisions = [
    {
      candidate: {
        id: "candidate",
        paperId: "123",
        snapshotId: source.id,
        snapshotHash: source.hash,
        analyzedSource: "abstract",
        finding: "Synthetic finding",
        proposedClass: "insufficient",
        kind: "activity",
        studyType: "other",
        model: null,
        measuredOutcome: null,
        label: "Fixture",
        relationship: null,
        spans: [
          {
            blockId: "abstract",
            quote: source.text,
            start: 0,
            end: source.text.length,
            convention: "utf16-zero-based-end-exclusive",
          },
        ],
      },
      status: "unresolved",
      reason: "Awaiting review",
    },
  ];
  const record = {
    _id: new Types.ObjectId(),
    status: "failed",
    access: { type: "free" },
    molecule: {},
    papers: [{ id: "123" }],
    research: run,
    error: { code: "OTARI_UPSTREAM_TIMEOUT", message: "Review timed out" },
  };
  let update;
  const service = new InvestigationsService(
    {
      findOne: () => query(record),
      exists: async () => false,
      findOneAndUpdate: (_, u) => {
        update = u;
        return query({ ...record, ...u.$set, id: record._id.toString() });
      },
    },
    { ensureUser: async () => user },
    { get: (key) => (key === "OTARI_REVIEW_FALLBACK" ? "vertex" : undefined) },
    { run: async () => {} },
    {},
  );
  await service.retry("owner", record._id.toString());
  const next = update.$set.research;
  assert.equal(next.checkpoint, "extracted");
  assert.equal(next.reviewRoute, "vertex");
  assert.deepEqual(next.decisions, run.decisions);
  assert.deepEqual(next.events, run.events);
  assert.equal(next.models.extraction, run.models.extraction);
  assert.equal(next.budget.reservedMicrousd, 10000);
  assert.equal(update.$unset.papers, undefined);
  assert.equal(update.$set.retryMode, "saved_sources");
});

test("local API boot reads new root env flags without relying on an older dev parent environment", async () => {
  const { apiEnvironmentFiles } = require("../dist/config/environment");
  const { ConfigModule, ConfigService } = require("@nestjs/config");
  const fs = require("node:fs/promises"),
    path = require("node:path"),
    os = require("node:os");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "capela-env-test-"));
  const previous = process.env.OTARI_REVIEW_FALLBACK;
  try {
    const files = apiEnvironmentFiles(path.join(root, "apps/api/dist"), "development");
    assert.equal(files[0], path.join(root, ".env.local"));
    assert.deepEqual(apiEnvironmentFiles(path.join(root, "apps/api/src"), "development"), files);
    assert.deepEqual(apiEnvironmentFiles(path.join(root, "apps/api/dist"), "production"), [".env"]);
    await fs.writeFile(files[0], "OTARI_REVIEW_FALLBACK=vertex\n");
    delete process.env.OTARI_REVIEW_FALLBACK;
    await ConfigModule.forRoot({ envFilePath: [files[0]] });
    assert.equal(new ConfigService().get("OTARI_REVIEW_FALLBACK"), "vertex");
    process.env.OTARI_REVIEW_FALLBACK = "disabled-by-owner";
    await ConfigModule.forRoot({ envFilePath: [files[0]] });
    assert.equal(
      new ConfigService().get("OTARI_REVIEW_FALLBACK"),
      "disabled-by-owner",
      "explicit process config still takes priority",
    );
  } finally {
    if (previous === undefined) delete process.env.OTARI_REVIEW_FALLBACK;
    else process.env.OTARI_REVIEW_FALLBACK = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("retry cannot silently extend an exhausted original dispatch allowance", async () => {
  const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
  const run = new OtariGatewayService({ get: () => undefined }).createRun("exhausted-calls");
  run.budget.capMicrousd = 1000000;
  run.budget.calls = 5;
  run.budget.maxCalls = 5;
  const record = {
    _id: new Types.ObjectId(),
    status: "failed",
    access: { type: "free" },
    research: run,
    papers: [],
    error: { code: "OTARI_MCP_UNAVAILABLE" },
  };
  let writes = 0;
  const s = service({
    findOne: () => query(record),
    findOneAndUpdate: () => {
      writes++;
      throw Error("Must not queue");
    },
  });
  await assert.rejects(s.retry("owner", record._id.toString()), /original dispatch allowance/);
  assert.equal(writes, 0);
  assert.equal(run.budget.maxCalls, 5);
});
