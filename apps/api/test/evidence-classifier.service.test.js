const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  EvidenceClassifierService,
  EvidenceValidationError,
} = require("../dist/research/evidence-classifier.service.js");

const classifier = new EvidenceClassifierService();
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
function extraction(paperId, overrides = {}) {
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
    ...overrides,
  };
}
function activity(activity, finding, evidenceType = "direct_experimental", model = "cell culture") {
  return { activity, finding, model, measuredOutcome: null, evidenceType, confidence: "high" };
}
function target(
  target,
  relationship,
  finding,
  evidenceType = "direct_experimental",
  directExperimentalConfirmation = true,
) {
  return { target, relationship, finding, directExperimentalConfirmation, evidenceType, confidence: "high" };
}

test("activity aggregation normalizes obvious variants while retaining original labels and attribution", () => {
  const result = classifier.classify(
    [
      extraction("1", { activities: [activity("anti inflammatory", "Inflammatory markers were reduced.")] }),
      extraction("2", { activities: [activity("Anti-inflammatory", "Anti-inflammatory activity was measured.")] }),
    ],
    [paper("1"), paper("2")],
  );
  assert.equal(result.analysis.activities.length, 1);
  assert.equal(result.analysis.activities[0].name, "anti-inflammatory");
  assert.deepEqual(result.analysis.activities[0].originalNames, ["anti inflammatory", "Anti-inflammatory"]);
  assert.deepEqual(result.analysis.activities[0].supportingPaperIds, ["1", "2"]);
  assert.equal(result.analysis.activities[0].strength, "Strong");
  assert.equal(new Set(result.analysis.activities[0].supportingEvidenceIds).size, 2);
});

test("the classifier independently forces docking to computational predicted binding", () => {
  const result = classifier.classify(
    [
      extraction("1", {
        studyType: "other",
        targets: [target("Keap1", "direct_binding", "Molecular docking predicted a favorable score.")],
      }),
    ],
    [paper("1")],
  );
  const claim = result.claims[0];
  assert.equal(claim.evidenceType, "computational_prediction");
  assert.equal(claim.relationship, "predicted_binding");
  assert.equal(claim.directExperimentalConfirmation, false);
  assert.equal(result.analysis.targets[0].relationship, "predicted_binding");
  assert.equal(result.analysis.targets[0].directExperimentalConfirmation, false);
  assert.equal(result.counts.computationalFindings, 1);
});

test("reviews are downgraded and expression changes are not direct binding", () => {
  const result = classifier.classify(
    [
      extraction("1", {
        studyType: "review",
        targets: [target("Nrf2", "direct_binding", "The review discussed direct binding.")],
      }),
      extraction("2", {
        targets: [target("Nrf2", "direct_binding", "Nrf2 expression was upregulated after treatment.")],
      }),
    ],
    [paper("1"), paper("2")],
  );
  assert.equal(result.claims[0].evidenceType, "literature_reported");
  assert.equal(result.claims[0].directExperimentalConfirmation, false);
  assert.equal(result.claims[1].relationship, "expression_increase");
  assert.equal(result.claims[1].evidenceType, "indirect_experimental");
  assert.equal(result.claims[1].directExperimentalConfirmation, false);
});

test("targets are normalized conservatively and opposing relationships become an explicit conflict", () => {
  const result = classifier.classify(
    [
      extraction("1", { targets: [target("ERK1", "activation", "ERK1 activation was measured.")] }),
      extraction("2", { targets: [target("erk1", "inhibition", "ERK1 inhibition was measured.")] }),
      extraction("3", { targets: [target("ERK2", "activation", "ERK2 activation was measured.")] }),
    ],
    [paper("1"), paper("2"), paper("3")],
  );
  assert.equal(result.analysis.targets.length, 2);
  const erk1 = result.analysis.targets.find((item) => item.normalizedTarget === "erk1");
  assert.equal(erk1.target, "ERK1");
  assert.equal(erk1.relationship, "unknown");
  assert.equal(erk1.conflicts.length, 1);
  assert.equal(result.analysis.conflicts[0].scope, "target");
});

test("activity null results and positive results remain visible as a conflict", () => {
  const result = classifier.classify(
    [
      extraction("1", { activities: [activity("antioxidant", "Antioxidant activity was measured.")] }),
      extraction("2", { activities: [activity("antioxidant", "No significant antioxidant effect was observed.")] }),
    ],
    [paper("1"), paper("2")],
  );
  assert.equal(result.analysis.activities[0].conflicts.length, 1);
  assert.equal(result.analysis.conflicts[0].scope, "activity");
  assert.deepEqual(result.analysis.conflicts[0].paperIds, ["1", "2"]);
});

test("existing computational labels and pathway changes cannot retain direct relationships", () => {
  const result = classifier.classify(
    [
      extraction("1", {
        targets: [
          target(
            "Target A",
            "direct_binding",
            "A predicted interaction was reported.",
            "computational_prediction",
            true,
          ),
        ],
      }),
      extraction("2", {
        targets: [
          target(
            "Target B",
            "activation",
            "Downstream signaling pathway activation was observed.",
            "direct_experimental",
            true,
          ),
        ],
      }),
    ],
    [paper("1"), paper("2")],
  );
  assert.equal(result.claims[0].relationship, "predicted_binding");
  assert.equal(result.claims[0].directExperimentalConfirmation, false);
  assert.equal(result.claims[1].relationship, "pathway_association");
  assert.equal(result.claims[1].evidenceType, "indirect_experimental");
  assert.equal(result.claims[1].directExperimentalConfirmation, false);
});

test("source contexts aggregate with paper attribution and unknown paper IDs fail closed", () => {
  const result = classifier.classify(
    [
      extraction("1", {
        sourceContexts: [{ source: "Marine algae", context: "Reported as an isolated constituent." }],
      }),
      extraction("2", { sourceContexts: [{ source: "marine algae", context: "Detected in an extract." }] }),
    ],
    [paper("1"), paper("2")],
  );
  assert.equal(result.analysis.sourceContexts.length, 1);
  assert.deepEqual(result.analysis.sourceContexts[0].paperIds, ["1", "2"]);
  assert.throws(
    () => classifier.classify([extraction("unknown")], [paper("1")]),
    (error) => error instanceof EvidenceValidationError && error.code === "INVALID_EVIDENCE_ATTRIBUTION",
  );
});
