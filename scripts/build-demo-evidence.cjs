// Offline, read-only presentation of existing sanitized verification artifacts.
const fs = require("node:fs");
const crypto = require("node:crypto");
const ARTIFACT_COMMIT = "d81c03e7cd94b5210d1094818ec9e4e0b479376b";
const files = {
  investigation: "evaluation/passage-live-verification.json",
  ceiling: "evaluation/hosted-ceiling-verification.json",
  guardrail: "evaluation/hosted-guardrail-metadata-verification.json",
};
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
function build() {
  const artifacts = Object.fromEntries(
    Object.entries(files).map(([k, p]) => [k, JSON.parse(fs.readFileSync(p, "utf8"))]),
  );
  const app = artifacts.investigation.application;
  const event = (op) => {
    const e = app.events.find((e) => e.operation === op && e.status === "completed");
    if (!e?.requestId || e.httpStatus !== 200) throw Error("Missing completed recorded operation: " + op);
    return e;
  };
  const search = event("scientific_search_tool"),
    mcp = event("publication_metadata"),
    extract = event("extraction"),
    review = event("review"),
    sandbox = event("sandbox_audit");
  const ceiling = artifacts.ceiling.outcome,
    denial = ceiling.events[0];
  const guard = artifacts.guardrail.run.events[0];
  if (
    !app.models.distinct ||
    extract.model === review.model ||
    !app.audit.remote ||
    !app.audit.valid ||
    denial.upstreamCode !== "budget_exceeded" ||
    !ceiling.applicationTerminal ||
    !ceiling.noSubsequentDispatch ||
    artifacts.guardrail.status !== "hosted_guardrail_violation_observed" ||
    guard.httpStatus !== 403 ||
    guard.upstreamCode !== "guardrail_violation" ||
    !guard.guardrails?.results.some((r) => r.mode === "block" && r.status === "evaluated" && r.valid === false)
  )
    throw Error("Recorded verification prerequisites missing");
  const original = (name) => `https://github.com/samscript18/capela/blob/${ARTIFACT_COMMIT}/${files[name]}`;
  const date = (e) => {
    const d = new Date(e.at);
    if (!Number.isFinite(d.valueOf())) throw Error("Missing recorded date");
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  };
  const technical = (events, extra = {}) => {
    // Explicit field whitelist: never serialize whole runs, owners, prompts or configuration.
    const rows = events
      .flatMap((e) => [
        ["Recorded at (UTC)", e.at],
        ["Request ID", e.requestId],
        ["HTTP status", e.httpStatus],
        ...(e.model ? [["Observed model", e.model]] : []),
        ...(e.upstreamCode ? [["Refusal code", e.upstreamCode]] : []),
      ])
      .concat(Object.entries(extra));
    return `<details><summary>Request details and provenance</summary><dl>${rows.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("")}</dl></details>`;
  };
  const cards = [
    {
      id: "search",
      title: "Hosted search",
      e: search,
      type: "Recorded investigation",
      result: "Canonical publication discovered",
      text: "Hosted Otari search selected scientific source material for the completed curcumin investigation.",
      note: "The selected PubMed review abstract was then retrieved and used by both models.",
      artifact: "investigation",
      meta: technical([search], { "Search tool call": search.toolCallId, "Canonical publication": "PubMed 32141677" }),
    },
    {
      id: "mcp",
      title: "MCP retrieval",
      e: mcp,
      type: "Recorded investigation",
      result: "One immutable abstract retrieved",
      text: "Hosted Otari invoked the authenticated, read-only publication MCP tool. The canonical abstract and its hash were stored before inference.",
      note: "Abstract-only coverage; this is not full-text retrieval.",
      artifact: "investigation",
      meta: technical([mcp], { "Source SHA-256": app.snapshots[0].hash, "Source scope": app.snapshots[0].scope }),
    },
    {
      id: "models",
      title: "Distinct extraction / review models",
      e: review,
      type: "Recorded investigation",
      result: "20B extraction · 120B independent review",
      text: `Observed extraction: ${extract.model}. Observed review: ${review.model}. Both roles executed through hosted Otari; direct Vertex was excluded.`,
      note: "The original reviewer supported both candidates. A later, separately attributed source-inspection hold withheld one; model agreement is not proof of support.",
      artifact: "investigation",
      meta: technical([extract, review], {
        "Observed fallback": String(extract.fallback === true || review.fallback === true),
      }),
    },
    {
      id: "sandbox",
      title: "Sandbox execution",
      e: sandbox,
      type: "Recorded investigation",
      result: `${app.audit.accepted} original records · ${app.audit.sources} source · ${app.audit.invalidIds.length} invalid references`,
      text: "Otari executed a fixed evidence-audit program. Its original nonempty result agreed with local validation.",
      note: "The later publication revision retains one finding and has a local one-record audit. The original hosted audit is preserved separately; it does not verify scientific accuracy.",
      artifact: "investigation",
      meta: technical([sandbox], {
        "Audit version": app.audit.version,
        "Audit program SHA-256": app.audit.programHash,
      }),
    },
    {
      id: "budget",
      title: "Hosted spending-limit refusal",
      e: denial,
      type: "Separate isolated check",
      result: "Finite $0.01 ceiling enforced",
      text: "Otari refused a priced request with budget_exceeded at workspace scope. Capela recorded terminal denial and blocked a subsequent dispatch before HTTP.",
      note: "One actual request, no provider bypass. This check is separate from the scientific investigation; an unknown-cost reservation remains retained.",
      artifact: "ceiling",
      meta: technical([denial], {
        "Budget scope": denial.budgetScope,
        "Actual HTTP requests": ceiling.actualHttpRequests,
        "Further dispatch blocked": String(ceiling.noSubsequentDispatch),
      }),
    },
    {
      id: "guardrail",
      title: "Directly verified guardrail refusal",
      e: guard,
      type: "Separate isolated check",
      result: "Evaluated blocking verdict · same response",
      text: "A synthetic injection test through Capela’s production adapter returned HTTP 403, guardrail_violation and an evaluated blocking result for the expected guardrail, tied to the same Otari request ID.",
      note: "No manual vendor-log join is needed for this new result. No benign-input pass rate or prompt-only detector cause is claimed. The older inconclusive request remains unchanged.",
      artifact: "guardrail",
      meta: technical([guard], {
        "Verdict source": guard.guardrails.source,
        "Guardrail profile SHA-256": guard.guardrails.results[0].profileHash,
        "Validated status": guard.guardrails.results[0].status,
        Valid: String(guard.guardrails.results[0].valid),
        Mode: guard.guardrails.results[0].mode,
      }),
    },
  ];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Capela · demonstration evidence</title><meta name="description" content="Six recorded Otari capabilities, with real outcomes and original verification artifacts."><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#10150f;color:#edf1e4;font:18px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:32px 24px 64px}h1{font-size:clamp(2rem,5vw,3rem);line-height:1.15;letter-spacing:-.035em;margin:12px 0}h2{font-size:1.3rem;line-height:1.3;margin:12px 0}p{margin:12px 0}a{color:#d9edb4;text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:3px solid #f5d77e;outline-offset:5px}nav{display:flex;gap:10px 20px;flex-wrap:wrap;margin:20px 0}nav a{padding:6px 0}.notice{padding:16px 20px;border:1px solid #bda66c;background:#292516;border-radius:12px;margin:22px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.card{min-width:0;padding:24px;border:1px solid #53614a;border-radius:16px;background:#171d15;scroll-margin-top:20px}.badge{display:inline-block;padding:4px 10px;border-radius:6px;background:#263223;color:#d4e6c2;font-size:.85rem}.isolated{background:#332c1b;color:#f3dca6}.date{display:block;color:#bbc7b2;font-size:.9rem;margin-top:8px}.result{font-size:1.12rem;font-weight:650;color:#e2efca}.note{color:#c0caba;font-size:.94rem}.artifact{display:inline-block;margin:8px 0;font-weight:600}details{margin-top:14px;border-top:1px solid #3c4937;padding-top:12px}summary{cursor:pointer;font-size:.92rem}dl{font-size:.82rem}dt{color:#bbc7b2;margin-top:12px}dd{margin:3px 0;font-family:ui-monospace,monospace;overflow-wrap:anywhere}footer{margin-top:28px;font-size:.92rem;color:#c0caba}footer a{display:inline-block;margin-right:18px}@media(max-width:720px){main{padding:24px 16px}.grid{grid-template-columns:1fr}.card{padding:20px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}@media print{body{background:white;color:black}.card{background:white;break-inside:avoid}.result,.note,.date,a{color:black}.grid{display:block}.card{margin:16px 0}}
  </style></head><body><main><header><p>Capela · read-only recorded evidence</p><h1>Six Otari capabilities, with inspectable results</h1><p>Four capabilities come from the completed 6 November investigation. Spending limits and guardrails were verified in separate isolated application-adapter checks. This page presents saved results; it does not execute research.</p><nav aria-label="Demonstration pages"><a href="/samples/curcumin-2026-11-06.html">Open recorded curcumin findings</a><a href="/dashboard/investigations">Open authenticated investigation history</a></nav></header><aside class="notice"><strong>Publication state: one published finding, one unresolved candidate.</strong><p>The original models supported two candidates. Later source inspection withheld unsupported wording with separate provenance. Abstract-only coverage and model-assisted review remain limitations. No scientific accuracy or awarded-score claim.</p></aside><nav aria-label="Evidence sections">${cards.map((c) => `<a href="#${c.id}">${escape(c.title)}</a>`).join("")}</nav><div class="grid">${cards.map((c) => `<section class="card" id="${c.id}" aria-labelledby="${c.id}-title"><span class="badge ${c.artifact !== "investigation" ? "isolated" : ""}">${escape(c.type)}</span><time class="date" datetime="${escape(c.e.at)}">Recorded ${escape(date(c.e))} · UTC</time><h2 id="${c.id}-title">${escape(c.title)}</h2><p class="result">${escape(c.result)}</p><p>${escape(c.text)}</p><p class="note">${escape(c.note)}</p><a class="artifact" href="${original(c.artifact)}" target="_blank" rel="noopener noreferrer">Open original ${c.artifact === "investigation" ? "investigation" : c.artifact === "ceiling" ? "spending-limit" : "guardrail"} artifact ↗</a>${c.meta}</section>`).join("")}</div><footer><p>All dates and request results are taken from the original artifacts. Identifiers are expandable; keys, account identifiers, raw vendor payloads and personal data are excluded. No live execution is simulated.</p><p>Routing policy selection also executed, but successful fallback recovery and per-user budgets remain unverified. The six selected categories above do not depend on those claims.</p><a href="https://github.com/samscript18/capela/tree/feat/otari-completion-verification" target="_blank" rel="noopener noreferrer">Hackathon branch</a><a href="/samples/curcumin-2026-11-06.html">Recorded findings and source passages</a></footer></main></body></html>`;
  return {
    html,
    manifest: {
      version: "demo-evidence-page-v1",
      artifactCommit: ARTIFACT_COMMIT,
      sources: Object.fromEntries(
        Object.values(files).map((p) => [p, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]),
      ),
      sections: cards.map((c) => ({
        id: c.id,
        date: c.e.at,
        scope: c.type,
        artifact: files[c.artifact],
        requestId: c.e.requestId,
      })),
    },
  };
}
if (require.main === module)
  (async () => {
    const { html, manifest } = build();
    const prettier = require("prettier");
    const output = "apps/web/public/samples/demonstration-evidence.html";
    fs.writeFileSync(
      output,
      await prettier.format(html, { ...(await prettier.resolveConfig(output)), parser: "html" }),
    );
    fs.writeFileSync("evaluation/demo-evidence-page.json", JSON.stringify(manifest, null, 2) + "\n");
    console.log("Offline demonstration page generated from three original artifacts; no requests sent.");
  })().catch(() => {
    console.error("Recorded demonstration prerequisites failed; page not verified.");
    process.exitCode = 1;
  });
module.exports = { build };
