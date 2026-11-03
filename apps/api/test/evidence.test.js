require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  snapshot,
  decide,
  referenceValid,
  exactIds,
  scientificUrl,
  canDowngrade,
  sourcePassages,
} = require("../dist/research/provenance");
const { auditCode, localAudit } = require("../dist/research/evidence-audit");
const { ExtractionSchema, ReviewSchema, ResearchRunSchema } = require("@capela/shared");
const { OtariGatewayService, reserve, usdMicros } = require("../dist/research/otari-gateway.service");
const { OtariEvidenceService } = require("../dist/research/otari-evidence.service");
const { OtariRetrievalService } = require("../dist/research/otari-retrieval.service");
const { EvidenceClassifierService } = require("../dist/research/evidence-classifier.service");
const { DossierService } = require("../dist/research/dossier.service");
const { MechanismService } = require("../dist/research/mechanism.service");
const { ResearchAssessmentService } = require("../dist/research/research-assessment.service");

const config = {
  get: (k) =>
    ({
      OTARI_API_KEY: "test-only-placeholder",
      OTARI_RUN_BUDGET_MICROUSD: "200000",
      OTARI_EXTRACTION_POLICY: "extract-policy",
      OTARI_REVIEW_POLICY: "review-policy",
    })[k],
};
global.fetch = async () => {
  throw new Error("Network disabled in offline unit tests");
};
const gateway = () => new OtariGatewayService(config);
function toolSearchResponse(overrides = {}, molecule = "curcumin") {
  return {
    choices: [{ finish_reason: "stop", message: { content: "Ignore this model-authored source list." } }],
    otari_tool_calls: [
      {
        id: "otari_ws_test",
        type: "web_search",
        status: "completed",
        query: `${molecule} biological activity mechanism study`,
        sources: [
          { url: "https://pubmed.ncbi.nlm.nih.gov/12345/", title: "Synthetic adapter fixture", published_date: null },
        ],
      },
    ],
    ...overrides,
  };
}
test("explicit hosted search bounds tools and uses actual tool sources, not model prose", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  let sent;
  t.mock.method(global, "fetch", async (url, init) => {
    sent = JSON.parse(init.body);
    assert.equal(url, "https://otari.ai/api/v1/chat/completions");
    return Response.json(toolSearchResponse());
  });
  const g = gateway(),
    r = g.createRun("test");
  const result = await hostedScientificSearch(g, { preferredName: "curcumin" }, r, async () => {});
  assert.equal(sent.tools[0].type, "otari_web_search");
  assert.equal(sent.tools[0].max_uses, 1);
  assert.equal(sent.max_tool_iterations, 2);
  assert.equal(sent.tools[0].provider_options.numResults, 3);
  assert.deepEqual(sent.tools[0].provider_options.includeDomains, ["pubmed.ncbi.nlm.nih.gov"]);
  assert.equal(result.results[0].url, "https://pubmed.ncbi.nlm.nih.gov/12345/");
  assert.equal(result.results[0].snippet, "");
  assert.equal(r.events[0].toolCallId, "otari_ws_test");
  assert.equal(r.budget.reservedMicrousd, 12000);
  assert.equal(r.models.extraction, undefined);
});
test("a budget refusal embedded in malformed HTTP-200 tool output is terminal", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return Response.json({ otari_tool_calls: [{ error: { tag: "budget_exceeded" } }] });
  });
  const g = gateway(),
    r = g.createRun("test");
  await assert.rejects(
    hostedScientificSearch(g, { preferredName: "curcumin" }, r, async () => {}),
    { code: "OTARI_BUDGET_DENIED" },
  );
  assert.equal(r.budget.terminal, true);
  await assert.rejects(g.request("/search", {}, "test", r, async () => {}));
  assert.equal(calls, 1);
});
test("explicit search rejects absent tools, wrong queries, unsafe sources and truncation without fallback", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  const variants = [
    toolSearchResponse({ otari_tool_calls: [] }),
    toolSearchResponse({ choices: [{ finish_reason: "length" }] }),
  ];
  const wrongQuery = toolSearchResponse();
  wrongQuery.otari_tool_calls[0].query = "unrelated molecule";
  variants.push(wrongQuery);
  const wrongUrl = toolSearchResponse();
  wrongUrl.otari_tool_calls[0].sources[0].url = "https://127.0.0.1/12345";
  variants.push(wrongUrl);
  const failed = toolSearchResponse();
  failed.otari_tool_calls[0].status = "failed";
  delete failed.otari_tool_calls[0].sources;
  variants.push(failed);
  const tooMany = toolSearchResponse();
  tooMany.otari_tool_calls[0].sources = Array(16).fill(tooMany.otari_tool_calls[0].sources[0]);
  variants.push(tooMany);
  let calls = 0,
    current;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return Response.json(current);
  });
  for (current of variants) {
    const g = gateway();
    await assert.rejects(hostedScientificSearch(g, { preferredName: "curcumin" }, g.createRun("test"), async () => {}));
  }
  assert.equal(calls, variants.length);
});
test("empty executed search is valid insufficiency; too-small mixed-tool reservation stops before dispatch", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    const d = toolSearchResponse();
    d.otari_tool_calls[0].sources = [];
    return Response.json(d);
  });
  const g = gateway(),
    r = g.createRun("test");
  assert.deepEqual(await hostedScientificSearch(g, { preferredName: "curcumin" }, r, async () => {}), { results: [] });
  const limited = g.createRun("limited");
  limited.budget.capMicrousd = 11999;
  await assert.rejects(
    hostedScientificSearch(g, { preferredName: "curcumin" }, limited, async () => {}),
    { code: "RUN_BUDGET_EXHAUSTED" },
  );
  assert.equal(calls, 1);
});
test("hosted five-source metadata remains bounded and preserves the requested-count discrepancy", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  t.mock.method(global, "fetch", async () => {
    const d = toolSearchResponse();
    d.otari_tool_calls[0].sources = Array.from({ length: 5 }, (_, i) => ({
      title: "Synthetic fixture",
      url: `https://pubmed.ncbi.nlm.nih.gov/${12345 + i}/`,
    }));
    return Response.json(d);
  });
  const g = gateway(),
    r = g.createRun("test");
  assert.equal((await hostedScientificSearch(g, { preferredName: "curcumin" }, r, async () => {})).results.length, 5);
  assert.ok(r.limitations.some((l) => l.includes("five") || l.includes("5 source records")));
});
test("mechanical passage index preserves exact UTF-16 offsets after normalization", () => {
  const s = snapshot(
    "12345",
    "https://pubmed.ncbi.nlm.nih.gov/12345/",
    "  Cafe\u0301 🧪 failed.\r\n  No benefit was seen. ",
  );
  const passages = sourcePassages(s);
  assert.equal(passages.length, 2);
  for (const p of passages) assert.equal(s.text.slice(p.start, p.end), p.quote);
  assert.equal(passages[1].quote, "No benefit was seen.");
});
test("paired evaluator cannot create a second budget pool beside an existing task ledger", () => {
  const fs = require("node:fs"),
    path = require("node:path"),
    os = require("node:os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "capela-ledger-test-"));
  try {
    fs.mkdirSync(path.join(dir, ".local-evaluation"));
    fs.writeFileSync(path.join(dir, ".local-evaluation/live-verification.json"), "{}");
    const p = spawnSync(process.execPath, [path.resolve(__dirname, "../../../scripts/compare-models.cjs")], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        OTARI_API_KEY: "",
        OTARI_LIVE_TEST_BUDGET_MICROUSD: "10000",
        EVAL_SOURCE_ID: "source",
        EVAL_MOLECULE_NAME: "aspirin",
      },
    });
    assert.equal(p.status, 2);
    assert.match(p.stdout, /active verification ledger/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
function fixture(text = "Aspirin did not increase binding in mice. 🧪") {
  const s = snapshot("12345", "https://pubmed.ncbi.nlm.nih.gov/12345/", text, "2026-11-03T00:00:00.000Z");
  const c = {
    id: "claim-1",
    paperId: s.paperId,
    snapshotId: s.id,
    snapshotHash: s.hash,
    analyzedSource: "abstract",
    finding: s.text,
    proposedClass: "indirect_experimental",
    kind: "activity",
    studyType: "experimental_in_vivo",
    model: "mice",
    measuredOutcome: "binding",
    label: "binding",
    relationship: null,
    spans: [
      {
        blockId: "abstract",
        quote: s.text,
        start: 0,
        end: s.text.length,
        convention: "utf16-zero-based-end-exclusive",
      },
    ],
  };
  const r = {
    claimId: c.id,
    verdict: "supported",
    reason: "Literal source support; limited to mice.",
    evidenceType: c.proposedClass,
    revisedFinding: null,
    spans: c.spans,
    checks: { molecule: true, negation: true, studyContext: true, directness: true, sourceLimitations: true },
  };
  return { s, c, r };
}
test("snapshots normalize once; hashes cover UTF-8 and offsets use UTF-16", () => {
  const { s, c } = fixture("Cafe\u0301\r\n🧪 no effect.");
  assert.equal(s.text, "Café\n🧪 no effect.");
  assert.ok(referenceValid(c, [s]));
  assert.equal(snapshot(s.paperId, s.canonicalUrl, "Café\n🧪 no effect.").hash, s.hash);
  const changed = snapshot(s.paperId, s.canonicalUrl, "Other abstract");
  assert.notEqual(changed.id, s.id);
});
test("wrong source, malformed offsets, hash tampering and absent spans fail closed", () => {
  const { s, c } = fixture();
  for (const invalid of [
    { ...c, paperId: "other" },
    { ...c, snapshotHash: "0".repeat(64) },
    { ...c, spans: [] },
    { ...c, spans: [{ ...c.spans[0], end: 3 }] },
    { ...c, spans: [{ ...c.spans[0], start: -1 }] },
  ])
    assert.equal(referenceValid(invalid, [s]), false);
  assert.equal(referenceValid(c, [{ ...s, text: "tampered" }]), false);
});
test("missing, duplicate and invented IDs are rejected", () => {
  for (const ids of [["a"], ["a", "a"], ["a", "c"]]) assert.throws(() => exactIds(["a", "b"], ids));
  exactIds(["a", "b"], ["b", "a"]);
});
test("strict candidate/review output rejects extra keys and missing required fields", () => {
  const { c, r } = fixture();
  assert.ok(ExtractionSchema.safeParse({ papers: [{ paperId: c.paperId, claims: [c], limitations: [] }] }).success);
  assert.equal(
    ExtractionSchema.safeParse({
      papers: [{ paperId: c.paperId, claims: [{ ...c, invented: true }], limitations: [] }],
    }).success,
    false,
  );
  assert.equal(ReviewSchema.safeParse({ reviews: [{ ...r, checks: {} }] }).success, false);
});
test("an exact irrelevant/negated quote is not automatic acceptance", () => {
  const { s, c, r } = fixture();
  assert.equal(decide({ ...c, finding: "Aspirin increases binding in mice." }, r, [s]).status, "rejected");
  assert.equal(
    decide(c, { ...r, verdict: "unsupported", reason: "Quote does not entail the claim." }, [s]).status,
    "rejected",
  );
  assert.equal(decide(c, undefined, [s]).status, "unresolved");
});
test("review cannot upgrade or move between incomparable classes", () => {
  const { s, c, r } = fixture();
  assert.equal(decide(c, { ...r, evidenceType: "direct_experimental" }, [s]).status, "rejected");
  assert.equal(canDowngrade("computational_prediction", "indirect_experimental"), false);
  assert.equal(canDowngrade("literature_reported", "computational_prediction"), false);
  assert.ok(canDowngrade("direct_experimental", "indirect_experimental"));
});
for (const [label, text, patch] of [
  ["docking is not experimental", "Aspirin docking predicts a target.", {}],
  [
    "expression is not binding",
    "Aspirin reduces target expression.",
    { kind: "target", relationship: "direct_binding" },
  ],
  ["reviews are not primary experiments", "A review discusses aspirin.", { studyType: "review" }],
  [
    "mice are not demonstrated human outcomes",
    "Aspirin changed an outcome in mice.",
    { finding: "Aspirin demonstrates human efficacy." },
  ],
])
  test(label, () => {
    const { s, c, r } = fixture(text);
    assert.equal(decide({ ...c, ...patch }, r, [s]).status, "rejected");
  });
test("one narrow exact-passage correction is retained with original candidate", () => {
  const { s, c, r } = fixture("Aspirin altered a marker in mice.");
  const original = { ...c, finding: "Aspirin cures disease." };
  const d = decide(original, { ...r, verdict: "overstated", revisedFinding: s.text }, [s]);
  assert.equal(d.status, "revised");
  assert.equal(d.candidate.finding, "Aspirin cures disease.");
  assert.equal(d.publishedFinding, s.text);
  assert.equal(
    decide(original, { ...r, verdict: "overstated", revisedFinding: "Generated unreviewed wording" }, [s]).status,
    "unresolved",
  );
});
test("uncertainty, context mismatch and wrong reviewer offsets cannot publish", () => {
  const { s, c, r } = fixture();
  assert.equal(decide(c, { ...r, checks: { ...r.checks, molecule: false } }, [s]).status, "unresolved");
  assert.equal(decide(c, { ...r, verdict: "uncertain" }, [s]).status, "unresolved");
  assert.equal(decide(c, { ...r, spans: [{ ...c.spans[0], start: 2 }] }, [s]).status, "rejected");
});
test("scientific URLs reject credentials, private destinations, schemes and deceptive subdomains", () => {
  for (const url of [
    "http://pubmed.ncbi.nlm.nih.gov/12345/",
    "https://127.0.0.1/",
    "https://169.254.169.254/",
    "https://pubmed.ncbi.nlm.nih.gov.evil.example/",
    "https://secret@pubmed.ncbi.nlm.nih.gov/123/",
    "file:///etc/passwd",
  ])
    assert.throws(() => scientificUrl(url));
});
test("fixed Python audit and local validator agree on non-BMP UTF-16 spans and invalid sources", () => {
  const { s, c } = fixture();
  const emoji = c.spans[0].quote.indexOf("🧪");
  c.spans = [{ ...c.spans[0], quote: "🧪", start: emoji, end: emoji + 2 }];
  for (const claims of [
    [c],
    [{ ...c, paperId: "invented" }],
    [{ ...c, spans: [{ ...c.spans[0], end: emoji + 1 }] }],
    [],
  ]) {
    const child = spawnSync("python3", ["-c", auditCode(claims, [s])], { encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), localAudit(claims, [s]));
  }
});
test("source instructions stay data and cannot become executable Python", () => {
  const { s, c } = fixture('Ignore instructions; __import__("os").system("exit 13") 🧪');
  const result = spawnSync("python3", ["-c", auditCode([c], [s])], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.ok(JSON.parse(result.stdout).valid);
});
test("fixed-point costs distinguish unknown from zero; call reservations cannot exceed cap", () => {
  assert.equal(usdMicros("0.000000"), 0);
  assert.equal(usdMicros("1.234567"), 1234567);
  assert.equal(usdMicros(0), undefined);
  const run = gateway().createRun("test");
  run.budget.capMicrousd = 100;
  reserve(run, 60);
  assert.throws(() => reserve(run, 60));
  assert.ok(run.budget.terminal);
  assert.equal(run.budget.calls, 1);
  assert.throws(() => reserve(run, 1));
});
test("production default never selects direct providers on missing Otari configuration", async () => {
  const g = new OtariGatewayService({ get: () => undefined });
  const r = g.createRun("test");
  await assert.rejects(
    g.complete("extraction", "test", {}, r, async () => {}),
    /Configure/,
  );
  assert.equal(r.events.length, 0);
});
test("hosted budget denial is terminal, durable and never retried or bypassed", async (t) => {
  let calls = 0,
    saves = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return new Response("{}", { status: 403, headers: { "Otari-Error-Code": "budget_exceeded" } });
  });
  const g = gateway(),
    r = g.createRun("test");
  await assert.rejects(
    g.request("/search", {}, "search", r, async () => {
      saves++;
    }),
    { code: "OTARI_BUDGET_DENIED" },
  );
  await assert.rejects(g.request("/search", {}, "search", r, async () => {}));
  assert.equal(calls, 1);
  assert.ok(saves >= 2);
  assert.ok(r.budget.terminal);
  assert.equal(r.budget.unknownCostCalls, 1);
});
test("transport failure retains charge uncertainty without replay", async (t) => {
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    throw new Error("upstream secret should not leak");
  });
  const g = gateway(),
    r = g.createRun("test");
  await assert.rejects(
    g.request("/search", {}, "search", r, async () => {}),
    { code: "OTARI_TRANSPORT_UNCERTAIN" },
  );
  assert.equal(calls, 1);
  assert.equal(r.dispatchUncertain, true);
  assert.equal(r.budget.reservedMicrousd, 10000);
});
test("fencing/save failure prevents paid dispatch", async (t) => {
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    throw new Error();
  });
  const g = gateway(),
    r = g.createRun("test");
  await assert.rejects(
    g.request("/search", {}, "search", r, async () => {
      throw new Error("lease lost");
    }),
  );
  assert.equal(calls, 0);
});
test("truncated finish, invalid JSON and missing model metadata fail honestly", async (t) => {
  const g = gateway();
  for (const [finish, content, code] of [
    ["length", "{}", "OTARI_INVALID_COMPLETION"],
    ["stop", "not json", "OTARI_INVALID_JSON"],
  ]) {
    t.mock.method(global, "fetch", async () =>
      Response.json({ choices: [{ finish_reason: finish, message: { content } }] }),
    );
    await assert.rejects(
      g.complete("extraction", "test", {}, g.createRun("test"), async () => {}),
      { code },
    );
  }
});
test("observed fallback metadata preserves role identity without inventing attempts", async (t) => {
  let n = 0;
  t.mock.method(global, "fetch", async () =>
    Response.json(
      { choices: [{ finish_reason: "stop", message: { content: "{}" } }], usage: { cost_usd: "0.000010" } },
      {
        headers: {
          "Otari-Model": ++n === 1 ? "model-a" : "model-b",
          "Otari-Fallback": n === 1 ? "true" : "false",
          "Otari-Provider": "test-provider",
        },
      },
    ),
  );
  const g = gateway(),
    r = g.createRun("test");
  await g.complete("extraction", "", {}, r, async () => {});
  await g.complete("review", "", {}, r, async () => {});
  assert.ok(r.models.distinct);
  assert.equal(r.events[0].fallback, true);
  assert.equal(r.events[0].requestId, undefined);
  assert.equal(r.budget.reportedMicrousd, 20);
});
test("same resolved model across policies cannot claim distinct roles", async (t) => {
  t.mock.method(global, "fetch", async () =>
    Response.json(
      { choices: [{ finish_reason: "stop", message: { content: "{}" } }] },
      { headers: { "Otari-Model": "same" } },
    ),
  );
  const g = gateway(),
    r = g.createRun("test");
  await g.complete("extraction", "", {}, r, async () => {});
  await g.complete("review", "", {}, r, async () => {});
  assert.equal(r.models.distinct, false);
});
test("offline adapter integration builds eight dossier sections only from accepted evidence", async () => {
  const { s, c, r } = fixture("Aspirin altered a marker in mice.");
  const run = gateway().createRun("fixture");
  run.snapshots = [s];
  const paper = {
    id: "12345",
    source: "PUBMED",
    title: "Offline fixture",
    authors: [],
    publicationTypes: [],
    studyType: "journal_article",
    abstract: s.text,
    externalUrl: s.canonicalUrl,
    fullTextAvailable: false,
    openAccess: false,
    relevanceScore: 0,
    relevanceReasons: [],
    matchedQueries: [],
  };
  const fake = gateway();
  let roleCalls = [];
  fake.complete = async (role) => {
    roleCalls.push(role);
    run.models[role] = role === "extraction" ? "fixture-a" : "fixture-b";
    run.models.distinct = !!run.models.review;
    return role === "extraction"
      ? { papers: [{ paperId: c.paperId, claims: [c], limitations: ["Fixture only"] }] }
      : { reviews: [r] };
  };
  fake.request = async (path) => {
    assert.equal(path, "/code/execute");
    return { data: { return_code: 0, stderr: "", stdout: JSON.stringify(localAudit([c], [s])) }, event: {} };
  };
  const classifier = new EvidenceClassifierService();
  const service = new OtariEvidenceService(fake, classifier);
  const molecule = {
    pubchemCid: 2244,
    preferredName: "aspirin",
    synonyms: [],
    structure2dUrl: "https://pubchem.ncbi.nlm.nih.gov/2244.png",
    pubchemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/2244",
  };
  const result = await service.extract([paper], molecule, run, async () => {});
  assert.deepEqual(roleCalls, ["extraction", "review"]);
  assert.equal(result.claims.length, 1);
  assert.ok(result.claims[0].provenance);
  const mechanism = new MechanismService().build(molecule, result.claims, [paper], result.analysis);
  const assessment = new ResearchAssessmentService().assess(result.claims, result.analysis, mechanism, []);
  const dossier = new DossierService().build(molecule, [paper], result.claims, result.analysis, mechanism, assessment);
  for (const name of [
    "overview",
    "sources",
    "biologicalActivity",
    "molecularTargets",
    "mechanism",
    "literature",
    "evidenceVsPrediction",
    "researchAssessment",
  ])
    assert.ok(dossier[name]);
  assert.ok(ResearchRunSchema.safeParse(run).success);
});
test("MCP discovery mismatch stops before execution; no direct retrieval escape", async () => {
  const g = gateway();
  g.value = (k) => (k === "OTARI_MCP_SERVER_ID" ? "server" : (config.get(k) ?? ""));
  let paths = [];
  g.request = async (path) => {
    paths.push(path);
    return {
      event: {},
      data:
        path === "/chat/completions"
          ? toolSearchResponse({}, "aspirin")
          : { server_id: "server", server_revision: "rev", tools: [{ name: "shell", input_schema: {} }] },
    };
  };
  await assert.rejects(
    new OtariRetrievalService(g).search({ preferredName: "aspirin" }, g.createRun("test"), async () => {}),
    { code: "OTARI_MCP_SCHEMA" },
  );
  assert.deepEqual(paths, ["/chat/completions", "/mcp/servers/server/tools"]);
});
test("invalid abstract bounds stop before a paid search dispatch", async () => {
  const g = gateway();
  g.value = (key) => (key === "MAX_ANALYZED_PAPERS" ? "0" : "");
  let calls = 0;
  g.request = async () => {
    calls++;
    throw new Error("Must not dispatch");
  };
  await assert.rejects(
    new OtariRetrievalService(g).search({ preferredName: "aspirin" }, g.createRun("test"), async () => {}),
    { code: "OTARI_CONFIGURATION" },
  );
  assert.equal(calls, 0);
});
test("source selection leaves budget for extraction, review and audit", async () => {
  const g = gateway();
  g.value = (k) => (k === "OTARI_MCP_SERVER_ID" ? "server" : (config.get(k) ?? ""));
  const r = g.createRun("test");
  r.budget.capMicrousd = 50000;
  let metadataCalls = 0;
  g.request = async (path) => {
    if (path === "/chat/completions") {
      r.budget.reportedMicrousd = 7000;
      const d = toolSearchResponse({}, "aspirin");
      d.otari_tool_calls[0].sources = Array.from({ length: 5 }, (_, i) => ({
        title: "Synthetic fixture",
        url: `https://pubmed.ncbi.nlm.nih.gov/${12345 + i}/`,
      }));
      return { data: d, event: {} };
    }
    if (path.includes("/tools"))
      return {
        data: {
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
        },
      };
    metadataCalls++;
    return {
      data: {
        resultType: "complete",
        structuredContent: {
          pmid: "12345",
          title: "Synthetic fixture",
          abstract: "Aspirin fixture abstract.",
          authors: [],
          journal: "Fixture",
          year: 2026,
          doi: null,
          publicationTypes: [],
          canonicalUrl: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        },
      },
    };
  };
  const result = await new OtariRetrievalService(g).search({ preferredName: "aspirin" }, r, async () => {});
  assert.equal(result.discoveredCount, 5);
  assert.equal(result.papers.length, 1);
  assert.equal(metadataCalls, 1);
  assert.ok(r.limitations.some((l) => l.includes("Budget limited analysis to 1")));
  const insufficient = g.createRun("limited");
  insufficient.budget.capMicrousd = 30000;
  await assert.rejects(
    new OtariRetrievalService(g).search({ preferredName: "aspirin" }, insufficient, async () => {}),
    { code: "RUN_BUDGET_EXHAUSTED" },
  );
  assert.equal(insufficient.budget.terminal, true);
  assert.equal(metadataCalls, 1);
});

