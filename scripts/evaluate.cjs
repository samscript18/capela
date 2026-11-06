const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const dataset = JSON.parse(fs.readFileSync("evaluation/pilot.json", "utf8"));
const hash = crypto.createHash("sha256").update(fs.readFileSync("evaluation/pilot.json")).digest("hex");
const { EXTRACTION_PROMPT, REVIEW_PROMPT } = require("../apps/api/dist/research/otari-evidence.service");
const { snapshot, sourcePassages } = require("../apps/api/dist/research/provenance");
const sourceChecks = dataset.sources.map((s) => {
  const normalized = snapshot(s.pmid, s.canonicalUrl, s.text);
  return {
    id: s.id,
    storedHashValid: crypto.createHash("sha256").update(s.text).digest("hex") === s.hash,
    pipelineHash: normalized.hash,
    unchangedByNormalization: normalized.text === s.text,
    passageIndexValid: sourcePassages(normalized).every(
      (span) => normalized.text.slice(span.start, span.end) === span.quote,
    ),
  };
});
let resolvable = 0,
  exact = 0;
const rows = dataset.cases.map((c) => {
  const s = dataset.sources.find((s) => s.id === c.sourceId);
  if (s) resolvable++;
  const text = s ? snapshot(s.pmid, s.canonicalUrl, s.text).text : "";
  const start = s ? text.indexOf(c.quote) : -1;
  const valid = start >= 0 && text.slice(start, start + c.quote.length) === c.quote;
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
  version: "pilot-mechanical-v2",
  pipeline: {
    extractionPromptHash: crypto.createHash("sha256").update(EXTRACTION_PROMPT).digest("hex"),
    reviewPromptHash: crypto.createHash("sha256").update(REVIEW_PROMPT).digest("hex"),
    offsets: "utf16-zero-based-end-exclusive",
    sourceChecks,
  },
  date: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  datasetHash: hash,
  sourceCount: dataset.sources.length,
  cases: dataset.cases.length,
  heldOut: rows.filter((r) => r.split === "held-out").length,
  metrics: {
    sourceHashes: { numerator: sourceChecks.filter((s) => s.storedHashValid).length, denominator: sourceChecks.length },
    humanReviewedCases: {
      numerator: rows.filter((r) => r.humanReview === "reviewed").length,
      denominator: rows.length,
    },
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
if (!process.argv.includes("--stdout-only"))
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
if (
  resolvable !== rows.length ||
  exact !== rows.length ||
  sourceChecks.some((s) => !s.storedHashValid || !s.passageIndexValid)
)
  process.exitCode = 1;
