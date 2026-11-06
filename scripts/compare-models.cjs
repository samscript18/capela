// Opt-in live pilot. Outputs are unreviewed measurements, never production dossier evidence.
require("reflect-metadata");
const fs = require("node:fs");
const path = require("node:path");
const { ConfigService } = require("@nestjs/config");
const {
  hydrateExtraction,
  indexedSource,
  INFERENCE_CONTRACT,
} = require("../apps/api/dist/research/passage-references");
const { OtariGatewayService } = require("../apps/api/dist/research/otari-gateway.service");
const {
  OtariEvidenceService,
  EXTRACTION_PROMPT,
  REVIEW_PROMPT,
  extractionInput,
} = require("../apps/api/dist/research/otari-evidence.service");
const { EvidenceClassifierService } = require("../apps/api/dist/research/evidence-classifier.service");
const { snapshot, exactIds, referenceValid } = require("../apps/api/dist/research/provenance");
async function main() {
  const cap = Number(process.env.OTARI_LIVE_TEST_BUDGET_MICROUSD ?? 0);
  if (!Number.isSafeInteger(cap) || cap <= 0 || !process.env.EVAL_SOURCE_ID || !process.env.EVAL_MOLECULE_NAME) {
    console.log(
      "Blocked: configure a finite live cap, EVAL_SOURCE_ID and human-checked EVAL_MOLECULE_NAME locally. No requests sent.",
    );
    process.exitCode = 2;
    return;
  }
  if (fs.existsSync(".local-evaluation/live-verification.json")) {
    console.log(
      "Blocked: an active verification ledger already accounts for this task's allowance. Do not create a separate spending pool.",
    );
    process.exitCode = 2;
    return;
  }
  const dataset = JSON.parse(fs.readFileSync("evaluation/pilot.json", "utf8"));
  const record = dataset.sources.find((s) => s.id === process.env.EVAL_SOURCE_ID);
  if (!record || !dataset.cases.some((c) => c.sourceId === record.id && c.split === "held-out"))
    throw new Error("Select a fixed held-out source.");
  const dir = ".local-evaluation";
  fs.mkdirSync(dir, { recursive: true });
  const lock = fs.openSync(path.join(dir, "comparison.lock"), "wx");
  try {
    const gateway = new OtariGatewayService(new ConfigService({ ...process.env, OTARI_REVIEW_FALLBACK: "disabled" }));
    gateway.assertConfigured();
    const run = gateway.createRun(require("node:crypto").randomUUID());
    run.budget.capMicrousd = Math.min(run.budget.capMicrousd, cap);
    const source = indexedSource(snapshot(record.pmid, record.canonicalUrl, record.text));
    run.inferenceContract = INFERENCE_CONTRACT;
    source.truncated = true;
    run.snapshots = [source];
    const paper = {
      id: record.pmid,
      source: "PUBMED",
      title: record.title,
      authors: [],
      publicationTypes: record.publicationTypes,
      studyType: record.publicationTypes.some((t) => /review/i.test(t)) ? "review" : "journal_article",
      abstract: source.text,
      fullTextAvailable: false,
      openAccess: false,
      externalUrl: source.canonicalUrl,
      relevanceScore: 0,
      relevanceReasons: ["Fixed held-out excerpt"],
      matchedQueries: [],
    };
    const molecule = { preferredName: process.env.EVAL_MOLECULE_NAME, synonyms: [] };
    const report = {
      version: "paired-pilot-v2",
      commit: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      datasetHash: require("node:crypto")
        .createHash("sha256")
        .update(fs.readFileSync("evaluation/pilot.json"))
        .digest("hex"),
      prompts: { extraction: EXTRACTION_PROMPT, review: REVIEW_PROMPT },
      qualifyingMode: "hosted-only; Vertex excluded",
      attemptedPairs: 1,
      completedPairs: 0,
      humanReview: "pending",
      scientificQualityClaim: "withheld",
      sourceId: record.id,
      snapshotHash: source.hash,
      scope: "bounded abstract excerpt; molecule name checked by caller",
      baseline: null,
      twoRole: null,
      run,
    };
    const output = path.join(dir, `${run.runId}.json`);
    const save = async () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    await save();
    try {
      const started = Date.now();
      const baseline = hydrateExtraction(
        await gateway.complete("extraction", EXTRACTION_PROMPT, extractionInput(paper, molecule, [source]), run, save, {
          maxOutputTokens: 2000,
          reasoningEffort: "low",
        }),
      );
      exactIds(
        [paper.id],
        baseline.papers.map((p) => p.paperId),
      );
      const claims = baseline.papers.flatMap((p) => {
        if (p.claims.some((c) => c.paperId !== p.paperId) || p.claims.length > 2)
          throw new Error("Baseline violates production paper grouping or claim bound.");
        return p.claims;
      });
      exactIds(
        claims.map((c) => c.id),
        [...new Set(claims.map((c) => c.id))],
      );
      report.baseline = {
        output: baseline,
        elapsedMs: Date.now() - started,
        spanValid: claims.filter((c) => referenceValid(c, [source])).length,
        candidates: claims.length,
        model: run.models.extraction,
      };
      await save();
      const next = Date.now();
      const result = await new OtariEvidenceService(gateway, new EvidenceClassifierService()).extract(
        [paper],
        molecule,
        run,
        save,
      );
      report.completedPairs = 1;
      report.twoRole = {
        published: result.claims,
        elapsedMs: Date.now() - next,
        decisions: run.decisions,
        models: run.models,
      };
      await save();
    } catch (error) {
      report.errorCode = typeof error.code === "string" ? error.code : "EVALUATION_FAILED";
      await save();
      process.exitCode = 1;
    }
    console.log(`Paired unreviewed outputs saved to ${output}. No precision claim; human scoring required.`);
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(path.join(dir, "comparison.lock"));
  }
}
main().catch(() => {
  console.error("Comparison blocked/failed; no credentials or upstream details logged.");
  process.exitCode = 1;
});
