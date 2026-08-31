const assert = require("node:assert/strict");
const { test } = require("node:test");
const { DossierService } = require("../dist/research/dossier.service.js");
const { EvidenceClassifierService } = require("../dist/research/evidence-classifier.service.js");
const { MechanismService } = require("../dist/research/mechanism.service.js");
const { ResearchAssessmentService } = require("../dist/research/research-assessment.service.js");

const molecule = {
  pubchemCid: 100332,
  preferredName: "Loliolide",
  synonyms: ["Loliolide"],
  molecularFormula: "C11H16O3",
  molecularWeight: "196.24",
  structure2dUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/100332/PNG",
  pubchemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/100332",
};

function paper(id, title, studyType) {
  return {
    id,
    source: "TEST_FIXTURE",
    title,
    authors: ["Fixture author"],
    abstract: "A bounded abstract fixture used to exercise the scientific validation pipeline.",
    publicationTypes: ["Journal Article"],
    studyType,
    fullTextAvailable: false,
    openAccess: false,
    externalUrl: `https://example.test/publication/${id}`,
    relevanceScore: 10,
    relevanceReasons: ["Exact molecule-name match"],
    matchedQueries: ["Loliolide"],
  };
}

function extraction(paperId, studyType, content) {
  return {
    paperId,
    analyzedSource: "abstract",
    relevance: "high",
    studyType,
    sourceContexts: [],
    activities: [],
    targets: [],
    mechanisms: [],
    limitations: ["Abstract-only fixture; conclusions must remain bounded to the supplied text."],
    ...content,
  };
}

test("the composed judge dossier keeps activity evidence, computational targets, sources, mechanism restraint, and assessment traceable", () => {
  const papers = [
    paper("fixture-exp", "Fixture experimental record", "journal_article"),
    paper("fixture-computational", "Fixture computational record", "journal_article"),
  ];
  const extractions = [
    extraction("fixture-exp", "experimental_in_vitro", {
      sourceContexts: [
        { source: "Fixture plant material", context: "The supplied record reports isolation from plant material." },
      ],
      activities: [
        {
          activity: "antioxidant",
          finding: "The supplied record reports a directly measured antioxidant effect in a cell-free assay.",
          model: "cell-free assay",
          measuredOutcome: "A concentration-dependent assay response was reported in the supplied abstract.",
          evidenceType: "direct_experimental",
          confidence: "high",
        },
      ],
    }),
    extraction("fixture-computational", "computational", {
      targets: [
        {
          target: "Keap1",
          relationship: "direct_binding",
          finding: "Molecular docking predicted an interaction with Keap1.",
          directExperimentalConfirmation: true,
          evidenceType: "direct_experimental",
          confidence: "medium",
        },
      ],
      mechanisms: [
        {
          finding: "Molecular docking was used to propose a Keap1-related pathway link.",
          pathway: "Keap1-related signaling",
          molecularEvent: "Predicted docking interaction",
          cellularEffect: null,
          biologicalOutcome: null,
          evidenceType: "direct_experimental",
          confidence: "low",
        },
      ],
    }),
  ];

  const classified = new EvidenceClassifierService().classify(extractions, papers);
  const mechanism = new MechanismService().build(molecule, classified.claims, papers, classified.analysis);
  const assessment = new ResearchAssessmentService().assess(
    classified.claims,
    classified.analysis,
    mechanism,
    extractions,
  );
  const dossier = new DossierService().build(
    molecule,
    papers,
    classified.claims,
    classified.analysis,
    mechanism,
    assessment,
  );

  assert.equal(dossier.biologicalActivity.items[0].name, "antioxidant");
  assert.equal(dossier.biologicalActivity.items[0].experimentalCount, 1);
  const activityClaim = classified.claims.find((claim) => claim.kind === "activity");
  assert.match(activityClaim.measuredOutcome, /concentration-dependent/i);

  const target = dossier.molecularTargets.items[0];
  assert.equal(target.target, "Keap1");
  assert.equal(target.relationship, "predicted_binding");
  assert.equal(target.directExperimentalConfirmation, false);
  assert.deepEqual(target.evidenceTypes, ["computational_prediction"]);

  assert.equal(dossier.mechanism.status, "partially_supported");
  assert.ok(dossier.mechanism.edges.length > 0);
  assert.ok(dossier.mechanism.edges.every((edge) => edge.evidenceType === "computational_prediction"));
  assert.match(dossier.mechanism.summary, /non-experimental/i);

  assert.equal(dossier.sources.items[0].paperIds[0], "fixture-exp");
  assert.equal(dossier.literature.items[0].externalUrl, "https://example.test/publication/fixture-exp");
  assert.ok(dossier.literature.items.every((item) => item.evidenceIds.length > 0));
  assert.equal(dossier.evidenceVsPrediction.distribution.direct_experimental, 1);
  assert.equal(dossier.evidenceVsPrediction.distribution.computational_prediction, 2);
  assert.equal(dossier.researchAssessment.basis.directlyConfirmedTargets, 0);
  assert.match(
    dossier.researchAssessment.majorEvidenceGaps.join(" "),
    /No molecular target has direct experimental confirmation/i,
  );
  assert.match(dossier.researchAssessment.majorEvidenceGaps.join(" "), /unsupported or non-experimental links/i);
});
