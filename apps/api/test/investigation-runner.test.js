const assert = require("node:assert/strict");
const { test } = require("node:test");
const { InvestigationRunnerService } = require("../dist/research/investigation-runner.service.js");
const { PubChemResolutionError } = require("../dist/research/pubchem.service.js");

test("the runner resolves a real molecule stage and persists later stages once", async () => {
  const statuses = [];
  const storedMolecules = [];
  const storedPapers = [];
  const storedAnalysis = [];
  const storedDossiers = [];
  const transitionFilters = [];
  let completionUpdate;
  const investigationModel = {
    findById: () => ({
      lean: () => ({ exec: async () => ({ _id: "investigation-1", status: "queued", originalInput: "Loliolide" }) }),
    }),
    updateOne: (filter, update) => ({
      exec: async () => {
        if (update.$set?.status) {
          statuses.push(update.$set.status);
          transitionFilters.push(filter);
        }
        if (update.$set?.molecule) storedMolecules.push(update.$set.molecule);
        if (update.$set?.papers) storedPapers.push(update.$set.papers);
        if (update.$set?.analysis) storedAnalysis.push(update.$set.analysis);
        if (update.$set?.dossier) storedDossiers.push(update.$set.dossier);
        return { matchedCount: 1 };
      },
    }),
    findOneAndUpdate: (_filter, update) => {
      completionUpdate = update;
      return { lean: () => ({ exec: async () => ({ userId: "user-1", access: { type: "free" } }) }) };
    },
  };
  const molecule = {
    pubchemCid: 100332,
    preferredName: "Loliolide",
    synonyms: [],
    structure2dUrl: "https://example.test/100332.png",
    pubchemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/100332",
  };
  const papers = [{ id: "123", source: "MED", title: "Loliolide study", abstract: "Measured evidence." }];
  const evidence = [{ paperId: "123", activities: [] }];
  const analysis = { activities: [], targets: [], sourceContexts: [], conflicts: [], limitations: [] };
  const mechanism = {
    status: "insufficient_evidence",
    summary: "Insufficient.",
    edges: [],
    evidenceIds: [],
    paperIds: [],
  };
  const assessment = { overallStrength: "Insufficient" };
  const dossier = { generatedAt: "2026-01-01T00:00:00.000Z" };
  const runner = new InvestigationRunnerService(
    investigationModel,
    { resolve: async () => molecule },
    { search: async () => ({ queries: [], discoveredCount: 7, papers }) },
    {
      extract: async (_papers, _molecule, onProgress) => {
        await onProgress(evidence);
        return evidence;
      },
    },
    {
      classify: () => ({
        claims: [],
        analysis,
        counts: { experimentalFindings: 0, computationalFindings: 0, targetsEvaluated: 0 },
      }),
    },
    { build: () => mechanism },
    { assess: () => assessment },
    { build: () => dossier },
  );
  runner.wait = async () => undefined;
  await Promise.all([runner.run("investigation-1"), runner.run("investigation-1")]);
  assert.deepEqual(statuses, [
    "resolving_molecule",
    "searching_literature",
    "ranking_studies",
    "extracting_evidence",
    "classifying_evidence",
    "analyzing_findings",
    "building_assessment",
    "generating_dossier",
  ]);
  assert.equal(transitionFilters[0].status, "queued");
  assert.deepEqual(storedMolecules, [molecule]);
  assert.deepEqual(storedPapers, [papers]);
  assert.deepEqual(storedAnalysis, [analysis]);
  assert.deepEqual(storedDossiers, [dossier]);
  assert.equal(completionUpdate.$unset.activeFreeSlot, 1);
});

test("a failed free investigation releases its active slot", async () => {
  let failureUpdate;
  const investigationModel = {
    findById: () => ({
      lean: () => ({ exec: async () => ({ _id: "investigation-1", status: "queued", originalInput: "Unknownium" }) }),
    }),
    updateOne: (_filter, update) => ({
      exec: async () => {
        if (update.$set?.status === "failed") failureUpdate = update;
        return { matchedCount: 1 };
      },
    }),
  };
  const runner = new InvestigationRunnerService(
    investigationModel,
    {
      resolve: async () => {
        throw new PubChemResolutionError("MOLECULE_NOT_FOUND", "Molecule not found");
      },
    },
    {},
    {},
    {},
    {},
    {},
    {},
  );
  runner.wait = async () => undefined;
  await runner.run("investigation-1");
  assert.equal(failureUpdate.$set.error.code, "MOLECULE_NOT_FOUND");
  assert.equal(failureUpdate.$unset.activeFreeSlot, 1);
});

test("two runner instances cannot both claim the same queued investigation", async () => {
  let persistedStatus = "queued";
  let resolutionCalls = 0;
  const investigationModel = {
    findById: () => ({
      lean: () => ({ exec: async () => ({ _id: "investigation-1", status: "queued", originalInput: "Loliolide" }) }),
    }),
    updateOne: (filter, update) => ({
      exec: async () => {
        if (filter.status === "queued") {
          if (persistedStatus !== "queued") return { matchedCount: 0 };
          persistedStatus = "resolving_molecule";
          return { matchedCount: 1 };
        }
        if (update.$set?.status) persistedStatus = update.$set.status;
        return { matchedCount: 1 };
      },
    }),
    findOneAndUpdate: () => ({ lean: () => ({ exec: async () => ({ userId: "user-1", access: { type: "paid" } }) }) }),
  };
  const molecule = {
    pubchemCid: 100332,
    preferredName: "Loliolide",
    synonyms: [],
    structure2dUrl: "https://example.test/100332.png",
    pubchemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/100332",
  };
  const papers = [{ id: "123", source: "MED", title: "Loliolide study" }];
  const analysis = { activities: [], targets: [], sourceContexts: [], conflicts: [], limitations: [] };
  const dependencies = [
    investigationModel,
    {
      resolve: async () => {
        resolutionCalls += 1;
        return molecule;
      },
    },
    { search: async () => ({ discoveredCount: 1, papers }) },
    { extract: async () => [] },
    {
      classify: () => ({
        claims: [],
        analysis,
        counts: { experimentalFindings: 0, computationalFindings: 0, targetsEvaluated: 0 },
      }),
    },
    {
      build: () => ({
        status: "insufficient_evidence",
        summary: "Insufficient",
        edges: [],
        evidenceIds: [],
        paperIds: [],
      }),
    },
    { assess: () => ({ overallStrength: "Insufficient" }) },
    { build: () => ({ generatedAt: "2026-01-01T00:00:00.000Z" }) },
  ];
  const first = new InvestigationRunnerService(...dependencies);
  const second = new InvestigationRunnerService(...dependencies);
  first.wait = second.wait = async () => undefined;
  await Promise.all([first.run("investigation-1"), second.run("investigation-1")]);
  assert.equal(resolutionCalls, 1);
});