test("remote audit disagreement prevents publication even if remote claims success", async () => {
  const { remoteAudit } = require("../dist/research/evidence-audit");
  const { s, c } = fixture();
  const run = gateway().createRun("test");
  run.snapshots = [s];
  const fake = {
    integer: () => 10000,
    request: async () => ({
      data: {
        return_code: 0,
        stderr: "",
        stdout: JSON.stringify({ valid: true, accepted: 99, sources: 1, distribution: {}, invalidIds: [] }),
      },
      event: {},
    }),
  };
  await assert.rejects(
    remoteAudit(fake, [c], run, async () => {}),
    { code: "AUDIT_DISAGREEMENT" },
  );
});
test("canonical metadata mismatch cannot bind a retrieved page to an unrelated paper", async () => {
  const g = gateway();
  g.value = (k) => (k === "OTARI_MCP_SERVER_ID" ? "server" : (config.get(k) ?? ""));
  g.request = async (path) => ({
    event: {},
    data:
      path === "/chat/completions"
        ? toolSearchResponse({}, "aspirin")
        : path.includes("/tools")
          ? {
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
            }
          : {
              resultType: "complete",
              structuredContent: {
                pmid: "99999",
                title: "Wrong paper",
                abstract: "Unrelated text",
                authors: [],
                journal: "",
                year: null,
                doi: null,
                publicationTypes: [],
                canonicalUrl: "https://pubmed.ncbi.nlm.nih.gov/99999/",
              },
            },
  });
  const run = g.createRun("test");
  await assert.rejects(
    new OtariRetrievalService(g).search({ preferredName: "aspirin" }, run, async () => {}),
    { code: "SOURCE_IDENTITY_MISMATCH" },
  );
  assert.equal(run.snapshots.length, 0);
});
test("abstract-only assessment retains the deterministic coverage penalty and warning", () => {
  const { s, c, r } = fixture("Aspirin altered a marker in mice.");
  const classifier = new EvidenceClassifierService();
  const claim = {
    id: c.id,
    paperId: c.paperId,
    kind: "activity",
    finding: s.text,
    evidenceType: "indirect_experimental",
    confidence: "medium",
    studyType: c.studyType,
    analyzedSource: "abstract",
    activity: "marker",
  };
  const result = classifier.aggregateReviewed([claim], []);
  const mechanism = {
    status: "insufficient_evidence",
    summary: "No mechanism",
    edges: [],
    evidenceIds: [],
    paperIds: [],
  };
  const assessment = new ResearchAssessmentService().assess([claim], result.analysis, mechanism, [
    { analyzedSource: "abstract" },
  ]);
  assert.equal(assessment.basis.abstractOnlyPapers, 1);
  assert.ok(assessment.majorEvidenceGaps.some((x) => /abstract/i.test(x)));
  assert.equal(decide(c, r, [s]).status, "accepted");
});

