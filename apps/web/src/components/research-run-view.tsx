"use client";

import type { ResearchRun } from "@capela/shared";

const usd = (n: number) => `$${(n / 1000000).toFixed(6)} USD`;
function sourceLink(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" &&
      ["pubmed.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov", "europepmc.org"].includes(u.hostname)
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function ResearchRunView({ run, partial = false }: { run?: ResearchRun; partial?: boolean }) {
  if (!run)
    return (
      <p className="rounded-2xl border border-white/10 p-5 text-xs leading-6 text-[#a9b0a4]">
        Legacy dossier · passage verification and independent model review were not performed. Evidence grades are
        heuristics, not efficacy probabilities.
      </p>
    );
  const counts = { accepted: 0, revised: 0, rejected: 0, unresolved: 0 };
  run.decisions.forEach((d) => {
    counts[d.status] += 1;
  });
  return (
    <section aria-label="Source and review inspection" className="premium-surface space-y-6 p-5 sm:p-7">
      <div>
        <span className="eyebrow">Source and review inspection</span>
        <h2 className="mt-3 text-2xl">{partial ? "Partial research record" : "Evidence with its review trail"}</h2>
        <p className="mt-3 text-xs leading-6 text-[#a9b0a4]">
          {run.snapshots.length} stored abstracts · no full-text analysis. Reviews are model-assisted assessments; exact
          quotes establish passage validity, not scientific truth.
        </p>
      </div>
      {run.discovery && (
        <details className="rounded-xl border border-white/10 p-4 text-xs leading-6">
          <summary className="cursor-pointer">{run.discovery.urls.length} canonical publications discovered</summary>
          <p className="mt-3 text-[#a9b0a4]">
            Search results are discovery records. Only retrieved abstracts can support findings.
          </p>
          <ul className="mt-3 space-y-2">
            {run.discovery.urls.map((url) => (
              <li key={url}>
                <a className="break-all underline" href={sourceLink(url)} target="_blank" rel="noreferrer">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {run.events.some((event) => event.provider === "vertex-ai") && (
        <p role="status" className="rounded-xl border border-[#f2d66b]/30 p-4 text-xs leading-6 text-[#f2d66b]">
          Hybrid investigation: direct Vertex AI review with Otari research tooling. Vertex is billed by Google; Otari
          credits and hosted limits do not cover that call. This review ran outside Otari.
        </p>
      )}
      {partial && (
        <p role="status" className="rounded-xl border border-[#f2d66b]/30 p-4 text-xs text-[#f2d66b]">
          This investigation stopped before completion. Saved candidates are not a completed dossier.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(counts).map(([label, count]) => (
          <div key={label} className="soft-surface p-4">
            <dt className="text-xs capitalize text-[#a9b0a4]">{label}</dt>
            <dd className="mt-2 text-2xl">{count}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid gap-3 text-xs leading-6 sm:grid-cols-2">
        <div>
          <dt className="text-[#a9b0a4]">Extraction model observed</dt>
          <dd className="break-all">{run.models.extraction ?? "Not observed"}</dd>
        </div>
        <div>
          <dt className="text-[#a9b0a4]">Review model observed</dt>
          <dd className="break-all">{run.models.review ?? "Not observed"}</dd>
        </div>
        <div>
          <dt className="text-[#a9b0a4]">Application allowance</dt>
          <dd>
            {usd(run.budget.capMicrousd)} · {run.budget.calls}/{run.budget.maxCalls} dispatches
          </dd>
        </div>
        <div>
          <dt className="text-[#a9b0a4]">Reported settled / estimated reserved</dt>
          <dd>
            {usd(run.budget.reportedMicrousd)} / {usd(run.budget.reservedMicrousd)}
          </dd>
        </div>
      </dl>
      <p className="text-xs leading-6 text-[#a9b0a4]">
        {run.models.distinct
          ? "Two different resolved model IDs observed."
          : "Two different resolved model IDs have not been established."}{" "}
        {run.budget.unknownCostCalls} dispatches have unreported or uncertain costs.{" "}
        {run.budget.terminal
          ? "Spending stopped; no automatic bypass."
          : "Hosted ceiling is configured separately from estimated application reservations."}
      </p>
      {run.audit && (
        <p className="rounded-xl border border-white/10 p-4 text-xs leading-6">
          Evidence audit: {run.audit.valid ? "reference and span checks agree" : "publication blocked"} ·{" "}
          {run.audit.accepted} claims / {run.audit.sources} sources ·{" "}
          {run.audit.remote ? "hosted sandbox result compared locally" : "local check only"}
        </p>
      )}
      {run.decisions.length === 0 && (
        <p className="text-xs text-[#a9b0a4]">No candidate findings have been recorded.</p>
      )}
      <div className="space-y-3">
        {run.decisions.map((d) => {
          const source = run.snapshots.find((s) => s.id === d.candidate.snapshotId);
          return (
            <details key={d.candidate.id} className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
              <summary className="cursor-pointer text-sm leading-6">
                <span className="mr-2 rounded-full border border-[#9fad7c]/30 px-2 py-1 text-[10px] capitalize text-[#c8d1aa]">
                  {d.status}
                </span>
                {d.publishedFinding ?? d.candidate.finding}
              </summary>
              <div className="mt-5 space-y-4 text-xs leading-6">
                <p>
                  <span className="text-[#a9b0a4]">Original finding: </span>
                  {d.candidate.finding}
                </p>
                <p className="text-[#a9b0a4]">
                  Original class: {d.candidate.proposedClass.replaceAll("_", " ")} ·{" "}
                  {d.candidate.studyType.replaceAll("_", " ")} · {d.candidate.model ?? "Study model not specified"}
                </p>
                {d.candidate.measuredOutcome && <p>Measured outcome: {d.candidate.measuredOutcome}</p>}
                <p>
                  <span className="text-[#a9b0a4]">Review verdict: </span>
                  {d.review?.verdict ?? "Not reviewed"} · {d.reason}
                </p>
                {d.status === "revised" && (
                  <p className="text-[#c8d1aa]">
                    Published correction: {d.publishedFinding} · {d.publishedClass?.replaceAll("_", " ")}
                  </p>
                )}
                <p className="text-[#a9b0a4]">Candidate supporting passages</p>
                {d.candidate.spans.map((s, i) => (
                  <figure key={i} className="border-l-2 border-[#9fad7c]/40 pl-4">
                    <blockquote className="whitespace-pre-wrap text-[#dce4ef]">{s.quote}</blockquote>
                    <figcaption className="mt-2 text-[10px] text-[#a9b0a4]">
                      Abstract · UTF-16 [{s.start}, {s.end})
                    </figcaption>
                  </figure>
                ))}
                {d.review && (
                  <div>
                    <p className="text-[#a9b0a4]">Reviewer supporting passages</p>
                    {d.review.spans.map((s, i) => (
                      <blockquote key={i} className="mt-2 whitespace-pre-wrap border-l border-white/20 pl-4">
                        {s.quote}
                      </blockquote>
                    ))}
                  </div>
                )}
                {source && (
                  <div className="break-all border-t border-white/10 pt-4 text-[10px] text-[#a9b0a4]">
                    <a
                      className="text-[#c8d1aa] underline"
                      href={sourceLink(source.canonicalUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open canonical publication
                    </a>
                    <p>
                      Retrieved {source.retrievedAt} · {source.truncated ? "truncated abstract" : "stored abstract"}
                    </p>
                    <p>
                      Snapshot {source.id} · SHA-256 {source.hash}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer">Inspect stored normalized abstract</summary>
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-6">{source.text}</pre>
                    </details>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
      <ul className="space-y-2 text-xs leading-6 text-[#a9b0a4]">
        {run.limitations.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <details className="border-t border-white/10 pt-4">
        <summary className="cursor-pointer text-xs text-[#c8d1aa]">Technical run view</summary>
        <p className="mt-4 break-all text-[10px] text-[#a9b0a4]">
          Run {run.runId} · {run.version} · checkpoint {run.checkpoint ?? "none"}
        </p>
        <ol className="mt-4 space-y-3">
          {run.events.map((e) => (
            <li key={e.sequence} className="break-all rounded-xl bg-black/20 p-3 text-[10px] leading-5 text-[#a9b0a4]">
              #{e.sequence} {e.at} · {e.operation} · {e.status}
              <br />
              Correlation {e.correlationId}
              {e.requestId && (
                <>
                  {" "}
                  · {e.provider === "vertex-ai" ? "Vertex response" : "Otari request"} {e.requestId}
                </>
              )}
              {e.model && (
                <>
                  {" "}
                  · {e.provider}:{e.model}
                </>
              )}
              {e.fallback === true && <> · fallback observed</>}
              {e.httpStatus && <> · HTTP {e.httpStatus}</>}
              {e.upstreamCode && <> · {e.upstreamCode}</>}
              {e.toolCallId && <> · tool {e.toolCallId}</>}
              {e.code && <> · {e.code}</>}
              {e.finishReason && <> · finish {e.finishReason}</>}
              {e.blockReason && <> · block {e.blockReason}</>}
              {e.outputCharacters !== undefined && <> · {e.outputCharacters} response characters</>}
              {e.outputTokens !== undefined && <> · {e.outputTokens} output tokens</>}
              {e.thoughtTokens !== undefined && <> · {e.thoughtTokens} thinking tokens</>}
              {e.claimIds?.length ? <> · claims {e.claimIds.join(", ")}</> : null}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
