"use client";

import type {
  DossierLiteratureEntry,
  EvidenceClaim,
  EvidenceStrength,
  EvidenceType,
  TargetRelationship,
} from "@capela/shared";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileSearch,
  FlaskConical,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { ApiInvestigation } from "@/lib/api";
import { useMe } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

const sections = [
  ["overview", "Overview"],
  ["sources", "Sources"],
  ["activity", "Activity"],
  ["targets", "Targets"],
  ["mechanism", "Mechanism"],
  ["literature", "Literature"],
  ["evidence", "Evidence"],
  ["assessment", "Assessment"],
] as const;

const evidenceLabels: Record<EvidenceType, string> = {
  direct_experimental: "Direct experimental",
  indirect_experimental: "Indirect experimental",
  computational_prediction: "Computational prediction",
  literature_reported: "Literature reported",
  capela_inference: "Capela inference",
  insufficient: "Insufficient",
};

const evidenceClasses: Record<EvidenceType, string> = {
  direct_experimental: "border-[#63e6a1]/30 bg-[#63e6a1]/8 text-[#6ee7a8]",
  indirect_experimental: "border-[#62c9a8]/30 bg-[#62c9a8]/8 text-[#83ddc0]",
  computational_prediction: "border-[#9fad7c]/30 bg-[#9fad7c]/8 text-[#c8d1aa]",
  literature_reported: "border-[#a9b0a4]/30 bg-[#a9b0a4]/8 text-[#c5cbbf]",
  capela_inference: "border-[#f2d66b]/30 bg-[#f2d66b]/8 text-[#f6df88]",
  insufficient: "border-[#ff7474]/30 bg-[#ff7474]/8 text-[#ff8b8b]",
};

const relationshipLabels: Record<TargetRelationship, string> = {
  direct_binding: "Direct binding",
  inhibition: "Inhibition",
  activation: "Activation",
  expression_increase: "Expression increase",
  expression_decrease: "Expression decrease",
  pathway_association: "Pathway association",
  predicted_binding: "Predicted interaction",
  indirect_association: "Indirect association",
  unknown: "Unknown",
};