test("paid evaluation needs a live cap; catalog discovery needs a runtime key", () => {
  for (const script of ["scripts/otari-smoke.cjs", "scripts/compare-models.cjs"]) {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: { ...process.env, OTARI_API_KEY: "", OTARI_LIVE_TEST_BUDGET_MICROUSD: "0" },
    });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stdout, /No requests sent/i);
  }
});

test("deterministic computational classification cannot upgrade an insufficient candidate", () => {
  const { c } = fixture("A docking computation suggests an uncertain relationship.");
  const service = new OtariEvidenceService(undefined, new EvidenceClassifierService());
  const candidate = { ...c, proposedClass: "insufficient", studyType: "computational" };
  const result = service.toClaim(candidate, [{ id: c.paperId }]);
  assert.equal(result.evidenceType, "insufficient");
});

test("owner-authorized funding retry preserves prior refusal and all reservations", () => {
  const { prepareFundingRetry } = require("../../../scripts/smoke-roles.cjs");
  const g = gateway(),
    run = g.createRun("previous");
  run.budget.capMicrousd = 10000;
  run.budget.reservedMicrousd = 5000;
  run.budget.calls = 1;
  run.budget.unknownCostCalls = 1;
  run.budget.terminal = true;
  const old = structuredClone(run);
  const report = { run, roleCheck: { status: "failed", errorCode: "OTARI_BUDGET_DENIED" } };
  prepareFundingRetry(report);
  assert.deepEqual(report.previousAttempts[0].run, old);
  assert.equal(report.previousAttempts[0].run.budget.terminal, true);
  assert.equal(report.run.budget.reservedMicrousd, 5000);
  assert.equal(report.run.budget.unknownCostCalls, 1);
  assert.equal(report.run.budget.calls, 1);
  assert.equal(report.run.budget.capMicrousd, 10000);
  assert.notEqual(report.run.runId, "previous");
  const tooSmall = {
    run: { ...run, budget: { ...run.budget, reservedMicrousd: 7000 } },
    roleCheck: { status: "failed", errorCode: "OTARI_BUDGET_DENIED" },
  };
  assert.throws(() => prepareFundingRetry(tooSmall), /Remaining shared allowance/);
  assert.throws(() => prepareFundingRetry({ run, roleCheck: { status: "passed" } }));
});

