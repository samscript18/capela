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
test("run schema exports to JSON Schema and OpenAPI models load without transforms", () => {
  const { z } = require("zod");
  const { parseStoredResearchRun } = require("@capela/shared");
  assert.equal(z.toJSONSchema(ResearchRunSchema).type, "object");
  assert.doesNotThrow(() => require("../dist/openapi/openapi.models"));
  const stored = gateway().createRun("stored-fixture");
  stored.audit = null;
  stored.checkpoint = null;
  stored.events = [
    {
      sequence: 1,
      at: new Date().toISOString(),
      operation: "mcp_discovery",
      status: "completed",
      correlationId: "fixture",
      provider: null,
      model: null,
    },
  ];
  const loaded = parseStoredResearchRun(stored);
  assert.equal(loaded.events[0].provider, undefined);
  assert.equal(stored.events[0].provider, null);
  assert.equal(loaded.audit, undefined);
  assert.equal(loaded.checkpoint, undefined);
  assert.equal(stored.audit, null);
  assert.equal(stored.checkpoint, null);
  assert.throws(() => parseStoredResearchRun({ ...stored, audit: "malformed" }));
  assert.throws(() => parseStoredResearchRun({ ...stored, checkpoint: 123 }));
  stored.events[0].sequence = null;
  assert.throws(() => parseStoredResearchRun(stored));
});
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
  assert.equal(r.budget.reservedMicrousd, 60000);
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
test("explicit search rejects absent tools, wrong queries, unsafe sources and unfinished tools without fallback", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  const variants = [
    toolSearchResponse({ otari_tool_calls: [] }),
    toolSearchResponse({ choices: [{ finish_reason: "tool_calls" }] }),
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
test("HTTP-200 search validation failures persist redacted actionable diagnostics without replay", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  const malformed = toolSearchResponse();
  malformed.otari_tool_calls[0].sources[0].title = { secret: "must-never-appear" };
  const variants = [
    [malformed, "OTARI_SEARCH_SCHEMA", /otari_tool_calls\.0\.sources\.0\.title/],
    [
      toolSearchResponse({ choices: [{ finish_reason: "content_filter" }] }),
      "OTARI_SEARCH_INCOMPLETE",
      /content_filter/,
    ],
    [toolSearchResponse({ otari_tool_calls: undefined }), "OTARI_SEARCH_SCHEMA", /otari_tool_calls/],
  ];
  let current,
    calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return Response.json(current, { headers: { "Otari-Request-ID": "req_search_fixture" } });
  });
  for (const [data, code, message] of variants) {
    current = data;
    const g = gateway(),
      run = g.createRun("test");
    let persisted;
    await assert.rejects(
      hostedScientificSearch(g, { preferredName: "curcumin" }, run, async () => {
        persisted = structuredClone(run);
      }),
      (error) => {
        assert.equal(error.code, code);
        assert.match(error.message, message);
        assert.ok(!error.message.includes("must-never-appear"));
        return true;
      },
    );
    assert.equal(persisted.events[0].status, "failed");
    assert.equal(persisted.events[0].code, code);
    assert.equal(persisted.events[0].httpStatus, 200);
    assert.equal(persisted.events[0].requestId, "req_search_fixture");
    assert.equal(persisted.budget.calls, 1);
    assert.ok(!JSON.stringify(persisted).includes("must-never-appear"));
  }
  assert.equal(calls, variants.length);
});

test("length-limited assistant text does not discard completed search metadata or trigger paid replay", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  let calls = 0;
  t.mock.method(global, "fetch", async (_url, init) => {
    calls++;
    assert.equal(JSON.parse(init.body).max_tokens, 600);
    return Response.json(
      toolSearchResponse({
        choices: [{ finish_reason: "length", message: { content: "Invented assistant citation must-not-be-used" } }],
      }),
      { headers: { "Otari-Request-ID": "req_completed_search_fixture" } },
    );
  });
  const g = gateway(),
    run = g.createRun("test");
  let persisted;
  const result = await hostedScientificSearch(g, { preferredName: "curcumin" }, run, async () => {
    persisted = structuredClone(run);
  });
  assert.deepEqual(result.results, [
    {
      title: "Synthetic adapter fixture",
      url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
      snippet: "",
    },
  ]);
  assert.equal(calls, 1);
  assert.equal(persisted.budget.calls, 1);
  assert.equal(persisted.budget.reservedMicrousd, 60000);
  assert.equal(persisted.events[0].status, "completed");
  assert.equal(persisted.events[0].requestId, "req_completed_search_fixture");
  assert.equal(persisted.events[0].toolCallId, "otari_ws_test");
  assert.ok(persisted.limitations.some((l) => l.includes("assistant response reached its output limit")));
  assert.ok(!JSON.stringify(persisted).includes("must-not-be-used"));
  assert.equal(run.snapshots.length, 0); // Discovery metadata is not scientific evidence.
});

