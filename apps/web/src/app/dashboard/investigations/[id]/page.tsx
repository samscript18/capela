"use client";

import type { InvestigationStatus } from "@capela/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Circle, ExternalLink, LoaderCircle, RotateCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { DossierView } from "@/components/dossier-view";
import { DeleteInvestigationButton } from "@/components/delete-investigation-button";
import { ApiError, useInvestigation, useRetryInvestigation } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { formatAccessType, formatInvestigationStatus } from "@/lib/investigation-record";

const stages: { status: InvestigationStatus; label: string }[] = [
  { status: "resolving_molecule", label: "Resolving molecule identity" },
  { status: "searching_literature", label: "Searching scientific literature" },
  { status: "ranking_studies", label: "Ranking relevant studies" },
  { status: "extracting_evidence", label: "Extracting structured evidence" },
  { status: "classifying_evidence", label: "Classifying findings" },
  { status: "analyzing_findings", label: "Evaluating activities and targets" },
  { status: "building_assessment", label: "Assessing mechanism and evidence" },
  { status: "generating_dossier", label: "Building research dossier" },
];

export default function InvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const investigation = useInvestigation(id);
  const retry = useRetryInvestigation(id);
  const status = investigation.data?.status;
  useEffect(() => {
    if (status !== "completed" && status !== "failed") return;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["investigations"] }),
      queryClient.invalidateQueries({ queryKey: ["access"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
    ]);
  }, [queryClient, status]);

  if (investigation.isLoading) return <LoadingState />;
  if (investigation.isError || !investigation.data) return <LoadError />;
  const item = investigation.data;
  if (item.status === "completed" && item.dossier) return <DossierView item={item} />;
  if (item.status === "completed") return <MissingDossierState />;
  const activeIndex = stages.findIndex((stage) => stage.status === item.status);
  const failed = item.status === "failed";
  const progress = item.status === "queued" ? 3 : Math.max(8, Math.round(((activeIndex + 0.45) / stages.length) * 100));
  const metrics = [
    ["Publications discovered", item.progress.papersDiscovered],
    ["Studies selected", item.progress.papersSelected],
    ["Studies analyzed", item.progress.papersAnalyzed],
    ["Experimental findings", item.progress.experimentalFindings],
    ["Computational findings", item.progress.computationalFindings],
    ["Targets evaluated", item.progress.targetsEvaluated],
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-8 sm:py-10 xl:px-10">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard/investigations"
          className="inline-flex min-h-9 items-center rounded-full border border-white/[.08] bg-white/[.025] px-3 text-[10px] text-[#a9b0a4] transition hover:border-[#9fad7c]/20 hover:text-white"
        >
          <ArrowLeft size={14} className="mr-1 inline" />
          Investigations
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!failed && (
            <span className="mono inline-flex items-center gap-2 rounded-full border border-[#63e6a1]/15 bg-[#63e6a1]/[.04] px-3 py-2 text-[8px] text-[#63e6a1]">
              <span className="size-1.5 rounded-full bg-[#63e6a1] shadow-[0_0_10px_#63e6a1]" />
              Live · updates every 2s
            </span>
          )}
          <DeleteInvestigationButton id={item._id} name={item.molecule?.preferredName ?? item.originalInput} />
        </div>
      </div>
      <header className="relative mt-8 overflow-hidden border-b border-white/[.07] pb-9">
        <div className="pointer-events-none absolute -right-12 -top-20 size-72 rounded-full bg-[#9fad7c]/[.055] blur-3xl" />
        <span className="eyebrow">{failed ? "Investigation interrupted" : "Autonomous investigation"}</span>
        <h1 className="text-balance relative mt-6 break-words text-4xl font-medium leading-[.95] tracking-[-.055em] sm:text-6xl">
          Investigating {item.molecule?.preferredName ?? item.originalInput}
        </h1>
        {item.molecule &&
          item.molecule.preferredName.toLocaleLowerCase() !== item.originalInput.toLocaleLowerCase() && (
            <p className="mt-3 text-sm text-[#a9b0a4]">Resolved from “{item.originalInput}”</p>
          )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span
            className={`mono rounded-full px-3 py-1.5 text-[8px] ${failed ? "border border-[#ff7474]/30 bg-[#ff7474]/[.07] !text-[#ff7474]" : "border border-[#9fad7c]/20 bg-[#9fad7c]/[.06] !text-[#9fad7c]"}`}
          >
            {formatInvestigationStatus(item.status)}
          </span>
          <span className="mono rounded-full border border-white/[.09] bg-white/[.025] px-3 py-1.5 text-[8px] uppercase tracking-[.12em] text-[#a9b0a4]">
            {formatAccessType(item.access.type)}
          </span>
          {item.molecule && (
            <a
              href={item.molecule.pubchemUrl}
              target="_blank"
              rel="noreferrer"
              className="mono rounded-full border border-white/[.09] bg-white/[.025] px-3 py-1.5 text-[8px] uppercase tracking-[.12em] text-[#a9b0a4] transition hover:border-[#9fad7c]/20 hover:text-white"
            >
              PubChem CID {item.molecule.pubchemCid}
            </a>
          )}
        </div>
      </header>

      {!failed && (
        <div className="premium-surface mt-8 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="text-xs text-[#a9b0a4]">{item.progress.message}</span>
            <span className="mono text-[9px] text-[#788274]">{progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-white/[.06]"
            aria-label={`${progress}% complete`}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#9fad7c] to-[#63e6a1] shadow-[0_0_18px_rgba(159,173,124,.35)] transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {item.molecule && (
        <section className="premium-surface mt-6 grid overflow-hidden sm:grid-cols-[190px_minmax(0,1fr)]">
          <div className="grid min-h-48 place-items-center border-b border-white/[.07] bg-[#f7f9ef] p-4 sm:border-b-0 sm:border-r">
            <img
              src={item.molecule.structure2dUrl}
              alt={`Two-dimensional structure of ${item.molecule.preferredName}`}
              className="size-36 object-contain"
            />
          </div>
          <div className="min-w-0 p-6 sm:p-8">
            <span className="mono text-[9px] uppercase tracking-[.14em] text-[#788274]">Resolved molecule</span>
            <h2 className="mt-3 text-3xl font-medium tracking-[-.045em]">{item.molecule.preferredName}</h2>
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <MoleculeFact label="Formula" value={item.molecule.molecularFormula} />
              <MoleculeFact
                label="Molecular weight"
                value={item.molecule.molecularWeight ? `${item.molecule.molecularWeight} g/mol` : undefined}
              />
              <MoleculeFact label="InChIKey" value={item.molecule.inchiKey} />
            </dl>
          </div>
        </section>
      )}

      <section className="premium-surface mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-5 sm:px-7">
          <div>
            <span className="mono text-[8px] uppercase tracking-[.16em] text-[#667061]">Autonomous workflow</span>
            <h2 className="mt-2 text-lg font-medium tracking-[-.025em]">Investigation timeline</h2>
          </div>
          <span className="mono rounded-full border border-white/[.08] px-3 py-1.5 text-[8px] uppercase tracking-[.12em] text-[#788274]">
            Stage {Math.max(0, activeIndex + 1)} / 8
          </span>
        </div>
        <div className="overflow-x-auto p-4 sm:p-5">
          <ol className="grid min-w-[960px] grid-cols-8 gap-2">
            {stages.map((stage, index) => {
              const done = activeIndex > index;
              const active = !failed && activeIndex === index;
              return (
                <li
                  key={stage.status}
                  className={`relative min-h-40 rounded-2xl border p-4 ${
                    done
                      ? "border-[#63e6a1]/18 bg-[#63e6a1]/[.045]"
                      : active
                        ? "border-[#9fad7c]/30 bg-[#9fad7c]/[.06] shadow-[0_16px_45px_rgba(159,173,124,.06)]"
                        : "border-white/[.06] bg-white/[.018]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid size-8 place-items-center rounded-full border ${done ? "border-[#63e6a1]/30 text-[#63e6a1]" : active ? "border-[#9fad7c]/40 text-[#9fad7c]" : "border-white/[.1] text-[#596354]"}`}
                    >
                      {done ? (
                        <Check size={13} />
                      ) : active ? (
                        <LoaderCircle size={13} className="animate-spin" />
                      ) : (
                        <Circle size={9} />
                      )}
                    </span>
                    <span className="mono text-[8px] text-[#596354]">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <p className={`mt-8 text-xs leading-5 ${done || active ? "text-[#e6ebe2]" : "text-[#788274]"}`}>
                    {stage.label}
                  </p>
                  <p
                    className={`mono mt-3 text-[7px] uppercase tracking-[.12em] ${done ? "text-[#63e6a1]" : active ? "text-[#9fad7c]" : "text-[#596354]"}`}
                  >
                    {done ? "Complete" : active ? "In progress" : "Pending"}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
        <section className="premium-surface overflow-hidden">
          <div className="border-b border-white/[.07] px-5 py-5 sm:px-7">
            <h2 className="mono text-[9px] uppercase tracking-[.16em] text-[#c4cbc0]">Live evidence metrics</h2>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-white/[.07] sm:grid-cols-3">
            {metrics.map(([label, value]) => (
              <div key={label} className="bg-[#101310] p-5 sm:p-6">
                <dd className="text-3xl font-medium tracking-[-.05em]">{value}</dd>
                <dt className="mt-3 text-[10px] leading-4 text-[#8d968a]">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="border-t border-white/[.07] px-5 py-4 text-[10px] leading-5 text-[#667061] sm:px-7">
            Counts come directly from the persisted investigation record. Zero remains visible until a research stage
            records evidence.
          </p>
        </section>
        <aside className="premium-surface p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="mono text-[9px] uppercase tracking-[.16em] text-[#c4cbc0]">Event ledger</h2>
            <span className="size-1.5 rounded-full bg-[#63e6a1]" />
          </div>
          <div className="mt-6 space-y-5 border-l border-white/[.08] pl-5">
            <div className="relative">
              <span className="absolute -left-[23px] top-1 size-1.5 rounded-full bg-[#63e6a1]" />
              <span className="mono text-[8px] uppercase tracking-[.12em] text-[#667061]">Run started</span>
              <p className="mt-2 text-xs text-[#c4cbc0]">{formatDateTime(item.startedAt ?? item.createdAt)}</p>
            </div>
            <div className="relative">
              <span className="absolute -left-[23px] top-1 size-1.5 rounded-full bg-[#9fad7c] shadow-[0_0_8px_#9fad7c]" />
              <span className="mono text-[8px] uppercase tracking-[.12em] text-[#667061]">Current event</span>
              <p className="mt-2 text-xs leading-5 text-[#c4cbc0]">{item.progress.message}</p>
            </div>
          </div>
          <div className="mt-7 border-t border-white/[.07] pt-5">
            <span className="mono text-[8px] uppercase tracking-[.14em] text-[#667061]">Investigation ID</span>
            <p className="mono mt-2 break-all text-[9px] leading-5 text-[#8d968a]">{item._id}</p>
          </div>
        </aside>
      </div>

      {item.papers?.length > 0 && (
        <section className="premium-surface mt-6 overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[.07] px-5 py-5 sm:px-7">
            <div>
              <span className="mono text-[9px] uppercase tracking-[.14em] text-[#788274]">Retrieved literature</span>
              <h2 className="mt-2 text-xl font-medium tracking-[-.03em]">Selected scientific records</h2>
            </div>
            <span className="mono text-[8px] uppercase tracking-[.12em] text-[#788274]">
              Pre-analysis inspection · {item.papers.length} records
            </span>
          </div>
          <ol className="divide-y divide-white/[.07]">
            {item.papers.map((paper, index) => (
              <li
                key={`${paper.source}-${paper.id}`}
                className="grid gap-4 px-5 py-5 transition hover:bg-white/[.02] sm:px-7 lg:grid-cols-[36px_minmax(0,1fr)_auto]"
              >
                <span className="mono pt-0.5 text-[9px] text-[#788274]">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <a
                    href={paper.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline text-sm leading-6 text-[#dce4ef] transition hover:text-white"
                  >
                    {paper.title}
                    <ExternalLink
                      size={12}
                      className="ml-1.5 inline text-[#788274] transition group-hover:text-[#9fad7c]"
                    />
                  </a>
                  <p className="mt-2 line-clamp-1 text-[11px] text-[#a9b0a4]">
                    {paper.authorString || paper.authors.join(", ") || "Authors not listed"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                    {paper.journal && <span className="text-[10px] text-[#788274]">{paper.journal}</span>}
                    {paper.year && <span className="mono text-[9px] text-[#788274]">{paper.year}</span>}
                    {paper.pmid && <span className="mono text-[9px] text-[#788274]">PMID {paper.pmid}</span>}
                    {paper.pmcid && <span className="mono text-[9px] text-[#788274]">{paper.pmcid}</span>}
                    {paper.doi && <span className="mono text-[9px] text-[#788274]">DOI {paper.doi}</span>}
                  </div>
                </div>
                <div className="flex items-start gap-2 lg:justify-end">
                  <span className="mono rounded-full border border-white/[.09] bg-white/[.025] px-2.5 py-1 text-[8px] uppercase tracking-[.1em] text-[#a9b0a4]">
                    Score {paper.relevanceScore}
                  </span>
                  {paper.fullTextAvailable && (
                    <span className="mono rounded-full border border-[#63e6a1]/25 bg-[#63e6a1]/5 px-2.5 py-1 text-[8px] uppercase tracking-[.1em] text-[#63e6a1]">
                      Full text
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {failed && (
        <section className="mt-6 rounded-[1.75rem] border border-[#ff7474]/25 bg-[#ff7474]/5 p-6 sm:p-8">
          <ShieldAlert size={20} className="text-[#ff7474]" />
          <h2 className="mt-5 text-2xl font-medium tracking-[-.035em]">Investigation stopped</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a9b0a4]">
            {item.error?.message ?? "The investigation workflow could not be completed."}
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-[#788274]">
            This failed run did not consume investigation access. Retrying this record will not require another
            entitlement.
          </p>
          {item.error?.code && (
            <span className="mono mt-5 inline-flex rounded-full border border-[#ff7474]/20 px-2.5 py-1 text-[8px] uppercase tracking-[.1em] text-[#ff8b8b]">
              {item.error.code.replaceAll("_", " ")}
            </span>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => retry.mutate()}
              disabled={retry.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#9fad7c]/35 bg-[#9fad7c] px-5 text-sm font-bold text-[#10140d] shadow-[0_10px_30px_rgba(109,126,76,.16)] transition hover:-translate-y-0.5 hover:bg-[#b4c18f] disabled:pointer-events-none disabled:opacity-50"
            >
              {retry.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              {retry.isPending ? "Restarting investigation…" : "Retry this investigation"}
            </button>
            <Link
              href="/dashboard/investigate"
              className="inline-flex min-h-11 items-center rounded-full border border-white/[.12] bg-white/[.045] px-5 text-sm font-semibold text-white transition hover:bg-white/[.08]"
            >
              {item.error?.code === "MOLECULE_NOT_FOUND" || item.error?.code === "MOLECULE_AMBIGUOUS"
                ? "Try another name"
                : "Return to dashboard"}
            </Link>
          </div>
          {retry.isError && (
            <p role="alert" className="mt-4 text-xs text-[#ff9a9a]">
              {retry.error instanceof ApiError ? retry.error.message : "Capela could not restart this investigation."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-[1320px] animate-pulse px-4 py-10 sm:px-8">
      <div className="h-9 w-32 rounded-full bg-[#171b16]" />
      <div className="premium-surface mt-8 h-40" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="premium-surface h-[520px]" />
        <div className="premium-surface h-72" />
      </div>
    </div>
  );
}
function LoadError() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-8">
      <Link href="/dashboard/investigations" className="text-xs text-[#a9b0a4]">
        <ArrowLeft size={14} className="mr-1 inline" />
        Investigations
      </Link>
      <div className="mt-8 rounded-[1.75rem] border border-[#ff7474]/20 bg-[#ff7474]/5 p-8 text-sm text-[#ff8b8b]">
        This investigation could not be loaded.
      </div>
    </div>
  );
}
function MissingDossierState() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-8">
      <Link href="/dashboard/investigations" className="text-xs text-[#a9b0a4]">
        <ArrowLeft size={14} className="mr-1 inline" />
        Investigations
      </Link>
      <section className="mt-8 rounded-[1.75rem] border border-[#f2d66b]/25 bg-[#f2d66b]/5 p-7 sm:p-9">
        <ShieldAlert size={20} className="text-[#f2d66b]" />
        <span className="eyebrow mt-6">Dossier unavailable</span>
        <h1 className="mt-5 text-3xl font-medium tracking-[-.04em]">The completed record is missing its dossier.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a9b0a4]">
          Capela did not substitute placeholder findings. Return to the investigation archive while this record is
          reviewed.
        </p>
        <Link
          href="/dashboard/investigations"
          className="mt-6 inline-flex min-h-10 items-center rounded-full bg-[#9fad7c] px-4 text-xs font-semibold text-[#111506]"
        >
          Return to archive
        </Link>
      </section>
    </div>
  );
}
function MoleculeFact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="mono text-[8px] uppercase tracking-[.12em] text-[#788274]">{label}</dt>
      <dd className="mt-2 break-all text-xs text-[#dce4ef]">{value ?? "Not available"}</dd>
    </div>
  );
}
