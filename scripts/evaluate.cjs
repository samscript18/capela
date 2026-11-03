const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const dataset = JSON.parse(fs.readFileSync("evaluation/pilot.json", "utf8"));
const hash = crypto.createHash("sha256").update(fs.readFileSync("evaluation/pilot.json")).digest("hex");
let resolvable = 0,
  exact = 0;
const rows = dataset.cases.map((c) => {
  const s = dataset.sources.find((s) => s.id === c.sourceId);
  if (s) resolvable++;
  const start = s?.text.indexOf(c.quote) ?? -1;
  const valid = start >= 0 && s.text.slice(start, start + c.quote.length) === c.quote;
  if (valid) exact++;
  return {
    id: c.id,
    split: c.split,
    reference: !!s,
    exactSpan: valid,
    start: valid ? start : null,
    end: valid ? start + c.quote.length : null,
    convention: "utf16-zero-based-end-exclusive",
    humanReview: c.annotation.humanReview,
  };
});
const report = {
  version: "pilot-mechanical-v1",
  date: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  datasetHash: hash,
  sourceCount: dataset.sources.length,
  cases: dataset.cases.length,
  heldOut: rows.filter((r) => r.split === "held-out").length,
  metrics: {
    resolvableReferences: { numerator: resolvable, denominator: rows.length },
    exactPassages: { numerator: exact, denominator: rows.length },
    reviewedSupportPrecision: null,
    unsupportedAcceptance: null,
    classConfusionMatrix: null,
    correctionOutcomes: null,
    abstentionCoverage: null,
    modelRunCompletion: null,
    latencyMs: null,
    reportedCostUsd: null,
  },
  comparison: {
    baseline: "blocked: no funded live evaluation",
    twoRole: "blocked: no funded live evaluation",
    protocol: "Both modes must consume identical snapshot hashes; comparison has not executed",
  },
  humanReview: "pending; provisional AI-drafted labels are not gold labels",
  scientificQualityClaim: "withheld",
  rows,
};
fs.writeFileSync("evaluation/results.json", JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      sources: report.sourceCount,
      cases: report.cases,
      heldOut: report.heldOut,
      metrics: report.metrics,
      humanReview: report.humanReview,
    },
    null,
    2,
  ),
);
if (resolvable !== rows.length || exact !== rows.length) process.exitCode = 1;
