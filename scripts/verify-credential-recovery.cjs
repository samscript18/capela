// One controlled credential-failure recovery check. No retrieval, publication, provider escape or replay.
require("reflect-metadata");
const fs = require("node:fs"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process");
const { ConfigService } = require("@nestjs/config");
const { z } = require("zod");
const { ReviewSelectionSchema } = require("@capela/shared");
const { OtariGatewayService } = require("../apps/api/dist/research/otari-gateway.service");
const {
  EXTRACTION_PROMPT,
  REVIEW_PROMPT,
  extractionInput,
} = require("../apps/api/dist/research/otari-evidence.service");
const { hydrateExtraction, hydrateReviews } = require("../apps/api/dist/research/passage-references");
const { referenceValid, exactIds, decide } = require("../apps/api/dist/research/provenance");
const {
  applyRecordedSourceAssessments,
  publicationDecisions,
} = require("../apps/api/dist/research/publication-policy");
const policies = { extraction: "capela-extraction-recovery-v1", review: "capela-review-isolated-v1" };
function canonicalRoleModel(role, event) {
  // Exact native/canonical spellings from the verified Otari offerings. Keep event.model unchanged.
  if (
    role === "extraction" &&
    event.provider === "ovhcloud" &&
    ["gpt-oss-20b", "openai/gpt-oss-20b"].includes(event.model)
  )
    return "openai/gpt-oss-20b";
  if (
    role === "review" &&
    ((event.provider === "deepinfra" && event.model === "openai/gpt-oss-120b") ||
      (event.provider === "ovhcloud" && ["gpt-oss-120b", "openai/gpt-oss-120b"].includes(event.model)))
  )
    return "openai/gpt-oss-120b";
  return undefined;
}
function verifySelection(output, snapshots, paperId) {
  const result = hydrateExtraction(output, snapshots);
  exactIds(
    [paperId],
    result.papers.map((p) => p.paperId),
    "Isolated extraction coverage",
  );
  const claims = result.papers.flatMap((p) => p.claims);
  if (
    claims.length > 2 ||
    new Set(claims.map((c) => c.id)).size !== claims.length ||
    claims.some((c) => c.paperId !== paperId || !referenceValid(c, snapshots))
  )
    throw Error("Invalid isolated extraction references");
  return claims;
}
async function main() {
  const key = process.env.OTARI_CEILING_TEST_API_KEY;
  const configPath = ".local-evaluation/credential-recovery-config.json";
  const cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath)) : {};
  if (
    cfg.isolated !== true ||
    cfg.ownerConfirmed !== true ||
    cfg.expectedPrimary !== "capela-fault-primary:openai/gpt-oss-20b" ||
    cfg.expectedFault !== "intentionally_invalid_credential"
  ) {
    console.log(
      JSON.stringify({
        status: "blocked",
        requestsSent: 0,
        reason: "Owner-confirmed isolated credential-fault configuration is required.",
      }),
    );
    process.exitCode = 2;
    return;
  }
  if (!key || key === process.env.OTARI_API_KEY) {
    console.log(
      JSON.stringify({ status: "blocked", requestsSent: 0, reason: "A separate isolated workspace key is required." }),
    );
    process.exitCode = 2;
    return;
  }
  const dir = ".local-evaluation",
    file = dir + "/live-verification.json";
  const lock = fs.openSync(dir + "/live-verification.lock", "wx");
  try {
    const ledger = JSON.parse(fs.readFileSync(file)),
      auth = JSON.parse(fs.readFileSync(dir + "/authorization.json"));
    if (ledger.controlledChecks?.credential_recovery) throw Error("One-shot allocation already exists; no replay");
    const prior = ledger.passageAllocation;
    if (
      auth.capMicrousd !== 20000000 ||
      prior?.status !== "settled_completed" ||
      ledger.controlledChecks?.ceiling?.status !== "hosted_scoped_budget_denial_observed"
    )
      throw Error("Reconcile authorization and ceiling first");
    const previousExposure =
      prior.conservativePriorExposureMicrousd +
      prior.reportedMicrousd +
      prior.reservedMicrousd +
      Object.values(ledger.controlledChecks).reduce(
        (n, v) => n + v.run.budget.reportedMicrousd + v.run.budget.reservedMicrousd,
        0,
      );
    const cap = 10000;
    if (previousExposure + cap > auth.capMicrousd) throw Error("Remaining authorization unavailable");
    const gateway = new OtariGatewayService(
      new ConfigService({
        OTARI_API_KEY: key,
        OTARI_EXTRACTION_POLICY: policies.extraction,
        OTARI_REVIEW_POLICY: policies.review,
        OTARI_RUN_BUDGET_MICROUSD: String(cap),
        OTARI_RUN_MAX_CALLS: "2",
        OTARI_CALL_RESERVATION_MICROUSD: "5000",
      }),
    );
    const original = require("../evaluation/passage-live-verification.json").application;
    const paper = original.dossier.literature.items[0],
      molecule = original.dossier.overview.molecule;
    const run = gateway.createRun(crypto.randomUUID());
    run.inferenceContract = "passage-selection-v1";
    run.snapshots = structuredClone(original.snapshots);
    const result = {
      allocationId: crypto.randomUUID(),
      allocatedAt: new Date().toISOString(),
      authorization:
        "Owner requested controlled recovery within retained $20 total and confirmed isolated dummy-credential fault setup.",
      conservativePriorExposureMicrousd: previousExposure,
      authorizedTotalMicrousd: auth.capMicrousd,
      status: "started",
      policies,
      configuredFault: {
        expectedPrimary: cfg.expectedPrimary,
        expectedFault: cfg.expectedFault,
        provenance: "owner confirmation; actual attempted-provider trace requires separate inspection",
      },
      publicationAllowed: false,
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      sourceHashes: Object.fromEntries(
        [
          "scripts/verify-credential-recovery.cjs",
          "apps/api/src/research/publication-policy.ts",
          "apps/api/src/research/recorded-source-assessments.ts",
          "apps/api/src/research/otari-gateway.service.ts",
          "apps/api/src/research/otari-evidence.service.ts",
          "apps/api/src/research/passage-references.ts",
        ].map((p) => [p, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]),
      ),
      run,
    };
    ledger.controlledChecks.credential_recovery = result;
    const save = async () => {
      fs.writeFileSync(file + ".tmp", JSON.stringify(ledger, null, 2) + "\n");
      fs.renameSync(file + ".tmp", file);
    };
    await save(); // New allocation and frozen source table durable before either inference.
    try {
      const output = await gateway.complete(
        "extraction",
        EXTRACTION_PROMPT,
        extractionInput(paper, molecule, run.snapshots),
        run,
        save,
        { maxOutputTokens: 2000, reasoningEffort: "low" },
      );
      result.extraction = output;
      await save();
      const event = run.events.at(-1);
      if (event.fallback !== true || !canonicalRoleModel("extraction", event))
        throw Error("Expected hosted OVHcloud recovery not observed; no replay");
      const claims = verifySelection(output, run.snapshots, paper.id);
      run.decisions = claims.map((c) => decide(c, undefined, run.snapshots));
      result.extraction = output;
      await save();
      if (!canonicalRoleModel("extraction", event)) throw Error("Expected extraction identity not observed");
      if (!claims.length) {
        result.status = "extraction_routed_empty_no_review";
        await save();
        return;
      }
      const reviewed = await gateway.complete(
        "review",
        REVIEW_PROMPT,
        {
          schema: z.toJSONSchema(ReviewSelectionSchema),
          expectedClaimIds: claims.map((c) => c.id),
          claims,
          papers: [paper],
          snapshots: run.snapshots,
          passageIndex: run.snapshots.map((s) => ({ snapshotId: s.id, index: s.passageIndex })),
        },
        run,
        save,
        { maxOutputTokens: 2000, reasoningEffort: "low" },
      );
      result.review = reviewed;
      await save();
      const reviews = hydrateReviews(reviewed, claims, run.snapshots).reviews;
      exactIds(
        claims.map((c) => c.id),
        reviews.map((r) => r.claimId),
        "Isolated review coverage",
      );
      result.review = reviewed;
      run.decisions = claims.map((c) =>
        decide(
          c,
          reviews.find((r) => r.claimId === c.id),
          run.snapshots,
        ),
      );
      if (!canonicalRoleModel("review", run.events.at(-1)) || !run.models.distinct)
        throw Error("Distinct review identity not observed");
      result.canonicalModels = {
        extraction: canonicalRoleModel("extraction", event),
        review: canonicalRoleModel("review", run.events.at(-1)),
        provenance: "Exact provider/model offering spellings; original observed headers retained.",
      };
      result.status = "credential_recovery_observed";
      applyRecordedSourceAssessments(run);
      run.decisions = publicationDecisions(run);
      result.observedFallback = run.events.some((e) => e.fallback === true);
      result.limitation =
        "Fixed recorded source, isolated role check. No new retrieval/sandbox/UI investigation or publication. Fallback recovery claimed only if an actual fallback header is observed.";
    } catch (e) {
      result.status = "failed_no_retry";
      result.errorCode = typeof e.code === "string" ? e.code : "ISOLATED_POLICY_CHECK_FAILED";
      process.exitCode = 1;
    } finally {
      result.completedAt = new Date().toISOString();
      await save();
    }
    console.log(
      JSON.stringify({
        status: result.status,
        observedFallback: result.observedFallback,
        models: run.models,
        events: run.events,
        budget: run.budget,
      }),
    );
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(dir + "/live-verification.lock");
  }
}
module.exports = { verifySelection, canonicalRoleModel };
if (require.main === module)
  main().catch(() => {
    console.error("Isolated policy check blocked/stopped; no credentials or private errors logged.");
    process.exitCode = 1;
  });
