// Offline export for the recorded November 6 Curcumin sample. Whitelist scientific/provenance fields.
require("reflect-metadata");
const fs = require("node:fs");
const path = require("node:path");
const { parseStoredResearchRun } = require("@capela/shared");
const { referenceValid, scientificUrl, spansValid } = require("../apps/api/dist/research/provenance");
const { indexedSource } = require("../apps/api/dist/research/passage-references");
function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw Error("Usage: node scripts/export-recorded-sample.cjs <private-record.json> <sample.html>");
  const record = JSON.parse(fs.readFileSync(input));
  const run = parseStoredResearchRun(record.research);
  if (
    record.status !== "completed" ||
    !record.dossier ||
    !run.models.distinct ||
    !run.audit?.valid ||
    !run.audit.remote ||
    run.events.some((e) => e.operation === "vertex_review") ||
    !record.evidence?.length
  )
    throw Error("A nonempty completed hosted-only recorded investigation is required.");
  run.snapshots.forEach(indexedSource);
  for (const d of run.decisions) {
    const s = run.snapshots.find((s) => s.id === d.candidate.snapshotId);
    if (!referenceValid(d.candidate, run.snapshots) || (d.review && !spansValid(d.review.spans, s)))
      throw Error("Invalid recorded references or passages.");
  }
  if (
    record.molecule.preferredName.toLowerCase() !== "curcumin" ||
    run.snapshots.length !== 1 ||
    run.snapshots[0].paperId !== "32141677" ||
    !run.decisions.some(
      (d) =>
        d.candidate.id === "32141677-claim-2" &&
        d.candidate.finding.includes("key regulator of inflammation and cell survival"),
    )
  )
    throw Error("This exporter is pinned to the recorded Curcumin case and its observed limitation.");
  const sample = {
    label: "Recorded investigation — read-only sample",
    recordedAt: record.completedAt,
    molecule: { name: record.molecule.preferredName, pubchemCid: record.molecule.pubchemCid },
    codeCommit: "5d52208d63af74ac3942dd65e7035cc025dc7123",
    inferenceContract: run.inferenceContract,
    models: run.models,
    scope: "One review abstract; no full-text or clinical validation.",
    decisions: run.decisions,
    audit: run.audit,
    sources: run.snapshots.map((s) => ({
      id: s.id,
      paperId: s.paperId,
      url: scientificUrl(s.canonicalUrl),
      hash: s.hash,
      retrievedAt: s.retrievedAt,
      scope: s.scope,
      normalization: s.normalization,
      passageIndexVersion: s.passageIndex?.version,
      passageIndexHash: s.passageIndex?.hash,
    })),
    budget: run.budget,
    events: run.events.map((e) => ({
      operation: e.operation,
      status: e.status,
      requestId: e.requestId,
      toolCallId: e.toolCallId,
      model: e.model,
      fallback: e.fallback,
    })),
    assessment: record.dossier.researchAssessment,
    inspectionNote: {
      author: "Assistant inspection, 2026-11-06; not expert annotation",
      claimId: "32141677-claim-2",
      concern:
        "The model-accepted claim adds ‘a key regulator of inflammation and cell survival’, which its selected passage does not state. Treat that added clause as unsupported by this passage. The original model verdict is retained rather than silently edited.",
    },
  };
  const e = (v) =>
    String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  const claims = sample.decisions
    .map((d) => {
      const s = sample.sources.find((s) => s.id === d.candidate.snapshotId);
      return `<article><h2>${e(d.status)} · ${e(d.publishedClass ?? d.candidate.proposedClass).replaceAll("_", " ")}</h2>
      <p>${e(d.publishedFinding ?? d.candidate.finding)}</p>
      <p>Study context: ${e(d.candidate.studyType)}. ${e(d.candidate.model ?? "Study model unspecified in the candidate.")}</p>
      ${d.candidate.id === sample.inspectionNote.claimId ? `<aside aria-label="Observed support limitation"><strong>Observed limitation</strong><p>${e(sample.inspectionNote.concern)}</p></aside>` : ""}
      <details open><summary>Exact supporting passage and original review</summary>
      ${(d.review?.spans ?? d.candidate.spans).map((p) => `<figure><blockquote>${e(p.quote)}</blockquote><figcaption>Abstract · UTF-16 [${p.start}, ${p.end})</figcaption></figure>`).join("")}
      <p>Reviewer: ${e(d.review?.verdict ?? "not reviewed")} — ${e(d.reason)}</p>
      <p>Original finding: ${e(d.candidate.finding)}</p>
      <p><a href="${e(s.url)}" rel="noreferrer">Canonical PubMed source ${e(s.paperId)}</a></p>
      <p class="technical">Snapshot SHA-256: ${e(s.hash)}<br>Passage IDs: ${e(d.review?.passageSelection?.passageIds.join(", ") ?? "not recorded")}</p></details></article>`;
    })
    .join("");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capela · recorded Curcumin investigation</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#10150f;color:#edf1e4;font:17px/1.65 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:32px 22px}h1{font-size:clamp(2rem,6vw,3.5rem);line-height:1.15}h2{font-size:1.25rem}a{color:#d5e9ad}a:focus-visible,summary:focus-visible{outline:3px solid #e9cd81;outline-offset:4px}article,aside,section{border:1px solid #6d7d5e;border-radius:16px;padding:22px;margin:24px 0}aside{background:#332b16;border-color:#dfbc6e}blockquote{margin:16px 0;border-left:3px solid #afc68d;padding:8px 20px}figcaption,.technical{font-size:.82rem;color:#c5cfbb}.technical{overflow-wrap:anywhere}summary{cursor:pointer;padding:8px 0}dt{font-weight:700}dd{margin:0 0 12px}li{margin:8px 0}@media print{body{background:white;color:black}a,.technical,figcaption{color:black}}
  </style><main><header><p>Capela · recorded investigation · November 6, 2026</p><h1>${e(sample.molecule.name)}</h1><p>This read-only sample comes from an actual completed signed-in local application run. It contains recorded model decisions, not a staged replay. No account identifiers or authenticated actions are included.</p></header>
  <aside><strong>Scope and limitations</strong><p>${e(sample.scope)} Findings are literature reported, not direct experiments or demonstrated human outcomes. Model-assisted review and valid passages do not prove scientific truth. The concrete support concern below remains visible.</p></aside>
  <section><h2>Recorded workflow</h2><dl><dt>Extraction</dt><dd>${e(sample.models.extraction)}</dd><dt>Independent review</dt><dd>${e(sample.models.review)}</dd><dt>Coverage</dt><dd>One canonical PubMed review abstract; ${sample.decisions.length} model-accepted findings. No correction or rejection was staged.</dd><dt>Sandbox audit</dt><dd>${sample.audit.accepted} exact reference/span records, ${sample.audit.sources} source; hosted result agreed with local validation. This audit checks mechanics, not entailment.</dd><dt>Reported / reserved cost</dt><dd>$${(sample.budget.reportedMicrousd / 1e6).toFixed(6)} / $${(sample.budget.reservedMicrousd / 1e6).toFixed(6)} USD. Reserved costs are unreported estimates.</dd></dl></section>
  ${claims}<section><h2>Assessment and gaps</h2><p>${e(sample.assessment.explanation)} Scores are heuristics, not efficacy probabilities.</p><ul>${sample.assessment.majorEvidenceGaps.map((g) => `<li>${e(g)}</li>`).join("")}</ul></section>
  <details><summary>Technical provenance</summary><p class="technical">Code commit: ${e(sample.codeCommit)}<br>Recorded completion: ${e(sample.recordedAt)}<br>Contract: ${e(sample.inferenceContract)}<br>Audit program hash: ${e(sample.audit.programHash)}</p><ul>${sample.events.map((v) => `<li class="technical">${e(v.operation)} · ${e(v.status)} · ${e(v.requestId ?? "no upstream ID returned")}</li>`).join("")}</ul></details>
  <footer><p>Static recorded sample. New research, private history and account actions require normal application authentication.</p></footer></main></html>`;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
  fs.writeFileSync(output.replace(/\.html$/, ".json"), JSON.stringify(sample, null, 2) + "\n");
  console.log("Sanitized recorded sample written. No provider request or authenticated mutation performed.");
}
if (require.main === module) main();
