import {
  ArrowDown,
  ArrowRight,
  Atom,
  BookOpen,
  Check,
  CircleAlert,
  FlaskConical,
  Microscope,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { PremiumBackground } from "@/components/premium-background";
import { buttonVariants } from "@/components/ui/button";
import { InvestigationEntry } from "@/components/investigation-entry";

const pipeline = ["Resolve", "Search", "Read", "Extract", "Classify", "Assess", "Build"];
const evidence = [
  ["Direct experimental", "Measured in an experiment", "#63e6a1"],
  ["Indirect experimental", "Observed effect, indirect relation", "#8bd7ba"],
  ["Computational", "Docking, QSAR, or prediction", "#9fad7c"],
  ["Literature reported", "Reported without primary proof", "#a9b0a4"],
  ["Capela inference", "Visible multi-source synthesis", "#f2d66b"],
  ["Insufficient", "Evidence cannot support a claim", "#a9b0a4"],
];
const dossier = [
  "Molecule overview",
  "Common sources / context",
  "Biological activity",
  "Molecular targets",
  "Mechanism of action",
  "Literature evidence",
  "Evidence vs prediction",
  "Research assessment",
];
const problemCards = [
  { icon: Atom, label: "Chemical identity" },
  { icon: BookOpen, label: "Literature" },
  { icon: Microscope, label: "Evidence" },
  { icon: ShieldCheck, label: "Validation" },
];

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main className="page-enter relative overflow-hidden">
        <PremiumBackground />
        <section className="relative min-h-screen border-b border-white/[.07]">
          <div className="shell relative grid min-h-screen items-center gap-14 pb-20 pt-32 lg:grid-cols-[1.06fr_.94fr] lg:pb-24 lg:pt-36">
            <div className="min-w-0">
              <span className="eyebrow">AI molecule investigation agent</span>
              <h1 className="text-balance mt-8 max-w-3xl break-words text-[clamp(3.1rem,7vw,6.7rem)] font-medium leading-[.89] tracking-[-.072em]">
                Investigate a molecule.
                <span className="mt-2 block font-normal text-[#9ca596]">
                  See what the <span className="brand-text">evidence</span> supports.
                </span>
              </h1>
              <p className="mt-8 max-w-xl text-base leading-7 text-[#a9b0a4] md:text-lg">
                Capela searches scientific literature, extracts reported biological evidence, separates experiments from
                predictions, and builds a sourced research dossier.
              </p>
              <InvestigationEntry />
              <div className="mt-5 flex flex-wrap items-center gap-5 text-xs text-[#929d8f]">
                <span className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-[#63e6a1]/10">
                    <Check size={11} className="text-[#63e6a1]" />
                  </span>
                  Free investigations during preview
                </span>
                <Link href="#product" className="flex items-center gap-2 transition hover:text-[#9fad7c]">
                  See how it works <ArrowDown size={13} />
                </Link>
              </div>
              <a
                href="https://orionagents.org/hackathon"
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/[.09] bg-white/[.035] px-4 py-2 text-[11px] font-semibold text-[#b7c0b3] transition hover:border-[#9fad7c]/25 hover:bg-[#9fad7c]/[.06] hover:text-white"
              >
                <Sparkles size={13} className="text-[#9fad7c]" /> Built for the Orion Builder Hackathon
              </a>
            </div>
            <DossierPreview />
          </div>
        </section>

        <Section
          id="product"
          number="01"
          label="The problem"
          title="Scientific molecule research is fragmented."
          copy="Chemical databases, literature searches, target research, pathway interpretation, and manual evidence checks live in different places. The hardest question remains the simplest: how do we know?"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {problemCards.map(({ icon: Icon, label }, i) => (
              <div key={label} className="spotlight-card min-h-44 p-6">
                <span className="grid size-10 place-items-center rounded-xl border border-[#9fad7c]/15 bg-[#9fad7c]/[.06]">
                  <Icon size={18} className="text-[#9fad7c]" />
                </span>
                <span className="mono mt-10 block text-[9px] tracking-[.14em] text-[#667061]">0{i + 1}</span>
                <strong className="mt-2 block text-sm font-medium">{label}</strong>
              </div>
            ))}
          </div>
        </Section>
        <Section
          number="02"
          label="One investigation"
          title="One molecule. The whole evidence picture."
          copy="You do not separately prompt for activities, targets, mechanisms, and citations. One investigation resolves the molecule, retrieves the literature, and connects every conclusion to its support."
        >
          <div className="premium-surface p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              {["Molecule", "Retrieved studies", "Validated evidence", "Research dossier"].map((item, i) => (
                <div key={item} className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#9fad7c]/20 bg-[#9fad7c]/[.05] mono text-[10px] text-[#9fad7c]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm text-[#a9b0a4]">{item}</span>
                  {i < 3 && <ArrowRight className="ml-auto hidden text-white/15 md:block" size={16} />}
                </div>
              ))}
            </div>
          </div>
        </Section>
        <Section
          number="03"
          label="How Capela works"
          title="Retrieval before synthesis."
          copy="Capela does not answer from model memory and search for citations afterward. The order of operations is part of the scientific method."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {pipeline.map((step, i) => (
              <div
                key={step}
                className="soft-surface group p-5 transition hover:border-[#9fad7c]/20 hover:bg-[#9fad7c]/[.035]"
              >
                <div className="flex items-center justify-between">
                  <span className="mono text-[9px] text-[#788274]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="size-1 rounded-full bg-[#9fad7c]/35 transition group-hover:bg-[#9fad7c]" />
                </div>
                <p className="mt-12 text-sm font-medium">{step}</p>
              </div>
            ))}
          </div>
        </Section>
        <Section
          number="04"
          label="Evidence classification"
          title="A prediction should look like a prediction."
          copy="Every finding carries a visible evidence class. Deterministic validation can downgrade weak AI classifications, but never upgrades them without support."
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_.75fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              {evidence.map(([name, desc, color]) => (
                <div key={name} className="soft-surface p-5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="size-1.5 rounded-full" style={{ background: String(color) }} />
                    {name}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#788274]">{desc}</p>
                </div>
              ))}
            </div>
            <div className="premium-surface relative overflow-hidden p-7">
              <div className="absolute right-0 top-0 size-36 bg-[radial-gradient(circle,rgba(159,173,124,.1),transparent_68%)]" />
              <span className="mono text-[9px] uppercase tracking-[.18em] text-[#9fad7c]">
                Computational prediction
              </span>
              <h3 className="mt-4 text-3xl font-light">KEAP1</h3>
              <dl className="mt-7 grid gap-5 text-xs">
                <Data label="Relationship" value="Predicted interaction" />
                <Data label="Method" value="Molecular docking" />
                <Data label="Direct experimental confirmation" value="Not identified" />
              </dl>
            </div>
          </div>
        </Section>
        <Section
          number="05"
          label="Research dossier"
          title="Eight sections. One inspectable record."
          copy="The result is structured for scientific review, not presented as an opaque chat answer."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dossier.map((item, i) => (
              <div
                key={item}
                className="group soft-surface min-h-36 p-6 transition hover:border-[#9fad7c]/20 hover:bg-[#171b16]"
              >
                <span className="mono text-[9px] text-[#667061]">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-12 text-sm text-[#c9d0c5] transition group-hover:text-white">{item}</p>
              </div>
            ))}
          </div>
        </Section>
        <Section
          number="06"
          label="Scientific restraint"
          title="Knowing when not to conclude is part of the product."
          copy="Uncertainty is a valid result. Capela never fills a missing mechanism because it sounds plausible."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              "No invented citations or identifiers",
              "No computational-as-experimental claims",
              "No pathway change presented as direct binding",
              "Insufficient and conflicting evidence stay visible",
            ].map((item) => (
              <div key={item} className="soft-surface flex items-center gap-4 p-5 text-sm text-[#a9b0a4]">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f2d66b]/10">
                  <CircleAlert size={15} className="text-[#f2d66b]" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </Section>
        <section className="reveal-section border-t border-white/[.07] py-24 lg:py-32">
          <div className="shell premium-surface relative overflow-hidden p-8 md:p-14 lg:p-16">
            <div className="absolute -right-16 -top-24 size-96 bg-[radial-gradient(circle,rgba(159,173,124,.14),transparent_65%)]" />
            <div className="absolute -bottom-28 left-1/3 size-80 bg-[radial-gradient(circle,rgba(99,230,161,.08),transparent_65%)]" />
            <span className="eyebrow">07 — Access</span>
            <div className="relative mt-8 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className="text-balance text-4xl font-medium tracking-[-.055em] md:text-6xl">
                  Start with one investigation.
                </h2>
                <p className="mt-4 text-[#a9b0a4]">
                  Full investigations are free during preview. Payments are temporarily disabled.
                </p>
              </div>
              <Link href="/dashboard/investigate" className={buttonVariants({ variant: "primary" })}>
                Start a free investigation <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

function DossierPreview() {
  return (
    <div className="float-card relative mx-auto w-full max-w-[500px] lg:rotate-[1.5deg] lg:perspective-[1200px]">
      <div className="absolute -inset-12 bg-[radial-gradient(circle,rgba(159,173,124,.09),transparent_68%)]" />
      <div className="absolute -bottom-5 left-8 right-8 h-12 rounded-full bg-[#63e6a1]/10 blur-2xl" />
      <article className="luminous-panel relative overflow-hidden shadow-[0_45px_120px_rgba(0,0,0,.52)] backdrop-blur-xl lg:transform-[rotateY(-5deg)]">
        <header className="flex items-center justify-between border-b border-white/[.07] px-6 py-4">
          <span className="text-[11px] font-semibold text-[#879184]">Example investigation</span>
          <span className="flex items-center gap-2 mono text-[9px] text-[#63e6a1]">
            <span className="size-1.5 rounded-full bg-[#63e6a1]" /> Complete
          </span>
        </header>
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#879184]">Research dossier</span>
              <h2 className="mt-2 text-4xl">Loliolide</h2>
            </div>
            <div className="grid size-16 place-items-center rounded-2xl border border-[#9fad7c]/20 bg-[#9fad7c]/[.055] text-[#9fad7c]">
              <FlaskConical size={25} strokeWidth={1.2} />
            </div>
          </div>
          <div className="mt-7 grid grid-cols-3 rounded-2xl border border-white/[.07] bg-white/[.025] py-5 text-center">
            <Metric value="12" label="Studies" />
            <Metric value="8" label="Experimental" />
            <Metric value="3" label="Computational" />
          </div>
          <div className="mt-6 space-y-3">
            <Finding name="Antioxidant" type="Direct experimental" color="#63e6a1" />
            <Finding name="KEAP1" type="Computational prediction" color="#9fad7c" />
            <Finding name="Mechanism" type="Partially supported" color="#f2d66b" />
          </div>
          <footer className="mt-6 flex items-center justify-between border-t border-white/[.07] pt-5">
            <span className="text-[11px] font-semibold text-[#879184]">Overall evidence</span>
            <span className="rounded-full border border-[#f2d66b]/30 bg-[#f2d66b]/5 px-3 py-1.5 text-[11px] font-semibold text-[#f2d66b]">
              Moderate
            </span>
          </footer>
        </div>
      </article>
    </div>
  );
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong className="text-lg font-light">{value}</strong>
      <span className="mt-1 block text-[10px] font-medium text-[#879184]">{label}</span>
    </div>
  );
}
function Finding({ name, type, color }: { name: string; type: string; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.025] px-4 py-3.5">
      <span className="text-sm">{name}</span>
      <span className="flex items-center gap-2 text-[10px] font-semibold text-[#a9b0a4]">
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        {type}
      </span>
    </div>
  );
}
function Data({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold text-[#879184]">{label}</dt>
      <dd className="mt-1.5 text-sm text-[#b8c1ce]">{value}</dd>
    </div>
  );
}
function Section({
  number,
  label,
  title,
  copy,
  children,
  id,
}: {
  number: string;
  label: string;
  title: string;
  copy: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="reveal-section border-b border-white/[.07] py-24 lg:py-32">
      <div className="shell">
        <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-12">
          <div>
            <span className="mono flex items-center gap-3 text-[9px] uppercase tracking-[.17em] text-[#788274]">
              <span className="h-px w-7 bg-[#9fad7c]/50" /> {number}
            </span>
          </div>
          <div>
            <span className="eyebrow">{label}</span>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_.65fr] xl:items-end">
              <h2 className="text-balance text-4xl font-medium leading-[.98] tracking-[-.055em] md:text-6xl">
                {title}
              </h2>
              <p className="max-w-xl text-sm leading-7 text-[#a9b0a4] xl:justify-self-end">{copy}</p>
            </div>
            <div className="mt-12">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
