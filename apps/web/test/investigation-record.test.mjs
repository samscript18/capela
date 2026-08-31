import assert from "node:assert/strict";
import test from "node:test";
import { normalizeApiInvestigation } from "../src/lib/investigation-record.ts";

const baseRecord = {
  _id: "investigation-1",
  originalInput: "Loliolide",
  status: "queued",
  progress: {
    message: "Investigation queued",
    papersDiscovered: 0,
    papersSelected: 0,
    papersAnalyzed: 0,
    experimentalFindings: 0,
    computationalFindings: 0,
    targetsEvaluated: 0,
  },
  access: { type: "free" },
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
};

test("normalizes omitted investigation collections to empty arrays", () => {
  const normalized = normalizeApiInvestigation(baseRecord);

  assert.deepEqual(normalized.papers, []);
  assert.deepEqual(normalized.paperEvidence, []);
  assert.deepEqual(normalized.evidence, []);
  assert.equal(normalized.evidence.length, 0);
});

test("preserves populated investigation collections", () => {
  const evidence = [{ id: "evidence-1" }];
  const normalized = normalizeApiInvestigation({
    ...baseRecord,
    papers: [{ id: "paper-1" }],
    paperEvidence: [{ paperId: "paper-1" }],
    evidence,
  });

  assert.equal(normalized.papers.length, 1);
  assert.equal(normalized.paperEvidence.length, 1);
  assert.equal(normalized.evidence, evidence);
});
