require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { snapshot, referenceValid, decide } = require("../dist/research/provenance");
const {
  indexedSource,
  resolvePassages,
  hydrateExtraction,
  hydrateReviews,
} = require("../dist/research/passage-references");
const {
  ResearchRunSchema,
  parseStoredResearchRun,
  ExtractionSelectionSchema,
  ReviewSelectionSchema,
} = require("@capela/shared");
const { OtariGatewayService, roleWireSchema } = require("../dist/research/otari-gateway.service");
const { OtariEvidenceService } = require("../dist/research/otari-evidence.service");
const { EvidenceClassifierService } = require("../dist/research/evidence-classifier.service");
const { localAudit } = require("../dist/research/evidence-audit");
const text = "Aspirin 🧪 did not improve survival in mice. Binding was not measured; human efficacy remains uncertain.";
function fixtures() {
  const s = indexedSource(snapshot("123", "https://pubmed.ncbi.nlm.nih.gov/123/", text));
  const passageIds = [s.passageIndex.passages[0].id];
  const c = {
    id: "123-claim-1",
    paperId: "123",
    finding: "Aspirin did not improve survival in mice.",
    proposedClass: "indirect_experimental",
    kind: "activity",
    studyType: "experimental_in_vivo",
    model: "mice",
    measuredOutcome: "survival",
    label: "survival",
    relationship: null,
    passageIds,
  };
  const extraction = { version: "passage-selection-v1", papers: [{ paperId: "123", claims: [c], limitations: [] }] };
  const claim = hydrateExtraction(extraction, [s]).papers[0].claims[0];
  const review = {
    claimId: c.id,
    verdict: "supported",
    reason: "Synthetic support check",
    evidenceType: c.proposedClass,
    checks: { molecule: true, negation: true, studyContext: true, directness: true, sourceLimitations: true },
    passageIds,
    revisionPassageId: null,
  };
  return { s, c, claim, review, extraction };
}
test("IDs hydrate exact NFC/UTF-16 punctuation spans and backend-owned source references", () => {
  const { s, claim } = fixtures();
  assert.ok(referenceValid(claim, [s]));
  assert.equal(claim.spans[0].quote, "Aspirin 🧪 did not improve survival in mice.");
  assert.equal(s.text.slice(claim.spans[0].start, claim.spans[0].end), claim.spans[0].quote);
  assert.equal(claim.snapshotHash, s.hash);
  assert.equal(claim.passageSelection.indexHash, s.passageIndex.hash);
  const normalized = indexedSource(
    snapshot("456", "https://pubmed.ncbi.nlm.nih.gov/456/", "Cafe\u0301 🧪.\r\nNo improvement."),
  );
  for (const { id, span } of normalized.passageIndex.passages)
    assert.deepEqual(resolvePassages([id], normalized), [span]);
  assert.equal(normalized.text, "Café 🧪.\nNo improvement.");
});
test("unknown, stale, cross-source, missing and duplicate references never resolve", () => {
  const { s } = fixtures(),
    other = indexedSource(snapshot("456", "https://pubmed.ncbi.nlm.nih.gov/456/", text));
  const stale = indexedSource(snapshot("123", s.canonicalUrl, text + " New text."));
  for (const ids of [
    [],
    ["missing"],
    [other.passageIndex.passages[0].id],
    [stale.passageIndex.passages[0].id],
    Array(2).fill(s.passageIndex.passages[0].id),
  ])
    assert.throws(() => resolvePassages(ids, s), { code: "INVALID_PASSAGE_REFERENCE" });
  const legacy = { ...s };
  delete legacy.passageIndex;
  assert.throws(() => resolvePassages([s.passageIndex.passages[0].id], legacy), { code: "MISSING_PASSAGE_INDEX" });
});
test("hash, index table, snapshot identity and normalization mismatches reject", () => {
  const { s } = fixtures();
  for (const bad of [
    { ...s, text: "changed" },
    { ...s, hash: "0".repeat(64) },
  ])
    assert.throws(() => indexedSource(bad), { code: "SNAPSHOT_HASH_MISMATCH" });
  for (const mutate of [
    (s) => (s.passageIndex.hash = "0".repeat(64)),
    (s) => (s.passageIndex.snapshotId = "wrong"),
    (s) => s.passageIndex.passages[0].span.end--,
    (s) => (s.passageIndex.passages[0].id = "wrong"),
  ]) {
    const bad = structuredClone(s);
    mutate(bad);
    assert.throws(() => indexedSource(bad), { code: "INVALID_PASSAGE_INDEX" });
  }
  assert.throws(() => indexedSource({ ...s, normalization: "changed" }), { code: "INVALID_PASSAGE_INDEX" });
});
test("stored index reopens without calling the current sentence segmenter", (t) => {
  const { s } = fixtures();
  t.mock.method(Intl, "Segmenter", function () {
    throw Error("Must not re-segment");
  });
  const stored = JSON.parse(JSON.stringify(s));
  assert.deepEqual(indexedSource(stored), stored);
  assert.equal(
    resolvePassages([stored.passageIndex.passages[0].id], stored)[0].quote,
    s.passageIndex.passages[0].span.quote,
  );
});
test("strict inference schemas exclude model quotations, offsets and source hashes", () => {
  const { c, review } = fixtures();
  assert.equal(
    ExtractionSelectionSchema.safeParse({
      version: "passage-selection-v1",
      papers: [{ paperId: c.paperId, claims: [{ ...c, spans: [] }], limitations: [] }],
    }).success,
    false,
  );
  assert.equal(
    ReviewSelectionSchema.safeParse({
      version: "passage-selection-v1",
      reviews: [{ ...review, revisedFinding: "invented" }],
    }).success,
    false,
  );
  const extraction = JSON.stringify(roleWireSchema("extraction", "passage-selection-v1"));
  assert.ok(extraction.includes("passageIds"));
  for (const field of ['"quote"', '"start"', '"snapshotHash"']) assert.ok(!extraction.includes(field));
});
test("review hydration is tied to the candidate source; correction comes from one selected passage", () => {
  const { s, claim, review } = fixtures();
  const correction = { ...review, verdict: "overstated", revisionPassageId: review.passageIds[0] };
  const r = hydrateReviews({ version: "passage-selection-v1", reviews: [correction] }, [claim], [s]).reviews[0];
  assert.equal(r.revisedFinding, s.passageIndex.passages[0].span.quote);
  assert.equal(decide(claim, r, [s]).status, "revised");
  for (const bad of [
    { ...review, passageIds: ["unknown"] },
    { ...review, claimId: "unknown" },
    { ...review, revisionPassageId: review.passageIds[0] },
    { ...correction, revisionPassageId: s.passageIndex.passages[1].id },
  ])
    assert.throws(() => hydrateReviews({ version: "passage-selection-v1", reviews: [bad] }, [claim], [s]));
  assert.throws(
    () =>
      hydrateReviews(
        { version: "passage-selection-v1", reviews: [review] },
        [{ ...claim, snapshotHash: "0".repeat(64) }],
        [s],
      ),
    { code: "INVALID_SOURCE_REFERENCE" },
  );
});
test("valid references do not publish unsupported science, class upgrades or dropped negation", () => {
  const { s, claim, review } = fixtures();
  for (const changed of [
    { ...review, verdict: "unsupported" },
    { ...review, evidenceType: "direct_experimental" },
  ]) {
    const r = hydrateReviews({ version: "passage-selection-v1", reviews: [changed] }, [claim], [s]).reviews[0];
    assert.equal(decide(claim, r, [s]).status, "rejected");
  }
  const r = hydrateReviews({ version: "passage-selection-v1", reviews: [review] }, [claim], [s]).reviews[0];
  assert.equal(decide({ ...claim, finding: "Aspirin improved survival in mice." }, r, [s]).status, "rejected");
  assert.equal(decide(claim, { ...r, checks: { ...r.checks, studyContext: false } }, [s]).status, "unresolved");
});
test("legacy explicit spans and rejected candidates reload without index backfill or mutation", () => {
  const { s, claim } = fixtures();
  const legacySource = { ...s };
  delete legacySource.passageIndex;
  const legacyClaim = { ...claim };
  delete legacyClaim.passageSelection;
  const run = new OtariGatewayService({ get: () => undefined }).createRun("legacy");
  run.snapshots = [legacySource];
  run.decisions = [decide({ ...legacyClaim, spans: [{ ...legacyClaim.spans[0], end: 2 }] }, undefined, [legacySource])];
  const before = JSON.stringify(run);
  const loaded = parseStoredResearchRun(JSON.parse(before));
  assert.equal(loaded.decisions[0].status, "rejected");
  assert.equal(loaded.snapshots[0].passageIndex, undefined);
  assert.equal(JSON.stringify(run), before);
  assert.ok(ResearchRunSchema.safeParse(loaded).success);
});
test("new production role calls persist indexes before inference and hydrate both roles", async () => {
  const { s, c, review } = fixtures();
  const run = new OtariGatewayService({ get: () => undefined }).createRun("selections");
  const bare = { ...s };
  delete bare.passageIndex;
  run.snapshots = [bare];
  let saved,
    calls = 0;
  const gateway = {
    complete: async (role, prompt, input, r) => {
      assert.ok(saved.snapshots[0].passageIndex);
      assert.equal(saved.inferenceContract, "passage-selection-v1");
      assert.ok(input.passageIndex[0].index.hash);
      calls++;
      r.models[role] = role + "-fixture";
      r.models.distinct = !!r.models.review;
      return role === "extraction"
        ? { version: "passage-selection-v1", papers: [{ paperId: "123", claims: [c], limitations: [] }] }
        : { version: "passage-selection-v1", reviews: [review] };
    },
    integer: () => 10000,
    request: async () => ({
      data: {
        return_code: 0,
        stderr: "",
        stdout: JSON.stringify(
          localAudit(
            [
              hydrateExtraction(
                { version: "passage-selection-v1", papers: [{ paperId: "123", claims: [c], limitations: [] }] },
                [s],
              ).papers[0].claims[0],
            ],
            [s],
          ),
        ),
      },
      event: {},
    }),
  };
  const result = await new OtariEvidenceService(gateway, new EvidenceClassifierService()).extract(
    [{ id: "123", publicationTypes: [], studyType: "journal_article" }],
    {},
    run,
    async () => {
      saved = structuredClone(run);
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.claims.length, 1);
  assert.ok(run.decisions[0].review.passageSelection);
  assert.ok(referenceValid(run.decisions[0].candidate, run.snapshots));
});

test("persisted selected-span metadata must still match its frozen index on resume", () => {
  const { s, claim, review } = fixtures();
  assert.equal(
    referenceValid({ ...claim, passageSelection: { ...claim.passageSelection, indexHash: "0".repeat(64) } }, [s]),
    false,
  );
  assert.equal(
    referenceValid({ ...claim, passageSelection: { ...claim.passageSelection, passageIds: ["stale"] } }, [s]),
    false,
  );
  const r = hydrateReviews({ version: "passage-selection-v1", reviews: [review] }, [claim], [s]).reviews[0];
  assert.equal(
    decide(claim, { ...r, passageSelection: { ...r.passageSelection, indexHash: "0".repeat(64) } }, [s]).status,
    "rejected",
  );
});
