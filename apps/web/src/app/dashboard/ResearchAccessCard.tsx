"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useAccess } from "@/lib/api";

export function ResearchAccessCard() {
  const access = useAccess();

  if (access.isPending) {
    return (
      <div aria-busy="true" className="min-h-32 animate-pulse rounded-3xl border border-white/[.05] bg-white/[.025]" />
    );
  }
  if (access.isError || !access.data) return null;

  const limit = Math.max(access.data.freeInvestigationsLimit, 1);
  const used = Math.min(access.data.freeInvestigationsUsedToday, limit);
  const progress = access.data.unlimitedInvestigations ? 100 : Math.round((used / limit) * 100);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[#c8d1aa]/10 bg-[radial-gradient(circle_at_0%_0%,rgba(159,173,124,.18),transparent_18rem),rgba(255,255,255,.02)] p-5"
      aria-label="Current research access"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#9fad7c]/10 text-[#c8d1aa]">
          <FlaskConical aria-hidden="true" size={21} />
        </span>
        <div className="min-w-0">
          <small className="text-[9px] font-semibold tracking-[.12em] text-[#b8c493] uppercase">Current access</small>
          <h2 className="m-0 truncate text-xl font-semibold">
            {access.data.unlimitedInvestigations ? "Free preview" : "Daily research access"}
          </h2>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-1.5 text-[10px] text-white/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span>
          {access.data.unlimitedInvestigations ? "Investigations remain free" : `${used} of ${limit} used today`}
        </span>
        <span>
          {access.data.freeInvestigationAvailable ? "Ready for a new molecule" : "One investigation is active"}
        </span>
      </div>
      <div
        aria-label={`${progress}% of current access available`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.06]"
        role="progressbar"
      >
        <span
          className="block h-full rounded-full bg-gradient-to-r from-[#c8d1aa] to-[#79b493]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <Link
        className="mt-5 inline-flex text-xs font-medium text-[#b8c493] hover:text-[#c8d1aa]"
        href="/dashboard/investigate"
      >
        Start an investigation →
      </Link>
    </section>
  );
}
