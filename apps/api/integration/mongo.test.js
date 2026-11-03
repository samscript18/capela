require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const mongoose = require("mongoose");
const { InvestigationSchema } = require("../dist/investigations/schemas/investigation.schema");
const { InvestigationRunnerService } = require("../dist/research/investigation-runner.service");
const { InvestigationsService } = require("../dist/investigations/investigations.service");

test("isolated real Mongo: lease concurrency, cancellation/deletion fencing, recovery and owner isolation", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "capela-mongo-test-"));
  const child = spawn(
    "mongod",
    [
      "--dbpath",
      directory,
      "--port",
      "27841",
      "--bind_ip",
      "127.0.0.1",
      "--logpath",
      path.join(directory, "mongo.log"),
      "--quiet",
    ],
    { stdio: "ignore" },
  );
  let connection;
  t.after(async () => {
    if (connection) await connection.close();
    if (child.exitCode === null) {
      const done = new Promise((r) => child.once("exit", r));
      child.kill("SIGTERM");
      await done;
    }
    await rm(directory, { recursive: true, force: true });
  });
  for (let i = 0; i < 40; i++) {
    try {
      connection = await mongoose
        .createConnection("mongodb://127.0.0.1:27841/capela_isolated_test", { serverSelectionTimeoutMS: 250 })
        .asPromise();
      break;
    } catch {
      if (child.exitCode !== null) throw new Error("Isolated Mongo could not start");
    }
  }
  assert.ok(connection, "Isolated Mongo started");
  const Model = connection.model("Investigation", InvestigationSchema);
  await Model.init();
  const owner = new mongoose.Types.ObjectId();
  const users = { ensureUser: async () => ({ _id: owner }) };
  const config = { get: (k) => (k === "RESEARCH_PROVIDER" ? "legacy" : undefined) };
  const service = new InvestigationsService(Model, users, config, {}, {});
  for (const action of ["cancel", "remove"]) {
    let release, started;
    const began = new Promise((r) => {
      started = r;
    });
    const pending = new Promise((r) => {
      release = r;
    });
    let resolved = 0,
      searched = 0;
    const pubchem = {
      resolve: async () => {
        resolved++;
        started();
        await pending;
        return { preferredName: "fixture" };
      },
    };
    const runner = new InvestigationRunnerService(
      Model,
      pubchem,
      {
        search: async () => {
          searched++;
          return { papers: [], discoveredCount: 0 };
        },
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      config,
    );
    const item = await Model.create({ userId: owner, originalInput: "fixture", access: { type: "free" } });
    const first = runner.run(item.id);
    await began;
    await runner.run(item.id);
    assert.equal(resolved, 1, "one atomic lease owner");
    await service[action]("fixture-owner", item.id);
    release();
    await first;
    assert.equal(searched, 0, "no subsequent provider dispatch after cancellation/deletion");
    const saved = await Model.findById(item.id).lean();
    if (action === "cancel") {
      assert.equal(saved.status, "failed");
      assert.equal(saved.error.code, "RUN_CANCELLED");
      assert.equal(saved.dossier, undefined);
    } else assert.equal(saved, null);
  }
  const stale = await Model.create({
    userId: owner,
    originalInput: "stale",
    access: { type: "free" },
    status: "extracting_evidence",
    leaseToken: "expired",
    leaseExpiresAt: new Date(0),
    research: { snapshots: [{ id: "persisted-source" }], budget: { calls: 1 } },
  });
  const runner = new InvestigationRunnerService(Model);
  await runner.recover();
  const saved = await Model.findById(stale.id).lean();
  assert.equal(saved.status, "failed");
  assert.equal(saved.error.code, "RUN_INTERRUPTED");
  assert.equal(saved.research.snapshots[0].id, "persisted-source");
  await assert.rejects(service.retry("fixture-owner", stale.id), /dispatched paid work/);
  const outsider = new InvestigationsService(
    Model,
    { ensureUser: async () => ({ _id: new mongoose.Types.ObjectId() }) },
    config,
    {},
    {},
  );
  await assert.rejects(outsider.get("other-owner", stale.id), /not found/);
  await assert.rejects(outsider.cancel("other-owner", stale.id), /not found/);
});
