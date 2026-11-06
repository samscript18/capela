// Single-shot controlled checks only. Missing isolated configuration causes ZERO network calls.
require("reflect-metadata");
const fs = require("node:fs"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process");
const { ConfigService } = require("@nestjs/config");
const { OtariGatewayService } = require("../apps/api/dist/research/otari-gateway.service");
const { extractionInput, EXTRACTION_PROMPT } = require("../apps/api/dist/research/otari-evidence.service");
const { hydrateExtraction } = require("../apps/api/dist/research/passage-references");
const { referenceValid } = require("../apps/api/dist/research/provenance");
function controlledAllocationCap(mode, settings) {
  const cap = mode === "ceiling" ? 20000 : mode === "routing" ? 10000 : 0;
  if (
    !cap ||
    !Number.isSafeInteger(settings?.requestHoldMicrousd) ||
    settings.requestHoldMicrousd <= 0 ||
    settings.requestHoldMicrousd > cap
  )
    return undefined;
  if (
    mode === "ceiling" &&
    (!Number.isSafeInteger(settings.hostedLimitMicrousd) ||
      settings.hostedLimitMicrousd <= 0 ||
      settings.hostedLimitMicrousd >= settings.requestHoldMicrousd ||
      !Number.isSafeInteger(settings.maxOutputTokens) ||
      settings.maxOutputTokens < 16 ||
      settings.maxOutputTokens > 4096)
  )
    return undefined;
  return cap;
}
async function main() {
  const mode = process.argv[2];
  if (!["routing", "ceiling"].includes(mode)) throw Error("Choose routing or ceiling");
  const configPath = ".local-evaluation/controlled-test-config.json";
  const cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath)) : {};
  const raw = cfg[mode];
  const settings =
    raw &&
    Object.fromEntries(
      [
        "isolated",
        "policy",
        "configurationReference",
        "controlledFailureReference",
        "expectedFallbackModel",
        "hostedLimitMicrousd",
        "requestHoldMicrousd",
        "nonExempt",
        "maxOutputTokens",
      ].map((k) => [k, raw[k]]),
    );
  const safe = (v) => typeof v === "string" && /^[a-zA-Z0-9._:/-]{1,200}$/.test(v) && !/bearer|tk-|https?:/i.test(v);
  const key = process.env[mode === "routing" ? "OTARI_ROUTING_TEST_API_KEY" : "OTARI_CEILING_TEST_API_KEY"];
  const cap = controlledAllocationCap(mode, settings);
  if (
    !key ||
    settings?.isolated !== true ||
    !safe(settings?.policy) ||
    !safe(settings?.configurationReference) ||
    !cap ||
    key === process.env.OTARI_API_KEY ||
    (mode === "routing" && (!safe(settings.controlledFailureReference) || !safe(settings.expectedFallbackModel))) ||
    (mode === "ceiling" &&
      (!Number.isSafeInteger(settings.hostedLimitMicrousd) ||
        !Number.isSafeInteger(settings.requestHoldMicrousd) ||
        settings.hostedLimitMicrousd <= 0 ||
        settings.hostedLimitMicrousd >= settings.requestHoldMicrousd ||
        settings.nonExempt !== true))
  ) {
    console.log(
      JSON.stringify({
        mode,
        status: "blocked",
        requestsSent: 0,
        reason:
          "Dedicated isolated test key/policy and recorded operator configuration are missing. Working production settings are not modified.",
      }),
    );
    process.exitCode = 2;
    return;
  }
  const dir = ".local-evaluation",
    file = dir + "/live-verification.json",
    lock = fs.openSync(dir + "/live-verification.lock", "wx");
  try {
    const ledger = JSON.parse(fs.readFileSync(file)),
      auth = JSON.parse(fs.readFileSync(dir + "/authorization.json"));
    if (ledger.controlledChecks?.[mode]) throw Error("This single-shot check already exists; no replay");
    const prior = ledger.passageAllocation;
    if (prior?.status !== "settled_completed" || auth.capMicrousd !== 20000000)
      throw Error("Reconcile existing task ledger first");
    const previousExposure = prior.conservativePriorExposureMicrousd + prior.reportedMicrousd + prior.reservedMicrousd;
    const previousControlled = Object.values(ledger.controlledChecks ?? {}).reduce(
      (n, v) => n + v.run.budget.reportedMicrousd + v.run.budget.reservedMicrousd,
      0,
    );
    if (previousExposure + previousControlled + cap > auth.capMicrousd) throw Error("Authorized allowance unavailable");
    const gateway = new OtariGatewayService(
      new ConfigService({
        OTARI_API_KEY: key,
        OTARI_EXTRACTION_POLICY: settings.policy,
        OTARI_RUN_BUDGET_MICROUSD: String(cap),
        OTARI_RUN_MAX_CALLS: "1",
        OTARI_CALL_RESERVATION_MICROUSD: String(cap),
      }),
    );
    const run = gateway.createRun(crypto.randomUUID());
    const original = require("../evaluation/passage-live-verification.json").application;
    run.snapshots = structuredClone(original.snapshots);
    run.inferenceContract = "passage-selection-v1";
    const result = {
      allocationId: crypto.randomUUID(),
      allocatedAt: new Date().toISOString(),
      authorization:
        "Owner-authorized bounded capability verification within the retained $20 total; one dispatch only.",
      conservativePriorExposureMicrousd: previousExposure + previousControlled,
      authorizedTotalMicrousd: auth.capMicrousd,
      mode,
      status: "started",
      configuration: settings,
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      sourceHashes: Object.fromEntries(
        ["scripts/controlled-hosted-checks.cjs", "apps/api/src/research/otari-gateway.service.ts"].map((p) => [
          p,
          crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"),
        ]),
      ),
      run,
    };
    ledger.controlledChecks ??= {};
    ledger.controlledChecks[mode] = result;
    const save = async () => {
      fs.writeFileSync(file + ".tmp", JSON.stringify(ledger, null, 2) + "\n");
      fs.renameSync(file + ".tmp", file);
    };
    await save();
    try {
      if (mode === "routing") {
        const paper = original.dossier.literature.items[0],
          molecule = original.dossier.overview.molecule;
        const output = await gateway.complete(
          "extraction",
          EXTRACTION_PROMPT,
          extractionInput(paper, molecule, run.snapshots),
          run,
          save,
          { maxOutputTokens: 2000, reasoningEffort: "low" },
        );
        const extracted = hydrateExtraction(output, run.snapshots),
          claims = extracted.papers.flatMap((p) => p.claims);
        const event = run.events.at(-1);
        if (
          !claims.length ||
          claims.some((c) => !referenceValid(c, run.snapshots)) ||
          event.fallback !== true ||
          event.model !== settings.expectedFallbackModel
        )
          throw Error("Actual fallback/output not established");
        result.extraction = extracted;
        result.status = "hosted_fallback_observed_valid_extraction";
        result.limitation =
          "Isolated controlled role check; owner must retain actual attempted-model dashboard trace. Not a complete publication run.";
      } else {
        try {
          await gateway.request(
            "/chat/completions",
            {
              model: settings.policy,
              stream: false,
              max_tokens: settings.maxOutputTokens,
              messages: [{ role: "user", content: "Reply OK." }],
            },
            "controlled_ceiling_denial",
            run,
            save,
            cap,
          );
          result.status = "unexpected_success_stop_no_repeat";
        } catch (e) {
          if (
            e.code !== "OTARI_BUDGET_DENIED" ||
            run.events.at(-1)?.httpStatus !== 403 ||
            !run.events.at(-1)?.budgetScope
          )
            throw e;
          result.status = "hosted_scoped_budget_denial_observed";
          const count = run.events.length;
          try {
            await gateway.request("/chat/completions", {}, "must_not_dispatch", run, save, cap);
            throw Error("Terminal denial bypassed");
          } catch (next) {
            if (next.code !== "RUN_BUDGET_EXHAUSTED" || run.events.length !== count) throw next;
          }
          result.noSubsequentDispatch = true;
        }
      }
    } catch (e) {
      result.status = "failed_no_retry";
      result.errorCode = typeof e.code === "string" ? e.code : "CONTROLLED_CHECK_UNVERIFIED";
      process.exitCode = 1;
    }
    await save();
    console.log(JSON.stringify({ mode, status: result.status, events: run.events, budget: run.budget }, null, 2));
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(dir + "/live-verification.lock");
  }
}
module.exports = { controlledAllocationCap };
if (require.main === module)
  main().catch(() => {
    console.error("Controlled check blocked/stopped. Private errors and credentials are not logged.");
    process.exitCode = 1;
  });
