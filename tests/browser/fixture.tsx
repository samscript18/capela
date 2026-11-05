import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ResearchRunView } from "../../apps/web/src/components/research-run-view";
import { evidenceStageLabel } from "../../apps/web/src/lib/investigation-record";
import type { ResearchRun } from "@capela/shared";

const text = "In this synthetic browser fixture, a marker did not change in mice.";
const source = {
  id: "fixture-source",
  paperId: "12345",
  hash: "a".repeat(64),
  text,
  canonicalUrl: "https://pubmed.ncbi.nlm.nih.gov/12345/",
  retrievedAt: "2026-11-03T00:00:00.000Z",
  scope: "abstract",
  mime: "text/plain",
  sourceKind: "canonical-publication-metadata",
  normalization: "NFC-LF-v1",
  parserVersion: "publication-abstract-v1",
  truncated: false,
  coverage: "abstract-only",
} as const;
const span = {
  blockId: "abstract",
  quote: text,
  start: 0,
  end: text.length,
  convention: "utf16-zero-based-end-exclusive",
} as const;
const candidate = {
  id: "fixture-claim",
  paperId: "12345",
  snapshotId: source.id,
  snapshotHash: source.hash,
  analyzedSource: "abstract",
  finding: "The marker changed in mice.",
  proposedClass: "indirect_experimental",
  kind: "activity",
  studyType: "experimental_in_vivo",
  model: "mice",
  measuredOutcome: "marker",
  label: "marker",
  relationship: null,
  spans: [span],
} as const;
const run: ResearchRun = {
  version: "otari-evidence-v1",
  runId: "browser-fixture-only",
  snapshots: [source],
  decisions: [
    {
      candidate: { ...candidate, spans: [span] },
      status: "rejected",
      reason: "Finding drops source negation.",
      review: {
        claimId: candidate.id,
        verdict: "contradicted",
        reason: "Source says did not change.",
        evidenceType: "indirect_experimental",
        revisedFinding: null,
        spans: [span],
        checks: { molecule: true, negation: false, studyContext: true, directness: true, sourceLimitations: true },
      },
    },
  ],
  models: { extraction: "fixture-model-a", review: "fixture-model-b", distinct: true },
  budget: {
    currency: "USD",
    capMicrousd: 50000,
    reservedMicrousd: 10000,
    reportedMicrousd: 50,
    unknownCostCalls: 1,
    calls: 2,
    maxCalls: 16,
    terminal: false,
  },
  events: [
    {
      sequence: 1,
      at: "2026-11-03T00:00:00.000Z",
      operation: "review",
      status: "completed",
      correlationId: "fixture-correlation",
    },
  ],
  limitations: ["Synthetic browser fixture. No paid provider or scientific result."],
};
function App() {
  const [mode, setMode] = useState("Completed");
  const scenarioRun: ResearchRun | undefined =
    mode === "Legacy"
      ? undefined
      : {
          ...run,
          events:
            mode === "Hybrid"
              ? [
                  ...run.events,
                  {
                    sequence: 2,
                    at: "2026-11-05T00:00:00.000Z",
                    operation: "vertex_review",
                    status: "completed",
                    correlationId: "synthetic-vertex",
                    provider: "vertex-ai",
                    requestId: "synthetic-vertex-response",
                    finishReason: "STOP",
                    outputTokens: 123,
                    thoughtTokens: 17,
                    claimIds: ["fixture-claim"],
                    model: "synthetic-vertex-reviewer",
                    fallback: true,
                  },
                ]
              : run.events,
          budget: { ...run.budget, terminal: mode === "Budget denied" },
        };
  return (
    <main>
      <h1>Capela isolated browser checks</h1>
      <p role="note">
        Synthetic fixture only. These controls are outside the production application and bypass no authentication.
      </p>
      <p data-testid="evidence-phase">{evidenceStageLabel(scenarioRun)}</p>
      <nav aria-label="Test scenarios">
        {["Completed", "Partial", "Budget denied", "Provider error", "Legacy", "History", "Hybrid"].map((m) => (
          <button key={m} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
      </nav>
      {mode === "History" ? (
        <section>
          <h2>Fixture history</h2>
          <button onClick={() => setMode("Completed")}>Reopen stored fixture</button>
        </section>
      ) : (
        <>
          {mode === "Budget denied" && (
            <p role="alert">Otari denied spending. No provider bypass or automatic retry is allowed.</p>
          )}
          {mode === "Provider error" && <p role="alert">Provider unavailable. Saved work is partial.</p>}
          <ResearchRunView run={scenarioRun} partial={["Partial", "Budget denied", "Provider error"].includes(mode)} />
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