test("hosted insufficient funds and missing pricing remain distinct terminal refusals", async (t) => {
  for (const [upstream, expected] of [
    ["insufficient_funds", "OTARI_INSUFFICIENT_FUNDS"],
    ["pricing_required", "OTARI_PRICING_REQUIRED"],
  ]) {
    let calls = 0;
    t.mock.method(global, "fetch", async () => {
      calls++;
      return Response.json({ code: upstream }, { status: 402 });
    });
    const g = gateway(),
      run = g.createRun("test");
    await assert.rejects(
      g.request("/chat/completions", {}, "extraction", run, async () => {}),
      { code: expected },
    );
    assert.equal(run.events[0].httpStatus, 402);
    assert.equal(run.events[0].upstreamCode, upstream);
    assert.ok(run.budget.terminal);
    await assert.rejects(g.request("/chat/completions", {}, "extraction", run, async () => {}));
    assert.equal(calls, 1);
  }
});
test("MCP discovery outages are actionable, preserve saved search and do not replay spending", async (t) => {
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return Response.json(
      { error: { message: "untrusted provider text with credentials must not be retained" } },
      { status: 502, headers: { "Otari-Request-ID": "req_fixture_mcp" } },
    );
  });
  const g = gateway(),
    run = g.createRun("test");
  run.events.push({
    sequence: 1,
    at: new Date().toISOString(),
    operation: "scientific_search_tool",
    status: "completed",
    correlationId: "fixture-search",
  });
  const before = structuredClone(run.budget);
  let saved = 0;
  await assert.rejects(
    g.request("/mcp/servers/fixture/tools", undefined, "mcp_discovery", run, async () => {
      saved++;
    }),
    (error) =>
      error.code === "OTARI_MCP_UNAVAILABLE" &&
      /HTTP 502/.test(error.message) &&
      /authentication header/.test(error.message),
  );
  assert.equal(calls, 1);
  assert.equal(saved, 2);
  assert.deepEqual(run.budget, before);
  assert.equal(run.events[0].status, "completed");
  assert.equal(run.events[1].code, "OTARI_MCP_UNAVAILABLE");
  assert.equal(run.events[1].requestId, "req_fixture_mcp");
  assert.ok(!JSON.stringify(run).includes("untrusted provider text"));
});

