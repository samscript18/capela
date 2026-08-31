const assert = require("node:assert/strict");
const { test } = require("node:test");
const { MechanismService, MechanismValidationError } = require("../dist/research/mechanism.service.js");

const service = new MechanismService();
const molecule = { pubchemCid: 1, preferredName: "Loliolide", synonyms: [], structure2dUrl: "", pubchemUrl: "" };
const analysis = { activities: [], targets: [], sourceContexts: [], conflicts: [], limitations: [] };
function paper(id) {
  return {
    id,
    source: "MED",
    title: `Paper ${id}`,
    authors: [],
    publicationTypes: [],
    studyType: "journal_article",
    fullTextAvailable: false,
    openAccess: false,
    externalUrl: "",
    relevanceScore: 1,
    relevanceReasons: [],
    matchedQueries: [],
  };
}
function mechanismClaim(id, paperId, overrides = {}) {
  return {
    id,
    paperId,
    kind: "mechanism",
    finding: "A measured mechanism was reported.",
    evidenceType: "direct_experimental",
    confidence: "high",
    studyType: "experimental_in_vitro",
    analyzedSource: "abstract",
    molecularEvent: "enzyme inhibition",
    pathway: "Nrf2 signaling",
    cellularEffect: "reduced oxidative stress",
    biologicalOutcome: "cell protection",
    ...overrides,
  };
}

test("mechanism synthesis returns the required insufficient state without structured links", () => {
  const result = service.build(molecule, [], [], analysis);
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(
    result.summary,
    "The retrieved literature does not establish a sufficiently supported molecular mechanism.",
  );
  assert.deepEqual(result.edges, []);
});

test("a complete experimental mechanism produces only evidence-backed edges", () => {
  const claim = mechanismClaim("ev_1", "1");
  const result = service.build(molecule, [claim], [paper("1")], analysis);
  assert.equal(result.status, "supported");
  assert.equal(result.edges.length, 4);
  assert.deepEqual(result.evidenceIds, ["ev_1"]);
  assert.deepEqual(result.paperIds, ["1"]);
  assert.ok(result.edges.every((edge) => edge.evidenceIds[0] === "ev_1" && edge.paperIds[0] === "1"));
});

test("computational or incomplete chains remain partially supported", () => {
  const claim = mechanismClaim("ev_1", "1", {
    evidenceType: "computational_prediction",
    cellularEffect: undefined,
    biologicalOutcome: "predicted outcome",
  });
  const result = service.build(molecule, [claim], [paper("1")], analysis);
  assert.equal(result.status, "partially_supported");
  assert.ok(result.edges.every((edge) => edge.evidenceType === "computational_prediction"));
});

test("target conflicts affecting mechanism papers produce conflicting evidence", () => {
  const claim = mechanismClaim("ev_1", "1");
  const conflicted = {
    ...analysis,
    conflicts: [
      {
        scope: "target",
        label: "Nrf2",
        description: "Opposing relationships.",
        evidenceIds: ["target_1"],
        paperIds: ["1"],
      },
    ],
  };
  assert.equal(service.build(molecule, [claim], [paper("1")], conflicted).status, "conflicting_evidence");
});

test("mechanism references fail closed when their paper does not exist", () => {
  const claim = mechanismClaim("ev_1", "unknown");
  assert.throws(
    () => service.build(molecule, [claim], [paper("1")], analysis),
    (error) => error instanceof MechanismValidationError && error.code === "INVALID_MECHANISM_ATTRIBUTION",
  );
});
