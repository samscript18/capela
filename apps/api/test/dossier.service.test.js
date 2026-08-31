const assert = require("node:assert/strict");
const { test } = require("node:test");
const { DossierService, DossierValidationError } = require("../dist/research/dossier.service.js");

const service = new DossierService();
const molecule = { pubchemCid: 100332, preferredName: "Loliolide", synonyms: [], structure2dUrl: "", pubchemUrl: "" };
const paper = {
  id: "1",
  source: "MED",
  title: "Loliolide study",
  authors: [],
  abstract: "Abstract text.",
  publicationTypes: ["Journal Article"],
  studyType: "journal_article",
  fullTextAvailable: false,
  openAccess: false,
  externalUrl: "",
  relevanceScore: 1,
  relevanceReasons: [],
  matchedQueries: [],
};
const claim = {
  id: "ev_1",
  paperId: "1",
  kind: "activity",
  activity: "antioxidant",
  originalActivity: "Antioxidant",
  finding: "An antioxidant effect was measured.",
  evidenceType: "direct_experimental",
  confidence: "high",
  studyType: "experimental_in_vitro",
  analyzedSource: "abstract",
};
const activity = {
  name: "antioxidant",
  originalNames: ["Antioxidant"],
  summary: "One finding.",
  strength: "Moderate",
  supportingEvidenceIds: ["ev_1"],
  supportingPaperIds: ["1"],
  studyModels: [],
  experimentalCount: 1,
  computationalCount: 0,
  conflicts: [],
};
const analysis = { activities: [activity], targets: [], sourceContexts: [], conflicts: [], limitations: [] };
const mechanism = {
  status: "insufficient_evidence",
  summary: "The retrieved literature does not establish a sufficiently supported molecular mechanism.",
  edges: [],
  evidenceIds: [],
  paperIds: [],
};
const assessment = {
  overallStrength: "Limited",
  score: 20,
  biologicalActivityEvidence: "Moderate",
  targetEvidence: "Insufficient",
  mechanisticEvidence: "Insufficient",
  consistency: "consistent",
  strongestEvidence: ["One paper contains direct experimental evidence."],
  majorEvidenceGaps: [],
  conflicts: [],
  explanation: "Limited evidence.",
  basis: {
    papersAnalyzed: 1,
    abstractOnlyPapers: 1,
    directExperimentalPapers: 1,
    indirectExperimentalPapers: 0,
    computationalPapers: 0,
    literatureReportedPapers: 0,
    directlyConfirmedTargets: 0,
    mechanismStatus: "insufficient_evidence",
  },
};

test("dossier generation creates exactly eight traced sections and a real evidence distribution", () => {
  const dossier = service.build(molecule, [paper], [claim], analysis, mechanism, assessment);
  assert.deepEqual(
    Object.keys(dossier).filter((key) => key !== "generatedAt"),
    [
      "overview",
      "sources",
      "biologicalActivity",
      "molecularTargets",
      "mechanism",
      "literature",
      "evidenceVsPrediction",
      "researchAssessment",
    ],
  );
  assert.equal(dossier.biologicalActivity.items[0].supportingEvidenceIds[0], "ev_1");
  assert.equal(dossier.literature.items[0].analyzedSource, "abstract");
  assert.deepEqual(dossier.literature.items[0].evidenceIds, ["ev_1"]);
  assert.equal(dossier.evidenceVsPrediction.distribution.direct_experimental, 1);
  assert.equal(dossier.evidenceVsPrediction.distribution.computational_prediction, 0);
});

test("dossier validation rejects invented evidence and paper references", () => {
  const dossier = service.build(molecule, [paper], [claim], analysis, mechanism, assessment);
  dossier.biologicalActivity.items[0].supportingEvidenceIds = ["invented"];
  assert.throws(
    () => service.validate(dossier, [paper], [claim]),
    (error) => error instanceof DossierValidationError && error.code === "INVALID_DOSSIER_REFERENCE",
  );
  dossier.biologicalActivity.items[0].supportingEvidenceIds = ["ev_1"];
  dossier.biologicalActivity.items[0].supportingPaperIds = ["invented-paper"];
  assert.throws(() => service.validate(dossier, [paper], [claim]), DossierValidationError);
});
