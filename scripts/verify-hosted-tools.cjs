// Real isolated MCP/audit checks; not a complete investigation or scientific acceptance.
require("reflect-metadata");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { ConfigService } = require("@nestjs/config");
const { OtariGatewayService } = require("../apps/api/dist/research/otari-gateway.service");
const { PublicationSchema, PublicationInput } = require("../apps/api/dist/research/otari-retrieval.service");
const { snapshot, referenceValid } = require("../apps/api/dist/research/provenance");
const { remoteAudit } = require("../apps/api/dist/research/evidence-audit");
async function main() {
  const dir = ".local-evaluation",
    file = `${dir}/live-verification.json`;
  const cap = Number(process.env.OTARI_LIVE_TEST_BUDGET_MICROUSD ?? 0);
  const authorization = JSON.parse(fs.readFileSync(`${dir}/authorization.json`));
  if (cap <= 0 || cap !== authorization.capMicrousd || authorization.hostedCeiling !== "owner-confirmed")
    throw new Error("Finite authorization must match");
  const lock = fs.openSync(`${dir}/live-verification.lock`, "wx");
  try {
    const report = JSON.parse(fs.readFileSync(file));
    const auditOnly = process.argv.includes("--audit-only");
    const resultKey = auditOnly ? "auditCheck" : "toolsCheck";
    if (process.argv.includes("--retry-discovery")) {
      const previous = report.toolsCheck;
      if (
        auditOnly ||
        report.previousToolsCheck ||
        previous?.status !== "failed" ||
        previous.run.events.length !== 1 ||
        previous.run.events[0].operation !== "mcp_discovery" ||
        previous.run.events[0].httpStatus !== 502 ||
        report.run.budget.terminal
      )
        throw new Error("Only one previously failed free discovery may be checked again");
      report.previousToolsCheck = previous;
      delete report.toolsCheck;
    }
    if (report[resultKey] || report.roleCheck.status !== "passed" || report.run.budget.terminal)
      throw new Error("One unused tools check and valid prior role results required");
    if (
      cap - report.run.budget.reservedMicrousd - report.run.budget.reportedMicrousd <
      (auditOnly || report.auditCheck?.status === "passed" ? 10000 : 20000)
    )
      throw new Error("Cannot reserve both tool calls");
    const gateway = new OtariGatewayService(
      new ConfigService({ ...process.env, OTARI_CALL_RESERVATION_MICROUSD: "10000" }),
    );
    const run = gateway.createRun(crypto.randomUUID());
    run.budget = report.run.budget;
    const result = { status: "running", scope: "isolated tools over a real candidate; not published evidence", run };
    report[resultKey] = result;
    const save = async () => {
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(report, null, 2) + "\n");
      fs.renameSync(`${file}.tmp`, file);
    };
    await save();
    try {
      const source = report.run.snapshots[0];
      run.snapshots = [source];
      if (!auditOnly) {
        const server = gateway.value("OTARI_MCP_SERVER_ID");
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(server)) throw new Error("Invalid server ID");
        const discovery = (await gateway.request(`/mcp/servers/${server}/tools`, undefined, "mcp_discovery", run, save))
          .data;
        if (
          discovery.server_id !== server ||
          typeof discovery.server_revision !== "string" ||
          !discovery.tools?.some(
            (t) => t.name === "publication_abstract" && t.input_schema?.additionalProperties === false,
          )
        )
          throw new Error("Unexpected discovery contract");
        const args = PublicationInput.parse({ url: source.canonicalUrl });
        const response = (
          await gateway.request(
            "/mcp/execute",
            {
              mcp_server_id: server,
              tool_name: "publication_abstract",
              arguments: args,
              server_revision: discovery.server_revision,
              client_execution_id: crypto.randomUUID(),
            },
            "publication_metadata",
            run,
            save,
          )
        ).data;
        if (response.isError || response.resultType !== "complete") throw new Error("Incomplete MCP result");
        const publication = PublicationSchema.parse(response.structuredContent);
        const retrieved = snapshot(publication.pmid, publication.canonicalUrl, publication.abstract);
        if (retrieved.canonicalUrl !== source.canonicalUrl || retrieved.hash !== source.hash)
          throw new Error("Retrieved snapshot differs from the role-check source");
        run.snapshots = [retrieved];
        result.publication = publication;
      }
      const claims = report.roleCheck.extraction.papers.flatMap((p) => p.claims);
      if (!claims.length || claims.some((c) => !referenceValid(c, run.snapshots)))
        throw new Error("Invalid source support");
      await save();
      // This audits a nonempty real candidate set mechanically; the unresolved review remains unresolved.
      if (
        !auditOnly &&
        report.auditCheck?.status === "passed" &&
        report.auditCheck.run.snapshots[0]?.hash === run.snapshots[0].hash
      ) {
        result.priorAuditRequestId = report.auditCheck.run.audit.requestId;
      } else {
        await remoteAudit(gateway, claims, run, save);
      }
      result.status = "passed";
      result.candidatesAudited = claims.length;
      result.publishedClaims = 0;
    } catch (error) {
      result.status = "failed";
      result.errorCode = typeof error.code === "string" ? error.code : "TOOL_VALIDATION_FAILED";
      process.exitCode = 1;
    }
    await save();
    console.log(
      JSON.stringify(
        {
          status: result.status,
          errorCode: result.errorCode,
          audit: run.audit,
          events: run.events,
          budget: run.budget,
          publishedClaims: result.publishedClaims,
        },
        null,
        2,
      ),
    );
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(`${dir}/live-verification.lock`);
  }
}
main().catch(() => {
  console.error("Hosted tools check blocked; no credentials logged.");
  process.exitCode = 1;
});
