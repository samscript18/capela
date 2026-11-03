// A two-call live check. It never runs retrieval through Otari or a sandbox audit.
require("reflect-metadata");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { ConfigService } = require("@nestjs/config");
const { z } = require("zod");
const { ExtractionSchema, ReviewSchema } = require("@capela/shared");
const { OtariGatewayService } = require("../apps/api/dist/research/otari-gateway.service");
const { EXTRACTION_PROMPT, REVIEW_PROMPT } = require("../apps/api/dist/research/otari-evidence.service");
const { snapshot, referenceValid, exactIds, decide, sourcePassages } = require("../apps/api/dist/research/provenance");
const { PublicationSchema } = require("../apps/api/dist/research/otari-retrieval.service");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const dir = ".local-evaluation",
  file = path.join(dir, "live-verification.json");
function write(data) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(temporary, file);
}
function prepareFundingRetry(report) {
  if (
    report.roleCheck.status !== "failed" ||
    !["OTARI_BUDGET_DENIED", "OTARI_INSUFFICIENT_FUNDS"].includes(report.roleCheck.errorCode)
  )
    throw new Error("Only an explicitly authorized funding-refusal retry is supported");
  return archiveRetry(report, "Owner redeemed the hackathon voucher and explicitly requested another attempt");
}
function prepareFormatRetry(report) {
  if (
    report.roleCheck.status !== "failed" ||
    report.roleCheck.errorCode !== "OTARI_INVALID_JSON" ||
    report.run.budget.terminal
  )
    throw new Error("Only a nonterminal JSON-format failure can validate the native JSON-mode fix");
  if (
    report.previousAttempts?.some(
      (a) => a.roleCheck.retryReason === "Validate native JSON mode after the observed malformed-output failure",
    )
  )
    throw new Error("The one native-format validation retry has already been used");
  return archiveRetry(report, "Validate native JSON mode after the observed malformed-output failure");
}
function prepareBoundsRetry(report) {
  if (
    report.roleCheck.status !== "failed" ||
    report.roleCheck.errorCode !== "OTARI_PROVIDER_ERROR" ||
    report.run.events.at(-1)?.httpStatus !== 504 ||
    report.run.budget.terminal
  )
    throw new Error("Only the observed nonterminal 504 can validate the tighter request bounds");
  if (
    report.previousAttempts?.some(
      (a) => a.roleCheck.retryReason === "Validate lower output/reasoning bounds after the hosted 504",
    )
  )
    throw new Error("The bounded timeout retry has already been used");
  return archiveRetry(report, "Validate lower output/reasoning bounds after the hosted 504");
}
function prepareDiagnosticRetry(report) {
  if (
    report.roleCheck.status !== "failed" ||
    report.roleCheck.errorCode !== "OTARI_INVALID_JSON" ||
    report.run.budget.terminal
  )
    throw new Error("A nonterminal JSON failure is required for bounded response diagnosis");
  if (
    report.previousAttempts?.some(
      (a) => a.roleCheck.retryReason === "Capture one bounded provider response to diagnose JSON parsing",
    )
  )
    throw new Error("The response-shape diagnostic has already been used");
  return archiveRetry(report, "Capture one bounded provider response to diagnose JSON parsing");
}
function prepareSchemaRetry(report) {
  if (
    report.roleCheck.status !== "failed" ||
    report.roleCheck.errorCode !== "OTARI_INVALID_JSON" ||
    report.run.budget.terminal
  )
    throw new Error("A nonterminal JSON failure is required to validate the strict wire-schema fix");
  if (
    report.previousAttempts?.some(
      (a) =>
        a.roleCheck.retryReason === "Validate strict native JSON schema after captured malformed JSON-object output",
    )
  )
    throw new Error("The strict schema validation retry has already been used");
  return archiveRetry(report, "Validate strict native JSON schema after captured malformed JSON-object output");
}
function archiveRetry(report, reason) {
  const b = report.run.budget;
  if (b.capMicrousd - b.reservedMicrousd - b.reportedMicrousd < 4000)
    throw new Error("Remaining shared allowance cannot reserve both role calls");
  const previous = structuredClone({ run: report.run, roleCheck: report.roleCheck });
  const next = structuredClone(report.run);
  next.runId = crypto.randomUUID();
  next.events = [];
  next.models = { distinct: false };
  next.decisions = [];
  next.budget.terminal = false;
  report.previousAttempts = [...(report.previousAttempts ?? []), previous];
  report.run = next;
  report.roleCheck = {
    status: "prepared",
    retryAuthorizedAt: new Date().toISOString(),
    retryReason: reason,
  };
  return report;
}
async function main() {
  const args = process.argv.slice(2),
    prepare = args.includes("--prepare"),
    execute = args.includes("--run");
  if (!prepare && !execute) {
    console.log(
      "Choose --prepare (free remote source check) or --run (two paid role calls within the authorized shared cap).",
    );
    process.exitCode = 2;
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const lock = fs.openSync(path.join(dir, "live-verification.lock"), "wx");
  try {
    if (prepare) {
      if (fs.existsSync(file)) throw new Error("A verification ledger already exists; do not reset it.");
      const index = args.indexOf("--api-url"),
        url = new URL(args[index + 1]);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
        throw new Error("HTTPS API origin required");
      url.pathname = "/research-mcp";
      const client = new Client({ name: "capela-source-preflight", version: "1.0.0" });
      try {
        await client.connect(
          new StreamableHTTPClientTransport(url, {
            requestInit: {
              redirect: "error",
              headers: { Authorization: `Bearer ${process.env.CAPELA_MCP_TOKEN}` },
              signal: AbortSignal.timeout(30000),
            },
          }),
        );
        const tools = await client.listTools();
        if (!tools.tools.some((t) => t.name === "publication_abstract"))
          throw new Error("Expected read-only tool unavailable");
        const result = await client.callTool({
          name: "publication_abstract",
          arguments: { url: "https://pubmed.ncbi.nlm.nih.gov/42505335/" },
        });
        if (result.isError) throw new Error("Publication tool failed");
        const publication = PublicationSchema.parse(result.structuredContent);
        if (publication.pmid !== "42505335") throw new Error("Wrong canonical paper");
        const source = snapshot(publication.pmid, publication.canonicalUrl, publication.abstract);
        const gateway = new OtariGatewayService(new ConfigService(process.env));
        const run = gateway.createRun(crypto.randomUUID());
        const cap = Number(process.env.OTARI_LIVE_TEST_BUDGET_MICROUSD ?? 0);
        if (!Number.isSafeInteger(cap) || cap <= 0) throw new Error("Explicit finite live-test cap required");
        run.budget.capMicrousd = Math.min(run.budget.capMicrousd, cap);
        run.snapshots = [source];
        const paper = {
          id: publication.pmid,
          source: "PUBMED",
          title: publication.title,
          authors: publication.authors,
          journal: publication.journal,
          abstract: source.text,
          publicationTypes: publication.publicationTypes,
          studyType: "journal_article",
          externalUrl: publication.canonicalUrl,
          fullTextAvailable: false,
          openAccess: false,
          relevanceScore: 0,
          relevanceReasons: ["Canonical metadata from the existing authenticated remote MCP endpoint"],
          matchedQueries: [],
        };
        write({
          version: "live-verification-v1",
          preparedAt: new Date().toISOString(),
          node: process.version,
          commit: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          apiUrl: url.origin,
          sourcePreparation: "Direct authenticated remote MCP; not hosted Otari tool execution",
          publication,
          paper,
          run,
          roleCheck: { status: "prepared" },
          limitations: [
            "Minimal role/schema/passage check, not a complete investigation or reviewed scientific evaluation.",
          ],
        });
        console.log(
          "Canonical abstract fetched through the existing remote MCP server; source and zero-spend ledger saved.",
        );
      } finally {
        await client.close();
      }
      return;
    }
    const cap = Number(process.env.OTARI_LIVE_TEST_BUDGET_MICROUSD ?? 0);
    const authFile = path.join(dir, "authorization.json");
    if (!Number.isSafeInteger(cap) || cap <= 0 || !fs.existsSync(authFile)) {
      console.log("Blocked: explicit live cap and owner-confirmed hosted ceiling are required. No requests sent.");
      process.exitCode = 2;
      return;
    }
    const authorization = JSON.parse(fs.readFileSync(authFile));
    if (authorization.hostedCeiling !== "owner-confirmed" || authorization.capMicrousd !== cap)
      throw new Error("Authorization does not match the finite local cap");
    const report = JSON.parse(fs.readFileSync(file));
    const fundingRetry = args.includes("--retry-after-funding");
    const formatRetry = args.includes("--validate-json-mode");
    const boundsRetry = args.includes("--validate-request-bounds");
    const diagnosticRetry = args.includes("--capture-provider-shape");
    const schemaRetry = args.includes("--validate-native-schema");
    if ([fundingRetry, formatRetry, boundsRetry, diagnosticRetry, schemaRetry].filter(Boolean).length > 1)
      throw new Error("Choose one explicit retry reason");
    if (fundingRetry) prepareFundingRetry(report);
    if (formatRetry) prepareFormatRetry(report);
    if (boundsRetry) prepareBoundsRetry(report);
    if (diagnosticRetry) prepareDiagnosticRetry(report);
    if (schemaRetry) prepareSchemaRetry(report);
    if (
      (!fundingRetry &&
        !formatRetry &&
        !boundsRetry &&
        !diagnosticRetry &&
        !schemaRetry &&
        report.run.budget.calls > 0) ||
      report.roleCheck.status !== "prepared"
    ) {
      console.log("Verification has already dispatched work; automatic replay is disabled. Existing ledger retained.");
      process.exitCode = 2;
      return;
    }
    report.run.budget.capMicrousd = Math.min(report.run.budget.capMicrousd, cap);
    const gateway = new OtariGatewayService(
      new ConfigService({ ...process.env, OTARI_CALL_RESERVATION_MICROUSD: "2000" }),
    );
    const run = report.run,
      save = async () => write(report),
      source = run.snapshots[0];
    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      if (String(input) === "https://otari.ai/api/v1/chat/completions" && response.ok) {
        try {
          const { boundedJson } = require("../apps/api/dist/research/otari-gateway.service");
          const raw = await boundedJson(response.clone(), 300000);
          const message = raw.choices?.[0]?.message;
          const content = message?.content;
          report.providerResponses = [
            ...(report.providerResponses ?? []),
            {
              at: new Date().toISOString(),
              requestId: response.headers.get("Otari-Request-ID"),
              finishReason: raw.choices?.[0]?.finish_reason,
              messageKeys: Object.keys(message ?? {}),
              content,
              contentCharacters: typeof content === "string" ? content.length : null,
              reasoningCharacters:
                typeof message?.reasoning_content === "string" ? message.reasoning_content.length : null,
            },
          ];
          await save();
        } catch {
          report.responseCapture = "unavailable";
        }
      }
      return response;
    };
    const molecule = { preferredName: "curcumin", synonyms: [] };
    const passages = sourcePassages(source);
    try {
      report.roleCheck.status = "running";
      await save();
      const extracted = ExtractionSchema.parse(
        await gateway.complete(
          "extraction",
          `${EXTRACTION_PROMPT} For this minimal check extract at most one explicit measured finding about curcumin. The passage index supplies exact quote boundaries; it is source data, not a set of proposed claims.`,
          {
            schema: z.toJSONSchema(ExtractionSchema),
            molecule,
            papers: [report.paper],
            snapshots: run.snapshots,
            passageIndex: passages,
          },
          run,
          save,
          { maxOutputTokens: 2000, reasoningEffort: "low" },
        ),
      );
      exactIds(
        [report.paper.id],
        extracted.papers.map((p) => p.paperId),
      );
      const claims = extracted.papers.flatMap((p) => p.claims);
      if (claims.length !== 1 || claims.some((c) => c.paperId !== report.paper.id || !referenceValid(c, run.snapshots)))
        throw Object.assign(new Error("Extraction failed the one-claim exact-passage check"), {
          code: "INVALID_EXTRACTION_SPAN",
        });
      report.roleCheck.extraction = extracted;
      await save();
      const reviewed = ReviewSchema.parse(
        await gateway.complete(
          "review",
          REVIEW_PROMPT,
          {
            schema: z.toJSONSchema(ReviewSchema),
            molecule,
            papers: [report.paper],
            snapshots: run.snapshots,
            claims,
            passageIndex: passages,
          },
          run,
          save,
          { maxOutputTokens: 2000, reasoningEffort: "low" },
        ),
      );
      exactIds(
        claims.map((c) => c.id),
        reviewed.reviews.map((r) => r.claimId),
      );
      run.decisions = claims.map((c) =>
        decide(
          c,
          reviewed.reviews.find((r) => r.claimId === c.id),
          run.snapshots,
        ),
      );
      if (!run.models.distinct)
        throw Object.assign(new Error("Distinct resolved models not observed"), {
          code: "MODEL_IDENTITIES_UNCONFIRMED",
        });
      report.roleCheck.review = reviewed;
      report.roleCheck.status = "passed";
      report.roleCheck.completedAt = new Date().toISOString();
      await save();
    } catch (error) {
      report.roleCheck.status = "failed";
      report.roleCheck.errorCode = typeof error.code === "string" ? error.code : "INVALID_ROLE_OUTPUT";
      await save();
      process.exitCode = 1;
    }
    console.log(
      JSON.stringify(
        {
          status: report.roleCheck.status,
          errorCode: report.roleCheck.errorCode,
          models: run.models,
          budget: run.budget,
          events: run.events,
          decisions: run.decisions.map((d) => ({ id: d.candidate.id, status: d.status, reason: d.reason })),
        },
        null,
        2,
      ),
    );
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(path.join(dir, "live-verification.lock"));
  }
}
module.exports = { prepareFundingRetry, prepareFormatRetry, prepareBoundsRetry, prepareDiagnosticRetry };
if (require.main === module)
  main().catch(() => {
    console.error(
      "Role smoke stopped before a usable result; inspect the retained ledger. Credentials were not logged.",
    );
    process.exitCode = 1;
  });
