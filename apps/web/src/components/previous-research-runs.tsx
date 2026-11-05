import type { ApiInvestigation } from "@/lib/investigation-record";
import { ResearchRunView } from "./research-run-view";

export function PreviousResearchRuns({ attempts }: { attempts: ApiInvestigation["previousResearchRuns"] }) {
  if (!attempts?.length) return null;
  return (
    <details className="mt-6 rounded-2xl border border-white/10 p-5">
      <summary className="cursor-pointer text-sm">Previous failed attempts ({attempts.length})</summary>
      <p className="mt-3 text-xs leading-6 text-[#a9b0a4]">
        These attempts remain partial. The current allowance includes their charges and uncertain reservations.
      </p>
      {attempts.map((attempt, i) => (
        <details key={`${attempt.research.runId}-${i}`} className="mt-4">
          <summary className="cursor-pointer text-xs">
            Attempt {i + 1} · {attempt.error?.code ?? "Interrupted"}
          </summary>
          {attempt.error && <p className="my-3 text-xs text-[#a9b0a4]">{attempt.error.message}</p>}
          <ResearchRunView run={attempt.research} partial />
        </details>
      ))}
    </details>
  );
}