export function DossierView({ item }: { item: ApiInvestigation }) {
  const dossier = item.dossier!;
  const me = useMe();
  const compactEvidence = me.data?.preferences.compactEvidence ?? false;
  const evidenceInDrawer = me.data?.preferences.openEvidenceInDrawer ?? true;
  const {
    activeDossierSection,
    setActiveDossierSection,
    evidenceDrawerOpen,
    selectedEvidenceIds,
    openEvidence,
    setEvidenceDrawerOpen,
  } = useUiStore();
  const selectedClaims = item.evidence.filter((claim) => selectedEvidenceIds.includes(claim.id));
  const selectedPaperIds = [...new Set(selectedClaims.map((claim) => claim.paperId))];
  const selectedPapers = dossier.literature.items.filter((paper) => selectedPaperIds.includes(paper.id));
  const molecule = dossier.overview.molecule;
  const metrics = [
    ["Studies analyzed", item.progress.papersAnalyzed],
    ["Experimental findings", item.progress.experimentalFindings],
    ["Computational findings", item.progress.computationalFindings],
    ["Targets evaluated", item.progress.targetsEvaluated],
  ];

  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const activationLine = 160;
      let current: (typeof sections)[number][0] = sections[0][0];
      for (const [id] of sections) {
        const section = document.getElementById(id);
        if (!section || section.getBoundingClientRect().top > activationLine) break;
        current = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2)
        current = sections.at(-1)![0];
      if (useUiStore.getState().activeDossierSection !== current) setActiveDossierSection(current);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [setActiveDossierSection]);

  return (
    <div className={cn("min-w-0 pb-24", compactEvidence && "compact-dossier")}>
      <header className="border-b border-white/[.07]">
        <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-8 sm:py-10 xl:px-10">
          <Link
            href="/dashboard/investigations"
            className="inline-flex min-h-9 items-center rounded-full border border-white/[.08] bg-white/[.025] px-3 text-[10px] text-[#a9b0a4] transition hover:border-[#9fad7c]/20 hover:text-white"
          >
            <ArrowLeft size={14} className="mr-1 inline" />
            Investigations
          </Link>
          <div className="luminous-panel relative mt-7 overflow-hidden p-6 sm:p-9 lg:p-11">
            <div className="pointer-events-none absolute -right-28 -top-36 size-[28rem] rounded-full bg-[#9fad7c]/[.075] blur-3xl" />
            <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="min-w-0">
                <span className="eyebrow">Research dossier</span>
                <h1 className="text-balance mt-6 break-words text-4xl leading-[.92] sm:text-6xl lg:text-7xl">
                  {molecule.preferredName}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[#a9b0a4]">
                  A sourced, evidence-graded investigation built from retrieved chemical and scientific records.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <StrengthBadge value={dossier.researchAssessment.overallStrength} />
                <Link
                  href="/dashboard/investigate"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/[.1] bg-white/[.025] px-4 text-[10px] text-[#dce4ef] transition hover:border-[#9fad7c]/30 hover:bg-[#9fad7c]/[.04]"
                >
                  Investigate another molecule
                </Link>
              </div>
            </div>
            <dl className="relative mt-10 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {metrics.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/[.07] bg-black/15 p-4 sm:p-5">
                  <dd className="text-3xl font-medium tracking-[-.05em]">{value}</dd>
                  <dt className="mono mt-2 text-[8px] uppercase tracking-[.12em] text-[#788274]">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      <nav
        className="sticky top-[72px] z-20 overflow-x-auto border-b border-white/[.07] bg-[#080a08]/88 py-2 backdrop-blur-xl"
        aria-label="Dossier sections"
      >
        <div className="mx-auto flex min-w-max max-w-[1320px] gap-1 px-4 sm:px-8 xl:px-10">
          {sections.map(([id, label], index) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setActiveDossierSection(id)}
              className={`mono rounded-full border px-3 py-2.5 text-[8px] uppercase tracking-[.12em] transition sm:px-4 ${activeDossierSection === id ? "border-[#9fad7c]/20 bg-[#9fad7c]/10 text-[#c8d1aa]" : "border-transparent text-[#788274] hover:bg-white/[.035] hover:text-[#a9b0a4]"}`}
            >
              <span className="mr-2 text-[#596354]">{String(index + 1).padStart(2, "0")}</span>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <main
        className={cn(
          "mx-auto max-w-[1320px] px-4 pt-12 sm:px-8 sm:pt-16 xl:px-10",
          compactEvidence ? "space-y-14" : "space-y-24",
        )}
      >
        <DossierSection id="overview" number="01" label="Molecule overview" title="Resolved chemical identity">
          <div className="premium-surface grid overflow-hidden lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="grid min-h-64 place-items-center border-b border-white/[.07] bg-[#f7f9ef] p-6 sm:min-h-72 sm:p-8 lg:border-b-0 lg:border-r">
              <img
                src={molecule.structure2dUrl}
                alt={`Two-dimensional structure of ${molecule.preferredName}`}
                className="size-52 object-contain sm:size-60"
              />
            </div>
            <div className="min-w-0 p-5 sm:p-8">
              <dl className="grid gap-2 sm:grid-cols-2">
                <Fact label="Molecular formula" value={molecule.molecularFormula} />
                <Fact
                  label="Molecular weight"
                  value={molecule.molecularWeight ? `${molecule.molecularWeight} g/mol` : undefined}
                />
                <Fact label="PubChem CID" value={String(molecule.pubchemCid)} />
                <Fact label="InChIKey" value={molecule.inchiKey} copy />
              </dl>
              <div className="mt-5 space-y-3">
                <LongIdentifier label="Canonical SMILES" value={molecule.canonicalSmiles} />
                <LongIdentifier label="InChI" value={molecule.inchi} />
              </div>
              {molecule.description && (
                <p className="mt-6 border-l border-[#9fad7c]/25 pl-4 text-xs leading-6 text-[#a9b0a4]">
                  {molecule.description.text}
                  {molecule.description.sourceName && (
                    <span className="mono mt-2 block text-[8px] uppercase tracking-[.1em] text-[#788274]">
                      Source · {molecule.description.sourceName}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </DossierSection>

        <DossierSection
          id="sources"
          number="02"
          label="Common sources / context"
          title="Where the literature places this molecule"
        >
          {dossier.sources.items.length ? (
            <div className="grid gap-4">
              {dossier.sources.items.map((source) => (
                <article key={source.source} className="spotlight-card p-5 sm:p-6">
                  <span className="mono text-[8px] uppercase tracking-[.14em] text-[#788274]">Reported source</span>
                  <h3 className="mt-3 text-lg font-medium">{source.source}</h3>
                  <ul className="mt-4 space-y-2">
                    {source.contexts.map((context) => (
                      <li key={context} className="text-xs leading-6 text-[#a9b0a4]">
                        {context}
                      </li>
                    ))}
                  </ul>
                  <EvidenceButton ids={source.evidenceIds} onOpen={openEvidence} />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="No meaningful source context was identified in the analyzed literature." />
          )}
        </DossierSection>

        <DossierSection
          id="activity"
          number="03"
          label="Biological activity"
          title="Reported effects and their evidence"
        >
          {dossier.biologicalActivity.items.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {dossier.biologicalActivity.items.map((activity) => {
                const claims = item.evidence.filter((claim) => activity.supportingEvidenceIds.includes(claim.id));
                const type = strongestEvidenceType(claims.map((claim) => claim.evidenceType));
                return (
                  <article key={activity.name} className="spotlight-card p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-xl font-medium capitalize tracking-[-.025em]">{activity.name}</h3>
                      <EvidenceBadge type={type} />
                    </div>
                    <p className="mt-5 text-xs leading-6 text-[#a9b0a4]">{activity.summary}</p>
                    <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/[.07] pt-5">
                      <MiniFact label="Supporting studies" value={activity.supportingPaperIds.length} />
                      <MiniFact label="Evidence strength" value={activity.strength} />
                      <MiniFact label="Experimental findings" value={activity.experimentalCount} />
                      <MiniFact label="Computational findings" value={activity.computationalCount} />
                    </dl>
                    {activity.studyModels.length > 0 && (
                      <p className="mt-4 text-[10px] text-[#788274]">
                        Observed across: {activity.studyModels.join(" · ")}
                      </p>
                    )}
                    {activity.conflicts.map((conflict) => (
                      <p key={conflict} className="mt-4 text-[10px] leading-5 text-[#f2d66b]">
                        {conflict}
                      </p>
                    ))}
                    <EvidenceButton ids={activity.supportingEvidenceIds} onOpen={openEvidence} />
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState text="No supported biological activities were identified in the analyzed literature." />
          )}
        </DossierSection>

        <DossierSection
          id="targets"
          number="04"
          label="Molecular targets"
          title="Direct, indirect, and predicted relationships"
        >
          {dossier.molecularTargets.items.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {dossier.molecularTargets.items.map((target) => {
                const type = strongestEvidenceType(target.evidenceTypes);
                return (
                  <article key={target.normalizedTarget} className="spotlight-card p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-2xl font-medium tracking-[-.03em]">{target.target}</h3>
                      <EvidenceBadge type={type} />
                    </div>
                    <dl className="mt-6 grid gap-2 sm:grid-cols-2">
                      <Fact label="Relationship" value={relationshipLabels[target.relationship]} />
                      <Fact
                        label="Direct confirmation"
                        value={target.directExperimentalConfirmation ? "Identified" : "Not identified"}
                      />
                      <Fact label="Supporting studies" value={String(target.paperIds.length)} />
                      <Fact label="Evidence strength" value={target.strength} />
                    </dl>
                    <p className="mt-5 text-xs leading-6 text-[#a9b0a4]">{target.summary}</p>
                    {target.conflicts.map((conflict) => (
                      <p key={conflict} className="mt-4 text-[10px] leading-5 text-[#f2d66b]">
                        {conflict}
                      </p>
                    ))}
                    <EvidenceButton ids={target.evidenceIds} onOpen={openEvidence} />
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState text="No sufficiently supported molecular targets were identified in the analyzed literature." />
          )}
        </DossierSection>

        <DossierSection id="mechanism" number="05" label="Mechanism of action" title="What the evidence can connect">
          {dossier.mechanism.edges.length ? (
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <StatusBadge value={dossier.mechanism.status} />
                <p className="text-xs text-[#a9b0a4]">{dossier.mechanism.summary}</p>
              </div>
              <div className="mx-auto max-w-3xl">
                {dossier.mechanism.edges.map((edge, index) => (
                  <div key={edge.id}>
                    <article className="premium-surface p-5 sm:p-6">
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div>
                          <span className="mono text-[8px] uppercase tracking-[.12em] text-[#788274]">{edge.from}</span>
                          <h3 className="mt-2 text-lg font-medium">{edge.to}</h3>
                          <p className="mt-3 text-xs leading-6 text-[#a9b0a4]">{edge.description}</p>
                        </div>
                        <EvidenceBadge type={edge.evidenceType} />
                      </div>
                      <EvidenceButton ids={edge.evidenceIds} onOpen={openEvidence} />
                    </article>
                    {index < dossier.mechanism.edges.length - 1 && (
                      <div className="grid h-10 place-items-center">
                        <ArrowDown size={15} className="text-[#788274]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon text={dossier.mechanism.summary} />
          )}
        </DossierSection>

        <DossierSection
          id="literature"
          number="06"
          label="Literature evidence"
          title="The publication record behind this dossier"
        >
          {dossier.literature.items.length ? (
            <div className="premium-surface divide-y divide-white/[.07] overflow-hidden">
              {dossier.literature.items.map((paper, index) => (
                <article
                  key={`${paper.source}-${paper.id}`}
                  className="grid gap-4 p-5 transition hover:bg-white/[.02] sm:p-6 lg:grid-cols-[40px_minmax(0,1fr)_auto]"
                >
                  <span className="mono text-[9px] text-[#788274]">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <h3 className="text-sm leading-6 text-[#dce4ef]">{paper.title}</h3>
                    <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#a9b0a4]">
                      {paper.authorString || paper.authors.join(", ") || "Authors not listed"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {paper.journal && <Meta>{paper.journal}</Meta>}
                      {paper.year && <Meta>{paper.year}</Meta>}
                      <Meta>{paper.studyType.replaceAll("_", " ")}</Meta>
                      <Meta>{paper.analyzedSource.replaceAll("_", " ")}</Meta>
                      {paper.evidenceTypes.map((type) => (
                        <EvidenceBadge key={type} type={type} />
                      ))}
                    </div>
                    {paper.extractedFindings.length > 0 && (
                      <p className="mt-4 text-[10px] leading-5 text-[#788274]">
                        Capela extracted {paper.extractedFindings.length} structured{" "}
                        {paper.extractedFindings.length === 1 ? "finding" : "findings"} from this record.
                      </p>
                    )}
                  </div>
                  <div className="flex items-start gap-2 lg:flex-col lg:items-end">
                    <a
                      href={paper.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/[.1] bg-white/[.02] px-3 text-[10px] text-[#a9b0a4] transition hover:border-[#9fad7c]/20 hover:text-white"
                    >
                      Open publication <ExternalLink size={12} />
                    </a>
                    {paper.evidenceIds.length > 0 && (
                      <EvidenceButton ids={paper.evidenceIds} onOpen={openEvidence} compact />
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="Limited molecule-specific literature was identified." />
          )}
        </DossierSection>

        <DossierSection id="evidence" number="07" label="Evidence vs prediction" title="Classification stays visible">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(dossier.evidenceVsPrediction.distribution).map(([type, count]) => (
              <div key={type} className="soft-surface p-5">
                <EvidenceBadge type={type as EvidenceType} />
                <p className="mt-5 text-4xl font-medium tracking-[-.05em]">{count}</p>
                <p className="mono mt-2 text-[8px] uppercase tracking-[.12em] text-[#788274]">Validated findings</p>
              </div>
            ))}
          </div>
          {dossier.evidenceVsPrediction.examples.length > 0 && (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {dossier.evidenceVsPrediction.examples.map((claim) => (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => openEvidence([claim.id])}
                  className="rounded-2xl border border-white/[.07] bg-white/[.02] p-4 text-left transition hover:border-[#9fad7c]/20 hover:bg-white/[.035]"
                >
                  <EvidenceBadge type={claim.evidenceType} />
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#a9b0a4]">{claim.finding}</p>
                </button>
              ))}
            </div>
          )}
        </DossierSection>

        <DossierSection id="assessment" number="08" label="Research assessment" title="An explainable evidence grade">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
            <div className="premium-surface overflow-hidden">
              <AssessmentRow label="Overall evidence" value={dossier.researchAssessment.overallStrength} />
              <AssessmentRow
                label="Biological activity"
                value={dossier.researchAssessment.biologicalActivityEvidence}
              />
              <AssessmentRow label="Target evidence" value={dossier.researchAssessment.targetEvidence} />
              <AssessmentRow label="Mechanistic evidence" value={dossier.researchAssessment.mechanisticEvidence} />
              <AssessmentRow label="Consistency" value={capitalize(dossier.researchAssessment.consistency)} />
            </div>
            <div className="space-y-5">
              <AssessmentList
                title="Strongest evidence"
                items={dossier.researchAssessment.strongestEvidence}
                empty="No strong evidence signal was identified."
                positive
              />
              <AssessmentList
                title="Evidence gaps"
                items={dossier.researchAssessment.majorEvidenceGaps}
                empty="No major evidence gaps were identified."
              />
              {dossier.researchAssessment.conflicts.length > 0 && (
                <div className="rounded-2xl border border-[#f2d66b]/20 bg-[#f2d66b]/5 p-5">
                  <span className="mono text-[8px] uppercase tracking-[.14em] text-[#f2d66b]">
                    Conflicts identified
                  </span>
                  {dossier.researchAssessment.conflicts.map((conflict) => (
                    <button
                      key={`${conflict.scope}-${conflict.label}`}
                      type="button"
                      onClick={() => openEvidence(conflict.evidenceIds)}
                      className="mt-3 block w-full text-left text-xs leading-5 text-[#d2b968] underline-offset-4 hover:underline"
                    >
                      {conflict.label}: {conflict.description}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DossierSection>
      </main>

      <Sheet open={evidenceDrawerOpen} onOpenChange={setEvidenceDrawerOpen}>
        <SheetContent
          title="Evidence details"
          className={cn(
            "w-[94vw] max-w-xl overflow-y-auto p-0",
            !evidenceInDrawer &&
              "dialog-panel inset-x-auto inset-y-auto bottom-auto left-1/2 right-auto top-1/2 max-h-[86vh] -translate-x-1/2 -translate-y-1/2 rounded-[1.75rem] border border-white/[.12]",
          )}
        >
          <div className="border-b border-white/[.07] px-5 py-6 pr-14 sm:px-7">
            <span className="eyebrow">{evidenceInDrawer ? "Evidence inspection" : "Evidence details"}</span>
            <h2 className="mt-4 text-2xl font-medium tracking-[-.035em]">
              {selectedClaims.length} sourced {selectedClaims.length === 1 ? "claim" : "claims"}
            </h2>
          </div>
          <div className="space-y-4 p-5 sm:p-7">
            {selectedClaims.map((claim) => (
              <EvidenceDetail
                key={claim.id}
                claim={claim}
                paper={selectedPapers.find((paper) => paper.id === claim.paperId)}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DossierSection({
  id,
  number,
  label,
  title,
  children,
}: {
  id: string;
  number: string;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="grid gap-7 lg:grid-cols-[50px_minmax(0,1fr)] xl:grid-cols-[100px_minmax(0,1fr)] lg:gap-10">
        <div className="flex items-start gap-3 pt-1">
          <span className="mt-1.5 h-px w-7 bg-[#9fad7c]/50" />
          <span className="mono text-[9px] text-[#788274]">{number}</span>
        </div>
        <div className="min-w-0">
          <div className="mb-8 border-b border-white/[.07] pb-6">
            <span className="mono text-[9px] uppercase tracking-[.15em] text-[#788274]">{label}</span>
            <h2 className="text-balance mt-3 text-3xl font-medium tracking-[-.045em] sm:text-4xl">{title}</h2>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
function EvidenceBadge({ type }: { type: EvidenceType }) {
  return (
    <span
      className={`mono inline-flex rounded-full border px-2.5 py-1 text-[7px] uppercase tracking-[.09em] ${evidenceClasses[type]}`}
    >
      {evidenceLabels[type]}
    </span>
  );
}
function StrengthBadge({ value }: { value: EvidenceStrength }) {
  return (
    <div className="min-w-44 rounded-2xl border border-[#9fad7c]/16 bg-[#9fad7c]/[.045] p-4">
      <span className="mono text-[8px] uppercase tracking-[.14em] text-[#788274]">Overall evidence</span>
      <p className="mt-2 text-xl font-semibold text-[#c8d1aa]">{value}</p>
    </div>
  );
}
function StatusBadge({ value }: { value: string }) {
  return (
    <span className="mono rounded-full border border-[#9fad7c]/20 bg-[#9fad7c]/[.055] px-3 py-1.5 text-[8px] uppercase tracking-[.1em] text-[#9fad7c]">
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Fact({ label, value, copy }: { label: string; value?: string; copy?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
      <dt className="mono text-[8px] uppercase tracking-[.12em] text-[#788274]">{label}</dt>
      <dd className="mt-2 flex items-start gap-2 break-all text-xs text-[#dce4ef]">
        {value ?? "Not available"}
        {copy && value && <CopyButton value={value} />}
      </dd>
    </div>
  );
}
function MiniFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="mono text-[8px] uppercase tracking-[.1em] text-[#788274]">{label}</dt>
      <dd className="mt-2 text-xs text-[#dce4ef]">{value}</dd>
    </div>
  );
}
function LongIdentifier({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-white/[.07] bg-black/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="mono text-[8px] uppercase tracking-[.12em] text-[#788274]">{label}</span>
        {value && <CopyButton value={value} />}
      </div>
      <p className="mono mt-3 break-all text-[9px] leading-5 text-[#a9b0a4]">{value ?? "Not available"}</p>
    </div>
  );
}
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Value copied" : "Copy value"}
      onClick={() => {
        void copyText(value).then((success) => {
          if (success) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }
        });
      }}
      className="shrink-0 text-[#788274] transition hover:text-white"
    >
      {copied ? <Check size={13} /> : <Clipboard size={13} />}
    </button>
  );
}
function EvidenceButton({
  ids,
  onOpen,
  compact = false,
}: {
  ids: string[];
  onOpen: (ids: string[]) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ids)}
      className={`${compact ? "mt-0" : "mt-5"} inline-flex min-h-9 items-center gap-2 rounded-full border border-white/[.1] bg-white/[.02] px-3 text-[10px] text-[#a9b0a4] transition hover:border-[#9fad7c]/30 hover:text-white`}
    >
      <FileSearch size={13} />
      View evidence
    </button>
  );
}
function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="mono rounded-full border border-white/[.08] bg-white/[.02] px-2.5 py-1 text-[7px] uppercase tracking-[.08em] text-[#788274]">
      {children}
    </span>
  );
}
function EmptyState({ text, icon = false }: { text: string; icon?: boolean }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-white/[.12] bg-white/[.015] p-8 sm:p-10">
      {icon ? (
        <ShieldAlert size={20} className="text-[#f2d66b]" />
      ) : (
        <FlaskConical size={20} className="text-[#788274]" />
      )}
      <p className="mt-5 max-w-2xl text-sm leading-6 text-[#a9b0a4]">{text}</p>
    </div>
  );
}
function AssessmentRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[.07] px-5 py-4 last:border-b-0">
      <span className="text-xs text-[#a9b0a4]">{label}</span>
      <span className="mono text-[9px] uppercase tracking-[.1em] text-[#f7f9ef]">{value}</span>
    </div>
  );
}
function AssessmentList({
  title,
  items,
  empty,
  positive = false,
}: {
  title: string;
  items: string[];
  empty: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[.07] bg-white/[.02] p-5">
      <span className="mono text-[8px] uppercase tracking-[.14em] text-[#788274]">{title}</span>
      <ul className="mt-4 space-y-3">
        {(items.length ? items : [empty]).map((item) => (
          <li key={item} className="flex gap-3 text-xs leading-5 text-[#a9b0a4]">
            {positive ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#63e6a1]" />
            ) : (
              <span className="mt-2 size-1 shrink-0 rounded-full bg-[#788274]" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
function EvidenceDetail({ claim, paper }: { claim: EvidenceClaim; paper?: DossierLiteratureEntry }) {
  return (
    <article className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EvidenceBadge type={claim.evidenceType} />
        <span className="mono text-[8px] uppercase tracking-[.1em] text-[#788274]">{claim.analyzedSource}</span>
      </div>
      <h3 className="mt-5 text-sm leading-6">{claim.finding}</h3>
      {claim.measuredOutcome && (
        <div className="mt-4 rounded-xl border border-white/[.07] bg-black/15 p-4">
          <span className="mono text-[8px] uppercase tracking-[.12em] text-[#788274]">Reported measurement</span>
          <p className="mt-2 text-xs leading-5 text-[#dce4ef]">{claim.measuredOutcome}</p>
        </div>
      )}
      <p className="mt-3 text-[10px] leading-5 text-[#788274]">{classificationExplanation(claim.evidenceType)}</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/[.07] pt-5">
        {claim.relationship && <MiniFact label="Relationship" value={relationshipLabels[claim.relationship]} />}
        <MiniFact label="Confidence" value={capitalize(claim.confidence)} />
        {claim.model && <MiniFact label="Study model" value={claim.model} />}
        <MiniFact label="Study type" value={claim.studyType.replaceAll("_", " ")} />
      </dl>
      {paper && (
        <div className="mt-5 border-t border-white/[.07] pt-5">
          <span className="mono text-[8px] uppercase tracking-[.12em] text-[#788274]">Supporting publication</span>
          <p className="mt-3 text-xs leading-5 text-[#dce4ef]">{paper.title}</p>
          <p className="mt-2 text-[10px] leading-5 text-[#a9b0a4]">
            {paper.authorString || paper.authors.join(", ")}
            {paper.journal ? ` · ${paper.journal}` : ""}
            {paper.year ? ` · ${paper.year}` : ""}
          </p>
          <p className="mono mt-2 text-[8px] leading-4 text-[#788274]">
            {paper.doi ? `DOI ${paper.doi}` : paper.pmid ? `PMID ${paper.pmid}` : paper.id}
          </p>
          <a
            href={paper.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-[10px] text-[#9fad7c] hover:text-white"
          >
            Open publication <ExternalLink size={12} />
          </a>
        </div>
      )}
    </article>
  );
}
function strongestEvidenceType(types: EvidenceType[]): EvidenceType {
  const order: EvidenceType[] = [
    "direct_experimental",
    "indirect_experimental",
    "computational_prediction",
    "literature_reported",
    "capela_inference",
    "insufficient",
  ];
  return order.find((type) => types.includes(type)) ?? "insufficient";
}
function classificationExplanation(type: EvidenceType) {
  return {
    direct_experimental: "The relationship or effect was directly measured experimentally in the analyzed paper.",
    indirect_experimental:
      "An experimental effect was observed, but the molecular relationship itself was not directly established.",
    computational_prediction: "This finding comes from a computational method and is not experimental confirmation.",
    literature_reported:
      "The analyzed literature reports or discusses this finding without direct primary confirmation in the analyzed material.",
    capela_inference: "This is a visible synthesis across stored findings, not a direct experimental result.",
    insufficient: "The available evidence does not justify a reliable conclusion.",
  }[type];
}
function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