test("length does not excuse invalid, absent, failed or blocked search tool metadata", async (t) => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  const variants = [];
  const add = (mutate, code) => {
    const d = toolSearchResponse({ choices: [{ finish_reason: "length" }] });
    mutate(d);
    variants.push([d, code]);
  };
  add((d) => {
    delete d.otari_tool_calls;
  }, "OTARI_SEARCH_SCHEMA");
  add((d) => {
    d.otari_tool_calls = [];
  }, "OTARI_SEARCH_SCHEMA");
  add((d) => {
    d.otari_tool_calls[0].status = "in_progress";
  }, "OTARI_SEARCH_SCHEMA");
  add((d) => {
    d.otari_tool_calls[0].status = "failed";
  }, "OTARI_SEARCH_NOT_EXECUTED");
  add((d) => {
    d.otari_tool_calls.push(d.otari_tool_calls[0]);
  }, "OTARI_SEARCH_NOT_EXECUTED");
  add((d) => {
    d.otari_tool_calls[0].query = "wrong query";
  }, "OTARI_SEARCH_QUERY");
  add((d) => {
    delete d.otari_tool_calls[0].sources;
  }, "OTARI_SEARCH_QUERY");
  add((d) => {
    d.otari_tool_calls[0].sources[0].url = "https://127.0.0.1/12345";
  }, "UNSAFE_SOURCE_URL");
  add((d) => {
    d.otari_tool_calls[0].error = { tag: "budget_exceeded" };
  }, "OTARI_BUDGET_DENIED");
  add((d) => {
    d.otari_tool_calls[0].error = { tag: "guardrail_blocked" };
  }, "OTARI_GUARDRAIL_BLOCKED");
  let current,
    calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return Response.json(current);
  });
  for (const [data, code] of variants) {
    current = data;
    const g = gateway(),
      run = g.createRun("test");
    await assert.rejects(
      hostedScientificSearch(g, { preferredName: "curcumin" }, run, async () => {}),
      { code },
    );
    assert.equal(run.events[0].status, "failed");
    assert.equal(run.budget.calls, 1);
    assert.equal(
      run.limitations.some((l) => l.includes("assistant response reached its output limit")),
      false,
    );
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
  limited.budget.capMicrousd = 59999;
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
test("reference errors identify stage and counts without leaking returned identifiers", () => {
  assert.throws(
    () => exactIds(["a", "b"], ["a", "a", "private-returned-value"], "Extraction paper coverage"),
    (error) => {
      assert.equal(error.code, "INVALID_IDS");
      assert.match(error.message, /Extraction paper coverage/);
      assert.match(
        error.message,
        /expected 2, received 3; missing 1, duplicate expected 0, duplicate received 1, unknown 1/,
      );
      assert.ok(!error.message.includes("private-returned-value"));
      return true;
    },
  );
});
test("invalid extraction coverage or global claim IDs stops before review or audit", async () => {
  const { s, c } = fixture();
  const paper = { id: c.paperId };
  for (const [output, label] of [
    [{ papers: [] }, /Extraction paper coverage/],
    [{ papers: [{ paperId: c.paperId, claims: [c, c], limitations: [] }] }, /Extraction claim uniqueness/],
  ]) {
    const g = gateway(),
      run = g.createRun("test");
    run.snapshots = [s];
    const roles = [];
    g.complete = async (role, prompt, input) => {
      roles.push(role);
      assert.deepEqual(input.expectedPaperIds, [paper.id]);
      assert.match(prompt, /globally unique/);
      return output;
    };
    g.request = async () => {
      throw new Error("Audit must not run on invalid IDs");
    };
    const service = new OtariEvidenceService(g, new EvidenceClassifierService());
    await assert.rejects(
      service.extract([paper], {}, run, async () => {}),
      (error) => {
        assert.equal(error.code, "INVALID_IDS");
        assert.match(error.message, label);
        return true;
      },
    );
    assert.deepEqual(roles, ["extraction"]);
    assert.equal(run.decisions.length, 0);
  }
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
test("review literature can support a reported finding without becoming primary experimental evidence", () => {
  const { s, c, r } = fixture("This review reports that curcumin may regulate inflammation.");
  c.finding = s.text;
  c.proposedClass = "literature_reported";
  c.studyType = "review";
  c.relationship = "unknown";
  c.model = null;
  r.evidenceType = "literature_reported";
  const supported = decide(c, r, [s]);
  assert.equal(supported.status, "accepted");
  assert.equal(supported.publishedClass, "literature_reported");
  assert.equal(decide(c, { ...r, evidenceType: "direct_experimental" }, [s]).status, "rejected");
  assert.equal(decide(c, { ...r, verdict: "unsupported" }, [s]).status, "rejected");
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
test("extraction is one bounded abstract per call and retains completed batches on later timeout", async () => {
  const { ResearchError } = require("../dist/research/provenance");
  const { s, c } = fixture();
  const run = gateway().createRun("batch-fixture");
  run.snapshots = [s, { ...s, paperId: "second-paper", id: "second-snapshot" }];
  let calls = 0,
    saved;
  const g = gateway();
  g.complete = async (role, prompt, input, retained, save, bounds) => {
    assert.equal(role, "extraction");
    assert.equal(input.papers.length, 1);
    assert.equal(input.snapshots.length, 1);
    assert.equal(bounds.maxOutputTokens, 2000);
    if (++calls === 2) throw new ResearchError("OTARI_UPSTREAM_TIMEOUT", "Fixture 504");
    return { papers: [{ paperId: c.paperId, claims: [c], limitations: [] }] };
  };
  await assert.rejects(
    new OtariEvidenceService(g, new EvidenceClassifierService()).extract(
      [{ id: c.paperId }, { id: "second-paper" }],
      {},
      run,
      async () => {
        saved = structuredClone(run);
      },
    ),
    { code: "OTARI_UPSTREAM_TIMEOUT" },
  );
  assert.equal(calls, 2);
  assert.equal(saved.checkpoint, "extracting");
  assert.equal(saved.decisions.length, 1);
  assert.equal(saved.decisions[0].candidate.id, c.id);
  assert.notEqual(saved.decisions[0].status, "accepted");
});
test("upstream 504 retains charge uncertainty and reservation without paid retry", async (t) => {
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return new Response("Gateway timeout", { status: 504 });
  });
  const g = gateway(),
    run = g.createRun("timeout-fixture");
  await assert.rejects(
    g.request("/chat/completions", {}, "extraction", run, async () => {}),
    { code: "OTARI_UPSTREAM_TIMEOUT" },
  );
  assert.equal(calls, 1);
  assert.equal(run.dispatchUncertain, true);
  assert.equal(run.budget.reservedMicrousd, 10000);
  assert.equal(run.budget.unknownCostCalls, 1);
  assert.equal(run.events[0].httpStatus, 504);
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
test("known sandbox price is reserved even when model reservations are smaller", async (t) => {
  const { remoteAudit } = require("../dist/research/evidence-audit");
  const { s, c } = fixture();
  const g = new OtariGatewayService({ get: (k) => (k === "OTARI_CALL_RESERVATION_MICROUSD" ? "1200" : config.get(k)) });
  const r = g.createRun("test");
  r.snapshots = [s];
  t.mock.method(global, "fetch", async () =>
    Response.json({ return_code: 0, stderr: "", stdout: JSON.stringify(localAudit([c], [s])) }),
  );
  await remoteAudit(g, [c], r, async () => {});
  assert.equal(r.budget.reservedMicrousd, 10000);
  assert.equal(r.audit.valid, true);
});
test("read-only discovery retries once on 502 and never retries spending denial", async () => {
  const { ResearchError } = require("../dist/research/provenance");
  const g = gateway(),
    r = g.createRun("test");
  let calls = 0,
    code = "OTARI_MCP_UNAVAILABLE";
  g.request = async () => {
    calls++;
    r.events.push({ httpStatus: 502 });
    if (calls === 1) throw new ResearchError(code, "Fixture failure");
    return { data: { server_id: "server" } };
  };
  const service = new OtariRetrievalService(g);
  assert.deepEqual(await service.discover("server", r, async () => {}), { server_id: "server" });
  assert.equal(calls, 2);
  calls = 0;
  code = "OTARI_BUDGET_DENIED";
  await assert.rejects(
    service.discover("server", r, async () => {}),
    { code: "OTARI_BUDGET_DENIED" },
  );
  assert.equal(calls, 1);
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

test("settled cost above an estimate does not exhaust a funded run; later dispatch still checks total allowance", async (t) => {
  const g = gateway(),
    run = g.createRun("estimate-overrun");
  run.budget.capMicrousd = 20000000;
  let calls = 0;
  t.mock.method(global, "fetch", async () => {
    calls++;
    return Response.json({ usage: { cost_usd: calls === 1 ? "0.057036" : "0.000001" } });
  });
  await g.request("/chat/completions", {}, "scientific_search_tool", run, async () => {}, 12000);
  assert.equal(run.budget.reportedMicrousd, 57036);
  assert.equal(run.budget.reservedMicrousd, 0);
  assert.equal(run.budget.terminal, false);
  assert.match(run.limitations.at(-1), /exceeded its estimated reservation/);
  await g.request("/mcp/execute", {}, "publication_metadata", run, async () => {});
  assert.equal(calls, 2);
  assert.equal(run.budget.reportedMicrousd, 57037);
  run.budget.capMicrousd = 57038;
  await assert.rejects(
    g.request("/chat/completions", {}, "extraction", run, async () => {}),
    { code: "RUN_BUDGET_EXHAUSTED" },
  );
  assert.equal(calls, 2);
});

test("settled charges that consume the actual run cap remain terminal", async (t) => {
  for (const cap of [57036, 50000]) {
    const g = gateway(),
      run = g.createRun("actual-exhaustion");
    run.budget.capMicrousd = cap;
    let calls = 0;
    t.mock.method(global, "fetch", async () => {
      calls++;
      return Response.json({ usage: { cost_usd: "0.057036" } });
    });
    await g.request("/chat/completions", {}, "scientific_search_tool", run, async () => {}, 12000);
    assert.equal(run.budget.terminal, true);
    assert.equal(run.budget.reportedMicrousd, 57036);
    await assert.rejects(
      g.request("/mcp/servers/test/tools", undefined, "mcp_discovery", run, async () => {}),
      { code: "RUN_BUDGET_EXHAUSTED" },
    );
    assert.equal(calls, 1);
  }
});

const { VertexReviewService } = require("../dist/research/vertex-review.service");
const { ResearchError } = require("../dist/research/provenance");
const { REVIEW_PROMPT } = require("../dist/research/otari-evidence.service");
function vertexReviewer(response) {
  const service = new VertexReviewService({
    get: (k) =>
      ({ OTARI_REVIEW_FALLBACK: "vertex", GOOGLE_CLOUD_API_KEY: "fixture-only-key", GEMINI_MODEL: "gemini-3.8-flash" })[
        k
      ],
  });
  service.client = { models: { generateContent: response } };
  return service;
}
test("explicit Vertex fallback is transient-only and cannot bypass budgets, guardrails or invalid scientific output", async () => {
  const run = gateway().createRun("fixture");
  const v = vertexReviewer(async () => {
    throw new Error("Must not dispatch");
  });
  for (const code of [
    "OTARI_BUDGET_DENIED",
    "RUN_BUDGET_EXHAUSTED",
    "OTARI_INSUFFICIENT_FUNDS",
    "OTARI_GUARDRAIL_BLOCKED",
    "OTARI_INVALID_JSON",
    "INVALID_RESEARCH_SCHEMA",
  ])
    assert.equal(v.canFallback(new ResearchError(code, "Fixture"), run), false);
  assert.equal(v.canFallback(new ResearchError("OTARI_UPSTREAM_TIMEOUT", "Fixture"), run), true);
  run.budget.terminal = true;
  assert.equal(v.canFallback(new ResearchError("OTARI_UPSTREAM_TIMEOUT", "Fixture"), run), false);
  const disabled = new VertexReviewService({ get: () => undefined });
  await assert.rejects(
    disabled.review("", {}, run, async () => {}, 2000),
    { code: "VERTEX_NOT_CONFIGURED" },
  );
});
test("Vertex review preserves the Otari uncertain reservation, reserves external cost, and records observed identity", async () => {
  const { r } = fixture();
  const run = gateway().createRun("fixture");
  run.budget.reservedMicrousd = 10000;
  run.budget.unknownCostCalls = 1;
  run.budget.calls = 1;
  run.dispatchUncertain = true;
  run.models.extraction = "fixture-extractor";
  run.events = [
    {
      sequence: 1,
      at: new Date().toISOString(),
      operation: "review",
      status: "failed",
      correlationId: "prior-timeout",
      code: "OTARI_UPSTREAM_TIMEOUT",
      httpStatus: 504,
    },
  ];
  let calls = 0,
    saves = 0;
  const v = vertexReviewer(async (request) => {
    calls++;
    assert.equal(request.config.systemInstruction, REVIEW_PROMPT);
    assert.equal(request.config.maxOutputTokens, 2000);
    assert.deepEqual(request.config.httpOptions.retryOptions, { attempts: 1 });
    assert.deepEqual(JSON.parse(request.contents).claims, ["immutable-fixture"]);
    assert.ok(saves > 0);
    return {
      candidates: [{ finishReason: "STOP" }],
      modelVersion: "gemini-3.8-flash-001",
      responseId: "actual-response",
      text: JSON.stringify({ reviews: [r] }),
    };
  });
  const result = await v.review(
    REVIEW_PROMPT,
    { claims: ["immutable-fixture"] },
    run,
    async () => {
      saves++;
    },
    2000,
  );
  assert.equal(result.reviews[0].claimId, r.claimId);
  assert.equal(calls, 1);
  assert.equal(run.budget.reservedMicrousd, 110000);
  assert.equal(run.budget.unknownCostCalls, 2);
  assert.equal(run.models.review, "gemini-3.8-flash-001");
  assert.equal(run.events[0].status, "failed");
  assert.equal(run.events[1].provider, "vertex-ai");
  assert.equal(run.events[1].requestId, "actual-response");
  assert.equal(run.events[1].costMicrousd, undefined);
  assert.equal(run.dispatchUncertain, true);
  assert.ok(run.limitations.some((s) => s.includes("billed by Google")));
  assert.ok(ResearchRunSchema.safeParse(run).success);
});
test("Vertex never dispatches after fencing failure or an unaffordable reservation", async () => {
  let calls = 0;
  const v = vertexReviewer(async () => {
    calls++;
    throw new Error("Must not dispatch");
  });
  const run = gateway().createRun("fixture");
  await assert.rejects(
    v.review(
      "",
      {},
      run,
      async () => {
        throw new Error("Lease lost");
      },
      2000,
    ),
    /Lease lost/,
  );
  assert.equal(calls, 0);
  const small = gateway().createRun("fixture");
  small.budget.capMicrousd = 99999;
  await assert.rejects(
    v.review("", {}, small, async () => {}, 2000),
    { code: "RUN_BUDGET_EXHAUSTED" },
  );
  assert.equal(calls, 0);
});
test("Vertex truncated, malformed and unidentifiable reviews fail without replay or manufactured results", async () => {
  for (const response of [
    { candidates: [{ finishReason: "MAX_TOKENS" }], modelVersion: "fixture", text: "{}" },
    { candidates: [{ finishReason: "SAFETY" }], modelVersion: "fixture", text: "{}" },
    { candidates: [{ finishReason: "STOP" }], text: "{}" },
    { candidates: [{ finishReason: "STOP" }], modelVersion: "fixture", text: "invalid json" },
    { candidates: [{ finishReason: "STOP" }], modelVersion: "fixture", text: "{}" },
  ]) {
    let calls = 0;
    const v = vertexReviewer(async () => {
      calls++;
      return response;
    });
    const run = gateway().createRun("fixture");
    await assert.rejects(v.review("", {}, run, async () => {}, 2000));
    assert.equal(calls, 1);
    assert.equal(run.budget.reservedMicrousd, 100000);
    assert.equal(run.budget.unknownCostCalls, 1);
    assert.equal(run.events[0].status, "failed");
    assert.deepEqual(run.decisions, []);
  }
});
test("hybrid review fallback and checkpoint resume retain exact-span validation and hosted sandbox publication gate", async () => {
  const { s, c, r } = fixture("Aspirin altered a marker in mice.");
  const paper = {
    id: c.paperId,
    title: "Synthetic fixture",
    abstract: s.text,
    publicationTypes: [],
    studyType: "journal_article",
  };
  for (const resume of [false, true]) {
    const run = gateway().createRun("hybrid-fixture");
    run.snapshots = [s];
    let extractionCalls = 0,
      otariReviewCalls = 0,
      vertexCalls = 0,
      audits = 0;
    if (resume) {
      run.checkpoint = "extracted";
      run.reviewRoute = "vertex";
      run.models.extraction = "fixture-extractor";
      run.decisions = [decide(c, undefined, [s])];
    }
    const g = gateway();
    g.complete = async (role) => {
      if (role === "extraction") {
        extractionCalls++;
        run.models.extraction = "fixture-extractor";
        return { papers: [{ paperId: c.paperId, claims: [c], limitations: [] }] };
      }
      otariReviewCalls++;
      throw new ResearchError("OTARI_UPSTREAM_TIMEOUT", "Synthetic 504");
    };
    g.request = async (path) => {
      assert.equal(path, "/code/execute");
      audits++;
      return { data: { return_code: 0, stderr: "", stdout: JSON.stringify(localAudit([c], [s])) }, event: {} };
    };
    const vertex = vertexReviewer(async () => {
      vertexCalls++;
      return {
        candidates: [{ finishReason: "STOP" }],
        modelVersion: "gemini-3.8-flash-001",
        text: JSON.stringify({ reviews: [r] }),
      };
    });
    const service = new OtariEvidenceService(g, new EvidenceClassifierService(), vertex);
    const result = await service.extract([paper], { preferredName: "aspirin" }, run, async () => {});
    assert.equal(extractionCalls, resume ? 0 : 1);
    assert.equal(otariReviewCalls, resume ? 0 : 1);
    assert.equal(vertexCalls, 1);
    assert.equal(audits, 1);
    assert.equal(result.claims.length, 1);
    assert.equal(run.checkpoint, "audited");
    assert.ok(referenceValid(run.decisions[0].candidate, run.snapshots));
    assert.equal(run.models.review, "gemini-3.8-flash-001");
  }
});

test("Vertex SDK authorization/model failures stay sanitized, retain charges and are not retried", async () => {
  for (const [status, code] of [
    [403, "VERTEX_AUTHORIZATION_DENIED"],
    [404, "VERTEX_MODEL_UNAVAILABLE"],
    [429, "VERTEX_RATE_LIMITED"],
  ]) {
    let calls = 0;
    const v = vertexReviewer(async () => {
      calls++;
      throw Object.assign(new Error("private-provider-message"), { status });
    });
    const run = gateway().createRun("fixture");
    await assert.rejects(
      v.review("", {}, run, async () => {}, 2000),
      (error) => error.code === code && !error.message.includes("private-provider-message"),
    );
    assert.equal(calls, 1);
    assert.equal(run.events[0].httpStatus, status);
    assert.equal(run.budget.reservedMicrousd, 100000);
  }
});

test("Gemini is pinned to 3.8 Flash and never accepts a lower configured or resolved model", async () => {
  for (const model of ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-4-argon"]) {
    const v = new VertexReviewService({
      get: (key) =>
        ({ OTARI_REVIEW_FALLBACK: "vertex", GEMINI_MODEL: model, GOOGLE_CLOUD_API_KEY: "fixture-only" })[key],
    });
    const run = gateway().createRun("fixture");
    await assert.rejects(
      v.review("", {}, run, async () => {}, 8000),
      { code: "VERTEX_CONFIGURATION" },
    );
    assert.equal(run.budget.calls, 0);
    const { AiEvidenceService } = require("../dist/research/ai-evidence.service");
    assert.throws(
      () => new AiEvidenceService({ get: (key) => (key === "GEMINI_MODEL" ? model : undefined) }),
      /Only gemini-3.8-flash/,
    );
  }
  const v = vertexReviewer(async (request) => {
    assert.equal(request.model, "gemini-3.8-flash");
    assert.deepEqual(request.config.thinkingConfig, { thinkingLevel: "LOW" });
    return {
      candidates: [{ finishReason: "STOP" }],
      modelVersion: "gemini-2.5-flash",
      text: JSON.stringify({ reviews: [] }),
    };
  });
  await assert.rejects(
    v.review("", {}, gateway().createRun("fixture"), async () => {}, 8000),
    { code: "VERTEX_MODEL_UNVERIFIED" },
  );
});
test("Vertex diagnostics distinguish truncation, blocking, empty output and candidate count without retaining response text", async () => {
  const variants = [
    [
      {
        candidates: [{ finishReason: "MAX_TOKENS" }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, thoughtsTokenCount: 7 },
        text: "private-generated-response",
      },
      "VERTEX_OUTPUT_TRUNCATED",
    ],
    [{ candidates: [{ finishReason: "SAFETY" }], text: "private-generated-response" }, "VERTEX_REVIEW_BLOCKED"],
    [{ candidates: [], promptFeedback: { blockReason: "SAFETY" } }, "VERTEX_REVIEW_BLOCKED"],
    [{ candidates: [{ finishReason: "STOP" }], text: "" }, "VERTEX_EMPTY_COMPLETION"],
    [{ candidates: [{ finishReason: "STOP" }, { finishReason: "STOP" }], text: "{}" }, "VERTEX_INVALID_COMPLETION"],
  ];
  for (const [response, code] of variants) {
    const v = vertexReviewer(async () => ({
      modelVersion: "gemini-3.8-flash-001",
      responseId: "actual-response-fixture",
      ...response,
    }));
    const run = gateway().createRun("fixture");
    await assert.rejects(
      v.review("", { expectedClaimIds: ["claim-fixture"] }, run, async () => {}, 8000),
      { code },
    );
    const event = run.events.at(-1);
    assert.equal(event.model, "gemini-3.8-flash-001");
    assert.equal(event.requestId, "actual-response-fixture");
    assert.deepEqual(event.claimIds, ["claim-fixture"]);
    assert.equal(event.finishReason, response.candidates[0]?.finishReason ?? "MISSING");
    assert.ok(!JSON.stringify(run).includes("private-generated-response"));
    assert.ok(ResearchRunSchema.safeParse(run).success);
    if (code === "VERTEX_OUTPUT_TRUNCATED") {
      assert.equal(event.inputTokens, 10);
      assert.equal(event.outputTokens, 3);
      assert.equal(event.thoughtTokens, 7);
    }
  }
});
test("Vertex reviews at most two claims per call and retry skips successful review batches", async () => {
  const { s, c, r } = fixture("Aspirin altered a marker in mice.");
  const claims = [1, 2, 3].map((i) => ({ ...c, id: `claim-${i}` }));
  const paper = {
    id: c.paperId,
    title: "Synthetic fixture",
    abstract: s.text,
    publicationTypes: [],
    studyType: "journal_article",
  };
  const run = gateway().createRun("partial-vertex");
  run.budget.capMicrousd = 1000000;
  run.snapshots = [s];
  run.decisions = claims.map((claim) => decide(claim, undefined, [s]));
  run.checkpoint = "extracted";
  run.reviewRoute = "vertex";
  run.models.extraction = "fixture-extractor";
  const seen = [];
  const vertex = vertexReviewer(async (request) => {
    const input = JSON.parse(request.contents);
    assert.ok(input.claims.length <= 2);
    assert.equal(input.papers.length, 1);
    assert.equal(input.snapshots.length, 1);
    assert.equal(request.config.maxOutputTokens, 8000);
    seen.push(input.expectedClaimIds);
    if (seen.length === 2) throw Object.assign(new Error("Fixture timeout"), { status: 504 });
    return {
      candidates: [{ finishReason: "STOP" }],
      modelVersion: "gemini-3.8-flash-001",
      text: JSON.stringify({ reviews: input.claims.map((claim) => ({ ...r, claimId: claim.id })) }),
    };
  });
  const g = gateway();
  g.complete = async () => {
    throw new Error("Saved extraction must not repeat");
  };
  let audits = 0;
  g.request = async () => {
    audits++;
    return { event: {}, data: { return_code: 0, stderr: "", stdout: JSON.stringify(localAudit(claims, [s])) } };
  };
  const service = new OtariEvidenceService(g, new EvidenceClassifierService(), vertex);
  let persisted;
  const save = async () => {
    persisted = structuredClone(run);
  };
  await assert.rejects(service.extract([paper], { preferredName: "aspirin" }, run, save), {
    code: "VERTEX_REVIEW_UNAVAILABLE",
  });
  assert.equal(audits, 0);
  assert.equal(persisted.checkpoint, "extracted");
  assert.equal(persisted.decisions.filter((d) => d.review).length, 2);
  assert.equal(persisted.budget.reservedMicrousd, 200000);
  const result = await service.extract([paper], { preferredName: "aspirin" }, run, save);
  assert.deepEqual(seen, [["claim-1", "claim-2"], ["claim-3"], ["claim-3"]]);
  assert.equal(result.claims.length, 3);
  assert.equal(audits, 1);
  assert.equal(run.checkpoint, "audited");
  assert.equal(run.budget.reservedMicrousd, 300000);
});
test("hybrid call ceiling accounts for bounded per-source extraction and review batches", () => {
  const hybrid = new OtariGatewayService({
    get: (key) => (key === "OTARI_REVIEW_FALLBACK" ? "vertex" : undefined),
  }).createRun("fixture");
  assert.equal(hybrid.budget.maxCalls, 24);
  assert.equal(gateway().createRun("fixture").budget.maxCalls, 16);
});

test("Vertex batch missing or duplicate claim IDs cannot mark a batch reviewed or advance publication", async () => {
  const { s, c, r } = fixture();
  const claims = [1, 2, 3].map((i) => ({ ...c, id: `c${i}` }));
  const run = gateway().createRun("coverage-fixture");
  run.snapshots = [s];
  run.checkpoint = "extracted";
  run.reviewRoute = "vertex";
  run.decisions = claims.map((claim) => decide(claim, undefined, [s]));
  let calls = 0;
  const vertex = vertexReviewer(async () => {
    calls++;
    return {
      candidates: [{ finishReason: "STOP" }],
      modelVersion: "gemini-3.8-flash-001",
      text: JSON.stringify({
        reviews: [
          { ...r, claimId: "c1" },
          { ...r, claimId: "c1" },
        ],
      }),
    };
  });
  const g = gateway();
  g.request = async () => {
    throw new Error("Invalid batch must not reach audit");
  };
  const service = new OtariEvidenceService(g, new EvidenceClassifierService(), vertex);
  await assert.rejects(
    service.extract([{ id: c.paperId, abstract: s.text }], {}, run, async () => {}),
    { code: "INVALID_IDS" },
  );
  assert.equal(calls, 1);
  assert.ok(run.decisions.every((d) => !d.review));
  assert.equal(run.events.at(-1).status, "failed");
  assert.equal(run.events.at(-1).code, "INVALID_IDS");
});

test("legacy Gemini compatibility also rejects a resolved lower model instead of accepting its output", async () => {
  const { AiEvidenceService } = require("../dist/research/ai-evidence.service");
  const service = new AiEvidenceService({ get: (key) => (key === "GEMINI_MODEL" ? "gemini-3.8-flash" : undefined) });
  let calls = 0;
  service.geminiClient = {
    models: {
      generateContent: async (request) => {
        calls++;
        assert.equal(request.model, "gemini-3.8-flash");
        assert.deepEqual(request.config.thinkingConfig, { thinkingLevel: "LOW" });
        return { modelVersion: "gemini-2.5-flash", candidates: [{ finishReason: "STOP" }], text: "{}" };
      },
    },
  };
  await assert.rejects(
    service.extractGeminiBatch([], { preferredName: "fixture", synonyms: [], pubchemCid: 1 }),
    (error) => error.code === "AI_INVALID_RESPONSE" && /did not confirm gemini-3.8-flash/.test(error.message),
  );
  assert.equal(calls, 1);
});

test("hosted review batches retain checked reviews across a later timeout without replay", async () => {
  const { s, c, r } = fixture("Aspirin altered a marker in mice.");
  const run = gateway().createRun("review-batches");
  run.snapshots = [s];
  run.checkpoint = "extracted";
  run.models.extraction = "fixture-extractor";
  const candidates = [1, 2, 3].map((n) => ({ ...c, id: `${c.id}-${n}` }));
  run.decisions = candidates.map((claim) => decide(claim, undefined, [s]));
  const paper = { id: c.paperId, publicationTypes: [], studyType: "journal_article" };
  const g = gateway();
  let calls = 0,
    saved,
    fail = true,
    audits = 0;
  g.complete = async (role, prompt, input, retained, save, bounds) => {
    assert.equal(role, "review");
    assert.ok(input.claims.length <= 2);
    assert.equal(input.papers.length, 1);
    assert.equal(input.snapshots.length, 1);
    assert.ok(bounds.maxOutputTokens <= 4000);
    calls++;
    if (calls === 2 && fail) throw new ResearchError("OTARI_UPSTREAM_TIMEOUT", "Fixture timeout");
    run.models.review = "fixture-reviewer";
    run.models.distinct = true;
    if (calls === 3) assert.deepEqual(input.expectedClaimIds, [candidates[2].id]);
    return { reviews: input.claims.map((claim) => ({ ...r, claimId: claim.id })) };
  };
  g.request = async () => {
    audits++;
    return { data: { return_code: 0, stderr: "", stdout: JSON.stringify(localAudit(candidates, [s])) }, event: {} };
  };
  const service = new OtariEvidenceService(g, new EvidenceClassifierService());
  const save = async () => {
    saved = structuredClone(run);
  };
  await assert.rejects(service.extract([paper], {}, run, save), { code: "OTARI_UPSTREAM_TIMEOUT" });
  assert.equal(calls, 2);
  assert.equal(audits, 0);
  assert.equal(saved.checkpoint, "extracted");
  assert.equal(saved.decisions.filter((d) => d.review).length, 2);
  fail = false;
  const result = await service.extract([paper], {}, run, save);
  assert.equal(calls, 3);
  assert.equal(result.claims.length, 3);
  assert.equal(audits, 1);
});

test("production and paired evaluator share exact passage-index extraction input", () => {
  const { extractionInput } = require("../dist/research/otari-evidence.service");
  const { s, c } = fixture("Aspirin 🧪 altered a marker. It did not demonstrate human efficacy.");
  const paper = { id: c.paperId };
  const input = extractionInput(paper, { preferredName: "aspirin" }, [s]);
  assert.deepEqual(input.expectedPaperIds, [paper.id]);
  assert.deepEqual(input.snapshots, [s]);
  assert.equal(input.passageIndex[0].passages.length, 2);
  for (const span of input.passageIndex[0].passages) assert.equal(s.text.slice(span.start, span.end), span.quote);
});

test("hosted review rejects wrong batch IDs before caching or a subsequent dispatch", async () => {
  const { s, c, r } = fixture();
  const run = gateway().createRun("wrong-review-ids");
  run.snapshots = [s];
  run.checkpoint = "extracted";
  run.decisions = [decide(c, undefined, [s])];
  const g = gateway();
  let calls = 0;
  g.complete = async () => {
    calls++;
    return { reviews: [{ ...r, claimId: "invented" }] };
  };
  g.request = async () => {
    throw Error("Audit must not dispatch");
  };
  await assert.rejects(
    new OtariEvidenceService(g, new EvidenceClassifierService()).extract([{ id: c.paperId }], {}, run, async () => {}),
    { code: "INVALID_IDS" },
  );
  assert.equal(calls, 1);
  assert.equal(run.decisions[0].review, undefined);
});

test("a later distinct model cannot conceal an earlier review batch using the extractor", async () => {
  const { s, c, r } = fixture("Aspirin altered a marker in mice.");
  const run = gateway().createRun("role-collapse");
  run.snapshots = [s];
  run.checkpoint = "extracted";
  run.models.extraction = "fixture-extractor";
  const candidates = [1, 2, 3].map((n) => ({ ...c, id: `${c.id}-${n}` }));
  run.decisions = candidates.map((claim) => decide(claim, undefined, [s]));
  const g = gateway();
  let calls = 0;
  g.complete = async (role, prompt, input) => {
    const model = ++calls === 1 ? "fixture-extractor" : "fixture-reviewer";
    run.models.review = model;
    run.models.distinct = model !== run.models.extraction;
    run.events.push({
      sequence: calls,
      at: new Date().toISOString(),
      correlationId: `fixture-${calls}`,
      operation: role,
      status: "completed",
      model,
    });
    return { reviews: input.claims.map((claim) => ({ ...r, claimId: claim.id })) };
  };
  g.request = async () => ({
    data: { return_code: 0, stderr: "", stdout: JSON.stringify(localAudit([], [s])) },
    event: {},
  });
  const result = await new OtariEvidenceService(g, new EvidenceClassifierService()).extract(
    [{ id: c.paperId, publicationTypes: [], studyType: "journal_article" }],
    {},
    run,
    async () => {},
  );
  assert.equal(run.models.distinct, false);
  assert.equal(result.claims.length, 0);
  assert.equal(run.decisions.filter((d) => d.status === "unresolved").length, 3);
});

test("configured dispatch ceilings bound a qualifying verification run", () => {
  const g = new OtariGatewayService({ get: (k) => (k === "OTARI_RUN_MAX_CALLS" ? "5" : config.get(k)) });
  const run = g.createRun("five-call-run");
  assert.equal(run.budget.maxCalls, 5);
  for (let n = 0; n < 5; n++) reserve(run, 1);
  assert.throws(() => reserve(run, 1), { code: "RUN_BUDGET_EXHAUSTED" });
  assert.equal(run.budget.calls, 5);
});

test("validated hosted search checkpoint is durable and reused without paid search", async () => {
  const { hostedScientificSearch } = require("../dist/research/otari-search");
  const run = gateway().createRun("saved-search");
  const g = gateway();
  let calls = 0,
    saved;
  g.request = async () => {
    calls++;
    return { data: toolSearchResponse({}, "aspirin"), event: { requestId: "fixture-request" } };
  };
  const save = async () => {
    saved = structuredClone(run);
  };
  const first = await hostedScientificSearch(g, { preferredName: "aspirin" }, run, save);
  assert.equal(calls, 1);
  assert.equal(saved.discovery.toolCallId, "otari_ws_test");
  assert.deepEqual(
    saved.discovery.urls,
    first.results.map((r) => r.url),
  );
  const reloaded = ResearchRunSchema.parse(saved);
  const second = await hostedScientificSearch(g, { preferredName: "aspirin" }, reloaded, save);
  assert.equal(calls, 1);
  assert.deepEqual(
    second.results.map((r) => r.url),
    saved.discovery.urls,
  );
  await assert.rejects(hostedScientificSearch(g, { preferredName: "curcumin" }, reloaded, save), {
    code: "SEARCH_CHECKPOINT_MISMATCH",
  });
  assert.equal(calls, 1);
  assert.throws(() =>
    ResearchRunSchema.parse({ ...saved, discovery: { ...saved.discovery, urls: ["http://127.0.0.1/private"] } }),
  );
});

test("a shortened source quote with unchanged sentence offsets stays rejected", () => {
  // Regression from the live extraction boundary, expressed as synthetic source text.
  const { s, c, r } = fixture("Aspirin 🧪 may alter markers, but human efficacy remains uncertain.");
  const indexed = sourcePassages(s)[0];
  const shortened = { ...c, spans: [{ ...indexed, quote: indexed.quote.slice(0, -1) }] };
  assert.equal(referenceValid(shortened, [s]), false);
  assert.equal(decide(shortened, r, [s]).status, "rejected");
  assert.deepEqual(
    shortened.spans[0],
    { ...indexed, quote: indexed.quote.slice(0, -1) },
    "validation never repairs model offsets",
  );
  const whole = { ...c, spans: [indexed] };
  assert.equal(referenceValid(whole, [s]), true);
});
