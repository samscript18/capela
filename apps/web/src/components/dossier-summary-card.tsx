"use client";

import { CheckCircle2, Download, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import type { ApiInvestigation } from "@/lib/api";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function downloadName(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 64);
  return `capela-${slug || "molecule"}-evidence-brief.png`;
}

function evidenceLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

export function DossierSummaryCard({ item }: { item: ApiInvestigation }) {
  const dossier = item.dossier!;
  const assessment = dossier.researchAssessment;
  const molecule = dossier.overview.molecule;
  const cardRef = useRef<HTMLElement>(null);
  const [downloadState, setDownloadState] = useState<"idle" | "pending" | "error">("idle");

  const download = async () => {
    if (!cardRef.current || downloadState === "pending") return;
    setDownloadState("pending");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#090b09",
        cacheBust: true,
        pixelRatio: 2,
      });
      const anchor = document.createElement("a");
      anchor.download = downloadName(molecule.preferredName);
      anchor.href = dataUrl;
      anchor.click();
      setDownloadState("idle");
    } catch {
      setDownloadState("error");
    }
  };

  const evidenceDistribution = dossier.evidenceVsPrediction.distribution;
  const experimental = evidenceDistribution.direct_experimental + evidenceDistribution.indirect_experimental;
  const primaryGap = assessment.majorEvidenceGaps[0];
  const mechanismStatus = evidenceLabel(dossier.mechanism.status);
  const completedAt = item.completedAt ?? dossier.generatedAt;

  return (
    <section className="grid gap-7 overflow-hidden rounded-[2rem] border border-[#9fad7c]/15 bg-[radial-gradient(circle_at_0%_0%,rgba(159,173,124,.13),transparent_28rem),#090b09] p-[clamp(1.35rem,4vw,3.25rem)] lg:grid-cols-[minmax(15rem,.62fr)_minmax(0,1.38fr)]">
      <div className="self-center">
        <span className="mono text-[9px] font-semibold uppercase tracking-[.15em] text-[#aebc8d]">
          Capela dossier card
        </span>
        <h2 className="mt-4 max-w-[15ch] text-3xl font-medium leading-[1.04] tracking-[-.045em] sm:text-4xl">
          Your investigation, distilled without losing the evidence.
        </h2>
        <p className="mt-5 max-w-md text-xs leading-6 text-[#8d968a]">
          This shareable PNG is generated only from the completed dossier. Its evidence grade, counts, mechanism state,
          and limitations remain visible.
        </p>
        <button
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#eef2df] px-5 text-xs font-semibold text-[#11150f] shadow-[0_14px_34px_-18px_rgba(200,209,170,.65)] transition hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-55"
          disabled={downloadState === "pending"}
          onClick={() => void download()}
          type="button"
        >
          {downloadState === "pending" ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
          ) : (
            <Download aria-hidden="true" size={15} />
          )}
          {downloadState === "pending" ? "Preparing image…" : "Download dossier card"}
        </button>
        {downloadState === "error" && (
          <p className="mt-3 text-[11px] leading-5 text-[#ff9a9a]" role="alert">
            The image could not be prepared in this browser. Please retry the download.
          </p>
        )}
      </div>

      <article
        className="relative isolate min-w-0 overflow-hidden rounded-[2rem] border border-white/[.13] bg-[radial-gradient(circle_at_8%_0%,rgba(200,209,170,.19),transparent_23rem),radial-gradient(circle_at_100%_100%,rgba(99,230,161,.075),transparent_27rem),linear-gradient(145deg,#171b15_0%,#0c0f0c_48%,#080a08_100%)] p-[clamp(1.35rem,4vw,2.8rem)] text-white shadow-[0_34px_90px_-36px_rgba(159,173,124,.5),inset_0_1px_0_rgba(255,255,255,.075)]"
        ref={cardRef}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 -z-10 size-80 rounded-full border border-[#c8d1aa]/10 bg-[#9fad7c]/[.04] shadow-[0_0_90px_rgba(159,173,124,.15)] before:absolute before:inset-12 before:rounded-full before:border before:border-[#63e6a1]/10"
        />

        <header className="flex items-start justify-between gap-5 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#eef2df] via-[#9fad7c] to-[#5f9f7c] text-lg font-bold text-[#11150f] shadow-[0_12px_30px_rgba(159,173,124,.22)]">
              C
            </span>
            <div className="grid gap-0.5">
              <strong className="text-lg font-semibold tracking-tight">Capela</strong>
              <small className="mono text-[8px] font-semibold uppercase tracking-[.18em] text-white/40">
                Evidence dossier
              </small>
            </div>
          </div>
          <div className="grid justify-items-end gap-1 text-right">
            <span className="text-[10px] font-medium text-white/65">{formatDate(completedAt)}</span>
            <small className="mono text-[8px] uppercase tracking-[.12em] text-white/30">Completed investigation</small>
          </div>
        </header>

        <div className="my-6 rounded-[1.75rem] border border-[#c8d1aa]/15 bg-white/[.045] p-[clamp(1.15rem,3vw,2rem)] shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
          <span className="mono text-[8px] font-semibold uppercase tracking-[.16em] text-[#c8d1aa]">
            Overall evidence
          </span>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <strong className="block text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-none tracking-[-.045em] text-[#eef2df]">
                {assessment.overallStrength}
              </strong>
              <h3 className="mt-3 text-lg font-medium tracking-[-.025em] text-white/85">{molecule.preferredName}</h3>
            </div>
            <span className="mono rounded-full border border-[#9fad7c]/20 bg-[#9fad7c]/[.07] px-3 py-1.5 text-[8px] uppercase tracking-[.11em] text-[#c8d1aa]">
              {assessment.consistency} evidence
            </span>
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-6 text-white/55">{assessment.explanation}</p>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMetric label="Studies" value={assessment.basis.papersAnalyzed} />
          <SummaryMetric label="Evidence claims" value={item.evidence.length} />
          <SummaryMetric label="Experimental" value={experimental} />
          <SummaryMetric label="Targets" value={dossier.molecularTargets.items.length} />
        </dl>

        {assessment.strongestEvidence.length > 0 && (
          <section className="mt-5">
            <span className="mono text-[8px] font-semibold uppercase tracking-[.15em] text-white/35">
              Strongest evidence
            </span>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {assessment.strongestEvidence.slice(0, 2).map((finding) => (
                <div className="rounded-2xl border border-white/[.08] bg-black/20 p-4" key={finding}>
                  <CheckCircle2 aria-hidden="true" className="text-[#63e6a1]" size={14} />
                  <p className="mt-3 text-[11px] leading-5 text-white/62">{finding}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <section className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
            <span className="mono text-[8px] font-semibold uppercase tracking-[.14em] text-[#c8d1aa]">
              Mechanism · {mechanismStatus}
            </span>
            <p className="mt-2 text-[11px] leading-5 text-white/55">{dossier.mechanism.summary}</p>
          </section>
          <section className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
            <span className="mono text-[8px] font-semibold uppercase tracking-[.14em] text-[#d9c979]">
              Main evidence gap
            </span>
            <p className="mt-2 text-[11px] leading-5 text-white/55">
              {primaryGap ?? "The assessment recorded no major evidence gap in the analyzed material."}
            </p>
          </section>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <span className="text-xs font-semibold tracking-[.02em] text-white/80">Evidence before conclusion.</span>
          <small className="mono text-[8px] uppercase tracking-[.1em] text-white/30">
            Case {item._id.slice(-12)} · {dossier.literature.items.length} literature records
          </small>
        </footer>
      </article>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/[.07] bg-black/20 p-4">
      <dd className="text-xl font-semibold tracking-[-.035em] text-[#eef2df]">{value}</dd>
      <dt className="mono mt-2 text-[7px] uppercase tracking-[.11em] text-white/35">{label}</dt>
    </div>
  );
}
