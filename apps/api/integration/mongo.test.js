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
  await t.test(
    "complete hosted-path runner with mocked Otari persists source before inference and stops on denial",
    async (sub) => {
      const { OtariGatewayService } = require("../dist/research/otari-gateway.service");
      const { OtariRetrievalService } = require("../dist/research/otari-retrieval.service");
      const { OtariEvidenceService } = require("../dist/research/otari-evidence.service");
      const { EvidenceClassifierService } = require("../dist/research/evidence-classifier.service");
      const { MechanismService } = require("../dist/research/mechanism.service");
      const { ResearchAssessmentService } = require("../dist/research/research-assessment.service");
      const { DossierService } = require("../dist/research/dossier.service");
      const { snapshot } = require("../dist/research/provenance");
      const { localAudit } = require("../dist/research/evidence-audit");
      const cfg = {
        get: (k) =>
          ({
            OTARI_API_KEY: "fixture-only-key",
            OTARI_BUDGET_REFERENCE: "fixture-ceiling",
            OTARI_RUN_BUDGET_MICROUSD: "200000",
            OTARI_MCP_SERVER_ID: "server",
            OTARI_EXTRACTION_POLICY: "extract-policy",
            OTARI_REVIEW_POLICY: "review-policy",
          })[k],
      };
      const g = new OtariGatewayService(cfg),
        classifier = new EvidenceClassifierService();
      const molecule = {
        pubchemCid: 2244,
        preferredName: "aspirin",
        synonyms: [],
        structure2dUrl: "https://pubchem.ncbi.nlm.nih.gov/2244.png",
        pubchemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/2244",
      };
      const text = "Aspirin altered a marker in mice in this synthetic integration fixture.";
      const source = snapshot("12345", "https://pubmed.ncbi.nlm.nih.gov/12345/", text);
      const span = {
        blockId: "abstract",
        quote: text,
        start: 0,
        end: text.length,
        convention: "utf16-zero-based-end-exclusive",
      };
      const claim = {
        id: "fixture-claim",
        paperId: "12345",
        snapshotId: source.id,
        snapshotHash: source.hash,
        analyzedSource: "abstract",
        finding: text,
        proposedClass: "indirect_experimental",
        kind: "activity",
        studyType: "experimental_in_vivo",
        model: "mice",
        measuredOutcome: "marker",
        label: "marker",
        relationship: null,
        spans: [span],
      };
      const review = {
        claimId: claim.id,
        verdict: "supported",
        reason: "Fixture support only.",
        evidenceType: claim.proposedClass,
        revisedFinding: null,
        spans: [span],
        checks: { molecule: true, negation: true, studyContext: true, directness: true, sourceLimitations: true },
      };
      let current,
        denied = false,
        requests = [];
      sub.mock.method(global, "fetch", async (url, init) => {
        const pathname = new URL(url).pathname.replace("/api/v1", "");
        requests.push(pathname);
        if (denied) return new Response("{}", { status: 403, headers: { "Otari-Error-Code": "budget_exceeded" } });
        if (pathname === "/search")
          return Response.json({
            results: [{ title: "Fixture publication", url: source.canonicalUrl, snippet: "Fixture search result" }],
          });
        if (pathname.includes("/tools"))
          return Response.json({
            server_id: "server",
            server_revision: "rev",
            tools: [
              {
                name: "publication_abstract",
                input_schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["url"],
                  properties: { url: { type: "string" } },
                },
              },
            ],
          });
        if (pathname === "/mcp/execute")
          return Response.json({
            isError: false,
            resultType: "complete",
            structuredContent: {
              pmid: "12345",
              title: "Synthetic fixture",
              abstract: text,
              authors: [],
              journal: "",
              year: null,
              doi: null,
              publicationTypes: [],
              canonicalUrl: source.canonicalUrl,
            },
          });
        if (pathname === "/chat/completions") {
          const persisted = await Model.findById(current.id).lean();
          assert.equal(persisted.research.snapshots[0].hash, source.hash, "source durable before inference");
          const extraction = JSON.parse(init.body).model === "extract-policy";
          return Response.json(
            {
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content: JSON.stringify(
                      extraction
                        ? { papers: [{ paperId: "12345", claims: [claim], limitations: ["Synthetic fixture"] }] }
                        : { reviews: [review] },
                    ),
                  },
                },
              ],
              usage: { cost_usd: "0.000010" },
            },
            { headers: { "Otari-Model": extraction ? "fixture-a" : "fixture-b" } },
          );
        }
        if (pathname === "/code/execute")
          return Response.json({ return_code: 0, stderr: "", stdout: JSON.stringify(localAudit([claim], [source])) });
        throw new Error("Unexpected network path");
      });
      const full = new InvestigationRunnerService(
        Model,
        { resolve: async () => molecule },
        undefined,
        undefined,
        classifier,
        new MechanismService(),
        new ResearchAssessmentService(),
        new DossierService(),
        { recordInvestigation: async () => {} },
        g,
        new OtariRetrievalService(g),
        new OtariEvidenceService(g, classifier),
        cfg,
      );
      current = await Model.create({ userId: owner, originalInput: "fixture", access: { type: "free" } });
      await full.run(current.id);
      const completed = await Model.findById(current.id).lean();
      assert.equal(completed.status, "completed", JSON.stringify(completed.error));
      assert.equal(completed.evidence.length, 1);
      assert.ok(completed.evidence[0].provenance);
      assert.ok(completed.research.models.distinct);
      assert.ok(completed.research.audit.remote);
      assert.equal(completed.research.budget.calls, 5);
      assert.notEqual(completed.research.runId, completed.leaseToken);
      assert.equal(Object.keys(completed.dossier).length, 9);
      denied = true;
      requests = [];
      current = await Model.create({ userId: owner, originalInput: "denied fixture", access: { type: "free" } });
      await full.run(current.id);
      const partial = await Model.findById(current.id).lean();
      assert.equal(partial.status, "failed");
      assert.equal(partial.error.code, "OTARI_BUDGET_DENIED");
      assert.equal(partial.research.budget.terminal, true);
      assert.deepEqual(requests, ["/search"]);
      assert.equal(partial.dossier, undefined);
    },
  );
});
