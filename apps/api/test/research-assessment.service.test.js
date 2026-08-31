const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ResearchAssessmentService } = require("../dist/research/research-assessment.service.js");

const service = new ResearchAssessmentService();
const emptyAnalysis = { activities: [], targets: [], sourceContexts: [], conflicts: [], limitations: [] };
const insufficientMechanism = {
  status: "insufficient_evidence",
  summary: "Insufficient.",
  edges: [],
  evidenceIds: [],
  paperIds: [],
};
function evidence(id, paperId, evidenceType = "direct_experimental", kind = "activity") {
  return {
    id,
    paperId,
    kind,
    finding: "Measured finding.",
    evidenceType,
    confidence: "high",
    studyType: "experimental_in_vitro",
    analyzedSource: "abstract",
  };
}
function extracted(paperId) {
  return {
    paperId,
    analyzedSource: "abstract",
    relevance: "high",
    studyType: "experimental_in_vitro",
    sourceContexts: [],
    activities: [],
    targets: [],
    mechanisms: [],
    limitations: [],
  };
}

test("an empty evidence set is assessed as insufficient with explicit gaps", () => {
  const result = service.assess([], emptyAnalysis, insufficientMechanism, []);
  assert.equal(result.overallStrength, "Insufficient");
  assert.equal(result.consistency, "insufficient");
  assert.match(result.majorEvidenceGaps.join(" "), /No direct experimental evidence/);
  assert.match(result.majorEvidenceGaps.join(" "), /sufficiently supported molecular mechanism/);
});

test("computational-only evidence stays limited and exposes its dependence", () => {
  const claims = [evidence("ev_1", "1", "computational_prediction")];
  const result = service.assess(
    claims,
    { ...emptyAnalysis, activities: [{ name: "activity", strength: "Limited" }] },
    insufficientMechanism,
    [extracted("1")],
  );
  assert.equal(result.overallStrength, "Limited");
  assert.equal(result.biologicalActivityEvidence, "Limited");
  assert.equal(result.basis.computationalPapers, 1);
  assert.match(result.majorEvidenceGaps.join(" "), /entirely on computational evidence/);
});

test("multiple direct papers, a confirmed target, and supported mechanism can reach Strong deterministically", () => {
  const claims = [evidence("ev_1", "1"), evidence("ev_2", "2"), evidence("ev_3", "3")];
  const mechanism = {
    status: "supported",
    summary: "Supported.",
    edges: [],
    evidenceIds: ["ev_1", "ev_2"],
    paperIds: ["1", "2"],
  };
  const analysis = {
    ...emptyAnalysis,
    activities: [{ name: "activity", strength: "Strong" }],
    targets: [{ target: "Target", strength: "Strong", directExperimentalConfirmation: true }],
  };
  const result = service.assess(claims, analysis, mechanism, [extracted("1"), extracted("2"), extracted("3")]);
  assert.equal(result.score, 70);
  assert.equal(result.overallStrength, "Strong");
  assert.equal(result.mechanisticEvidence, "Strong");
  assert.equal(result.basis.directExperimentalPapers, 3);
});

test("conflicts reduce the deterministic score and remain visible", () => {
  const claims = [evidence("ev_1", "1"), evidence("ev_2", "2")];
  const conflict = {
    scope: "activity",
    label: "activity",
    description: "Conflicting results.",
    evidenceIds: ["ev_1", "ev_2"],
    paperIds: ["1", "2"],
  };
  const result = service.assess(claims, { ...emptyAnalysis, conflicts: [conflict] }, insufficientMechanism, [
    extracted("1"),
    extracted("2"),
  ]);
  assert.equal(result.consistency, "mixed");
  assert.deepEqual(result.conflicts, [conflict]);
  assert.equal(result.score, 20);
});
