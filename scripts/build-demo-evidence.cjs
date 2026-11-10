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
    return `<details><summary>Technical details <span aria-hidden="true">+</span></summary><dl>${rows.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("")}</dl></details>`;
  };
  const cards = [
    {
      id: "search",
      title: "Hosted search",
      e: search,
      type: "Recorded investigation",
      result: "A research source was found",
      text: "Otari searched for scientific literature about curcumin. A selected publication became the source for this investigation.",
      note: "This source was used in the next steps—not added as a decorative citation.",
      artifact: "investigation",
      meta: technical([search], { "Search tool call": search.toolCallId, "Canonical publication": "PubMed 32141677" }),
    },
    {
      id: "mcp",
      title: "MCP retrieval",
      e: mcp,
      type: "Recorded investigation",
      result: "The source was saved before AI analysis",
      text: "Otari used a protected research tool to retrieve the publication’s abstract. Capela saved an unchanged copy before either model read it.",
      note: "MCP connects Otari to this research tool. Only the abstract was analyzed, not the full paper.",
      artifact: "investigation",
      meta: technical([mcp], { "Source SHA-256": app.snapshots[0].hash, "Source scope": app.snapshots[0].scope }),
    },
    {
      id: "models",
      title: "Distinct extraction / review models",
      e: review,
      type: "Recorded investigation",
      result: "One model extracts. Another reviews.",
      text: `One open-weight model turned the abstract into structured findings. A different model reviewed those findings against the same source. Both ran through hosted Otari.`,
      note: `Extraction: ${extract.model}. Review: ${review.model}. The reviewer missed an unsupported clause; the later publication hold is shown separately.`,
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
      result: `${app.audit.accepted} original records checked against ${app.audit.sources} source`,
      text: "Otari ran a small audit program to check that the original findings pointed to real stored passages. Its result matched Capela’s own checks.",
      note: "These checks verify references, not scientific truth. The later one-finding revision was checked locally; the original hosted audit remains unchanged.",
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
      result: "A one-cent spending limit stopped the request",
      text: "In a separate test workspace, Otari refused a request that exceeded its $0.01 limit. Capela then prevented another request from being sent.",
      note: "No account balance was drained and no alternate provider was used to get around the refusal. Uncertain costs remain reserved.",
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
      result: "The guardrail evaluated and blocked the test",
      text: "A deliberately planted instruction tried to override the research task. Otari returned a blocking guardrail verdict and the matching request identifier together.",
      note: "This was a separate synthetic safety test, not a research finding. It does not measure how often safe inputs are blocked, or isolate which detector caused the refusal.",
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
  // Derive the static mark from the same canonical BrandMark used by the application.
  const brandSource = fs.readFileSync("apps/web/src/components/brand.tsx", "utf8");
  const brandSvg = brandSource.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
  if (!brandSvg || brandSvg.includes("{")) throw Error("Canonical brand SVG needs an explicit static export");
  const mark = brandSvg
    .replace('className="size-6"', 'class="brand-symbol"')
    .replaceAll("strokeWidth=", "stroke-width=")
    .replaceAll("strokeOpacity=", "stroke-opacity=");
  const brand = `<a class="brand" href="/" aria-label="Capela home"><span class="brand-mark">${mark}</span><span class="brand-copy"><span class="brand-wordmark">Capela<span class="brand-degree">°</span></span><span class="brand-tagline">Scientific intelligence</span></span></a>`;
  const names = {
    search: "Find the research",
    mcp: "Bring in the source",
    models: "Read it, then review it",
    sandbox: "Check the evidence trail",
    budget: "Respect the spending limit",
    guardrail: "Stop unwanted instructions",
  };
  const glyphs = { search: "⌕", mcp: "↙", models: "⇄", sandbox: "✓", budget: "$", guardrail: "◇" };
  const renderCard = (c, i) =>
    `<section class="card" id="${c.id}" aria-labelledby="${c.id}-title"><div class="card-top"><span class="icon" aria-hidden="true">${glyphs[c.id]}</span><span class="step">${String(i + 1).padStart(2, "0")}</span></div><p class="feature">${escape(c.title)}</p><h3 id="${c.id}-title">${names[c.id]}</h3><p class="result"><span aria-hidden="true">✓</span> ${escape(c.result)}</p><p class="description">${escape(c.text)}</p><p class="note">${escape(c.note)}</p><div class="card-bottom"><time datetime="${escape(c.e.at)}">${escape(date(c.e))} · UTC</time><a class="artifact" href="${original(c.artifact)}" aria-label="See original record for ${escape(c.title)}" target="_blank" rel="noopener noreferrer">See original record <span aria-hidden="true">↗</span></a></div>${c.meta}</section>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capela · research you can trace</title><meta name="description" content="A plain-language tour of six recorded Otari capabilities in Capela, with links to the real evidence."><style>
  :root{color-scheme:light;--ink:#20332b;--muted:#56645c;--green:#356348;--paper:#f5f5ef;--line:#d9dfd3}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.65 system-ui,-apple-system,sans-serif}a{color:inherit;text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:3px solid #b78025;outline-offset:5px}a:hover{text-decoration-thickness:2px}.wrap{width:min(1120px,100% - 48px);margin:auto}.masthead{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 0}.brand{display:inline-flex;align-items:center;gap:12px;text-decoration:none}.brand-mark{display:grid;place-items:center;width:40px;height:40px;flex-shrink:0;overflow:hidden;border-radius:16px;border:1px solid #9fad7c33;background:linear-gradient(135deg,#293323,#14241c);color:#9fad7c;box-shadow:0 10px 32px #8ec5401f}.brand-symbol{width:24px;height:24px}.brand-copy{display:flex;flex-direction:column;line-height:1}.brand-wordmark{font-size:17px;font-weight:700;letter-spacing:-.04em;color:var(--ink)}.brand-degree{color:#a7b587}.brand-tagline{font-size:10px;font-weight:500;letter-spacing:0;color:var(--muted);margin-top:6px}.recorded{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:8px}.recorded:before{content:"";width:7px;height:7px;border:2px solid #6d815d;border-radius:50%}.hero{background:#1c3328;color:#f4f4e9;border-radius:28px;padding:48px;display:grid;grid-template-columns:1.5fr 1fr;gap:48px;align-items:center;background-image:radial-gradient(ellipse at 80% 0%,#455c3b70,transparent 65%)}.eyebrow,.feature{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin:0 0 14px}.hero .eyebrow{color:#c5d7b0}h1{font-size:clamp(38px,5.4vw,62px);line-height:1.04;letter-spacing:-.055em;margin:0 0 22px;font-weight:650}.hero .lede{color:#d3ded0;max-width:40ch;margin:0;font-size:18px}.case{border:1px solid #a4bc8b50;background:#ffffff06;border-radius:18px;padding:25px}.case .eyebrow{font-size:11px}.case h2{font-size:32px;letter-spacing:-.04em;margin:0 0 4px}.case p{font-size:15px;color:#d3ded0;margin:0 0 20px}.case-numbers{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #ffffff20;padding-top:18px;gap:14px;margin-bottom:22px}.case-numbers strong{font-size:35px;line-height:1.15;display:block;font-weight:550}.case-numbers span{font-size:13px;color:#d3ded0}.case-numbers .held strong{color:#e3c58b}.primary{display:inline-flex;align-items:center;justify-content:space-between;gap:25px;padding:11px 16px;background:#d9e7bc;color:#1c3328;border-radius:9px;text-decoration:none;font-size:14px;font-weight:700;width:100%}.orientation{display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:26px 4px;border-bottom:1px solid var(--line)}.orientation p{font-size:15px;line-height:1.6;color:var(--muted);margin:4px 0}.orientation strong{font-size:16px}.pill{display:inline-block;border:1px solid #cdd9c3;border-radius:30px;padding:3px 9px;color:#3f5c40;font-size:12px;font-weight:650;margin-right:7px}.pill.test{border-color:#ddd0b5;color:#765d30}.quicklinks{display:flex;flex-wrap:wrap;gap:10px 22px;padding:20px 0;font-size:14px;color:var(--muted)}.group-heading{display:flex;gap:18px;align-items:baseline;margin:28px 0 20px}.group-number{font-size:12px;font-weight:700;letter-spacing:.1em;color:#6a7d5c}.group-heading h2{font-size:28px;line-height:1.2;letter-spacing:-.035em;margin:0}.group-intro{margin:-10px 0 24px;font-size:16px;color:var(--muted);max-width:76ch}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px;box-shadow:0 5px 18px #26372404;min-width:0;scroll-margin-top:22px;display:flex;flex-direction:column}.card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:23px}.icon{display:grid;place-items:center;height:42px;width:42px;border-radius:12px;background:#edf2e7;color:#41623d;font-size:28px;line-height:1}.step{font-size:12px;color:#798777;font-family:ui-monospace,monospace}.feature{font-size:12px;color:#617258;letter-spacing:.1em;margin-bottom:8px}h3{font-size:25px;letter-spacing:-.035em;line-height:1.2;margin:0 0 16px}.result{color:#356348;background:#f0f5eb;padding:10px 12px;border-radius:8px;font-size:14px;font-weight:650;line-height:1.5;margin:0 0 16px}.result span{margin-right:5px}.description{font-size:17px;line-height:1.65;margin:0 0 14px}.note{font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 22px;overflow-wrap:anywhere}.card-bottom{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:12px;color:#65735f}.artifact{font-size:13px;font-weight:650;color:#345b3d;text-decoration:none}.artifact:hover{text-decoration:underline}details{border-top:1px solid #e7ebe1;margin-top:18px;padding-top:12px}summary{cursor:pointer;font-size:12px;font-weight:600;color:#64715d;list-style:none;display:flex;justify-content:space-between;align-items:center;min-height:32px}summary::-webkit-details-marker{display:none}summary span{font-size:20px;font-weight:400}details[open] summary span{transform:rotate(45deg)}dl{font-size:12px;margin:12px 0 0}dt{font-weight:650;margin-top:12px}dd{margin:4px 0;color:var(--muted);font-family:ui-monospace,monospace;overflow-wrap:anywhere}.tests .icon{background:#f7f0e2;color:#8b6a2b}.tests .feature{color:#806b45}.tests .result{background:#f8f4eb;color:#735b2b}.honesty{margin:34px 0 28px;display:grid;grid-template-columns:1fr 2fr;gap:28px;padding:26px 28px;border-radius:16px;background:#e9eee2;border:1px solid #d5deca}.honesty h2{font-size:21px;line-height:1.3;letter-spacing:-.025em;margin:0}.honesty p{font-size:15px;margin:0;color:#4b5c49}.honesty a{font-weight:600}footer{padding:20px 0 40px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;align-items:flex-start}footer p{font-size:14px;color:var(--muted);margin:0;max-width:65ch}footer a{font-size:13px;white-space:nowrap}@media(max-width:760px){.wrap{width:calc(100% - 32px)}.masthead{padding:18px 0}.recorded{font-size:10px}.hero{grid-template-columns:1fr;padding:28px;gap:28px;border-radius:20px}.hero .lede{font-size:17px}.case h2{font-size:28px}.orientation{grid-template-columns:1fr;gap:15px;padding:22px 0}.grid{grid-template-columns:1fr}.card{padding:24px}.group-heading h2{font-size:25px}.honesty{grid-template-columns:1fr;gap:12px;padding:24px}.quicklinks{font-size:13px;gap:10px 18px}footer{flex-direction:column}.card-bottom{font-size:12px}.group-heading{margin-top:24px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}@media print{.hero{background:#1c3328!important;print-color-adjust:exact}.card{break-inside:avoid;box-shadow:none}.grid{display:block}.card{margin-bottom:16px}.masthead,.quicklinks{display:none}}
  </style></head><body><main class="wrap"><div class="masthead">${brand}<span class="recorded">Recorded demonstration · no live research</span></div><header class="hero"><div><p class="eyebrow">Built with hosted Otari</p><h1>Research you<br>can trace.</h1><p class="lede">Follow a finding from a scientific source to a saved dossier. Then see the separate tests that checked spending and safety.</p></div><aside class="case" aria-label="Recorded curcumin result"><p class="eyebrow">The real case · 6 November 2026</p><h2>Curcumin</h2><p>One published review abstract.<br>Model-assisted analysis, with uncertainty visible.</p><div class="case-numbers"><div><strong>1</strong><span>published finding</span></div><div class="held"><strong>1</strong><span>candidate withheld</span></div></div><a class="primary" href="/samples/curcumin-2026-11-06.html">Explore the recorded findings <span aria-hidden="true">↗</span></a></aside></header><div class="orientation"><div><strong><span class="pill">The investigation</span> Four connected steps</strong><p>Search, source retrieval, two model roles and an evidence audit were used in the completed curcumin investigation.</p></div><div><strong><span class="pill test">Separate tests</span> Two protective limits</strong><p>Spending and guardrails were checked separately through Capela’s Otari adapter. All six were not exercised in one run.</p></div></div><nav class="quicklinks" aria-label="Evidence sections">${cards.map((c) => `<a href="#${c.id}">${escape(c.title)}</a>`).join("")}</nav><div class="group-heading"><span class="group-number">01 / RESEARCH</span><h2>Follow the evidence.</h2></div><p class="group-intro">Recorded on 6 November 2026. Every step below has an original record you can inspect.</p><div class="grid">${cards.slice(0, 4).map(renderCard).join("")}</div><div class="group-heading"><span class="group-number">02 / PROTECTION</span><h2>Make the limits real.</h2></div><p class="group-intro">Separate, bounded tests—not simulated actions or settings enabled only for a screenshot.</p><div class="grid tests">${cards
    .slice(4)
    .map((c, i) => renderCard(c, i + 4))
    .join(
      "",
    )}</div><aside class="honesty"><h2>A useful result includes<br>what was withheld.</h2><p>The original reviewer supported two candidates. Later source inspection found unsupported wording in one, so a separately recorded publication hold withheld it. The original model output is preserved. <a href="/samples/curcumin-2026-11-06.html">See the finding and the unresolved candidate.</a></p></aside><footer><p>Read-only records, not live execution. Only abstracts were analyzed; model review and reference checks do not establish scientific accuracy. Successful fallback recovery and per-user budgets remain unverified. No awarded score is claimed. Dates use UTC; request identifiers are under Technical details. No credentials or account information are included.</p><a href="https://github.com/samscript18/capela/tree/feat/otari-completion-verification" target="_blank" rel="noopener noreferrer">View the hackathon branch ↗</a></footer></main></body></html>`;
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
