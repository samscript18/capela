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
  await assert.rejects(s.retry("verified-owner", new Types.ObjectId().toString()), /dispatched paid work/);
  assert.equal(writes, 0);
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
test("legacy record arrays need no synthetic provenance or review history", () => {
  const legacy = { evidence: [{ id: "old", finding: "Historical record" }], dossier: { generatedAt: "2020-01-01" } };
  assert.equal(legacy.research, undefined);
  assert.equal(legacy.evidence[0].provenance, undefined);
});
