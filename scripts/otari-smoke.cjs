const fs = require("node:fs");
const required = [
  "OTARI_API_KEY",
  "OTARI_BUDGET_REFERENCE",
  "OTARI_EXTRACTION_POLICY",
  "OTARI_REVIEW_POLICY",
  "OTARI_MCP_SERVER_ID",
];
const cap = Number(process.env.OTARI_LIVE_TEST_BUDGET_MICROUSD ?? 0);
const missing = required.filter((k) => !process.env[k]?.trim());
async function main() {
  if (missing.length || !Number.isSafeInteger(cap) || cap <= 0) {
    console.log(
      JSON.stringify({
        status: "blocked",
        missingKeys: missing,
        reason: "Set a finite positive local live-test cap and runtime configuration. No requests sent.",
      }),
    );
    process.exitCode = 2;
    return;
  }
  // This first smoke is catalog-only and never spends the authorized cap.
  const headers = { Authorization: `Bearer ${process.env.OTARI_API_KEY}` };
  const report = {
    at: new Date().toISOString(),
    kind: "hosted-catalog-only",
    models: [],
    tools: [],
    paidRequests: 0,
    limitations: [
      "Catalog access is not execution evidence. Role calls, routing failure, tools and real budget denial remain separate funded checks.",
    ],
  };
  for (const path of ["models", "tools"]) {
    const response = await fetch(`https://otari.ai/api/v1/${path}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Catalog ${path}: HTTP ${response.status}`);
    const data = await response.json();
    report[path] = path === "models" ? (data.data ?? []).map((m) => ({ id: m.id })) : data;
  }
  fs.writeFileSync("evaluation/hosted-catalog.json", JSON.stringify(report, null, 2) + "\n");
  console.log("Hosted catalog saved. No inference or tool execution performed; no capability verified.");
}
main().catch(() => {
  console.error("Hosted catalog smoke failed; no provider details or credentials logged.");
  process.exitCode = 1;
});