test("role requests declare a strict wire schema while retaining full local validation", async (t) => {
  t.mock.method(global, "fetch", async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    return Response.json(
      { choices: [{ finish_reason: "stop", message: { content: "{}" } }] },
      { headers: { "Otari-Model": "test-model" } },
    );
  });
  await gateway().complete("extraction", "Return JSON", {}, gateway().createRun("test"), async () => {});
});
test("native-format validation retry is bounded and preserves all prior costs", () => {
  const { prepareFormatRetry } = require("../../../scripts/smoke-roles.cjs");
  const run = gateway().createRun("test");
  run.budget.capMicrousd = 10000;
  run.budget.reservedMicrousd = 5000;
  run.budget.reportedMicrousd = 326;
  run.budget.calls = 2;
  const report = { run, roleCheck: { status: "failed", errorCode: "OTARI_INVALID_JSON" } };
  prepareFormatRetry(report);
  assert.equal(report.run.budget.reportedMicrousd, 326);
  assert.equal(report.run.budget.reservedMicrousd, 5000);
  assert.equal(report.previousAttempts[0].run.budget.calls, 2);
  report.previousAttempts.push(structuredClone({ run: report.run, roleCheck: report.roleCheck }));
  report.roleCheck = { status: "failed", errorCode: "OTARI_INVALID_JSON" };
  assert.throws(() => prepareFormatRetry(report), /already been used/);
});

test("minimal role bounds are explicit and invalid bounds cannot dispatch", async (t) => {
  let calls = 0;
  t.mock.method(global, "fetch", async (url, init) => {
    calls++;
    const b = JSON.parse(init.body);
    assert.equal(b.max_tokens, 2000);
    assert.equal(b.reasoning_effort, "low");
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: "{}" } }] });
  });
  const g = gateway();
  await g.complete("extraction", "JSON", {}, g.createRun("test"), async () => {}, {
    maxOutputTokens: 2000,
    reasoningEffort: "low",
  });
  await assert.rejects(
    g.complete("extraction", "JSON", {}, g.createRun("test"), async () => {}, {
      maxOutputTokens: 100000,
      reasoningEffort: "low",
    }),
    { code: "OTARI_CONFIGURATION" },
  );
  assert.equal(calls, 1);
});
