import { ArrowRight } from "lucide-react";
import { FactGrid, NumberedBlock, PublicPage } from "@/components/public-page";

const steps = [
  {
    number: "01",
    title: "Resolve the molecule",
    text: "PubChem supplies the identity, chemical properties, synonyms, and structure. Capela does not ask a language model to invent chemical identifiers.",
  },
  {
    number: "02",
    title: "Search the literature",
    text: "A bounded vocabulary drives Tavily searches restricted to trusted scientific publication sources across activity, targets, mechanisms, and computational studies.",
  },
  {
    number: "03",
    title: "Read the strongest studies",
    text: "Duplicate records are removed, relevance is scored deterministically, and a bounded set of the strongest papers is analyzed.",
  },
  {
    number: "04",
    title: "Extract evidence",
    text: "Structured analysis records only findings supported by each retrieved paper while preserving the source paper ID.",
  },
  {
    number: "05",
    title: "Validate classifications",
    text: "A deterministic layer catches category errors: docking remains computational, expression changes do not become direct binding, and reviews remain literature reported.",
  },
  {
    number: "06",
    title: "Synthesize with restraint",
    text: "Activities, targets, and mechanism edges are built only from validated evidence. Unsupported conclusions become explicit gaps.",
  },
  {
    number: "07",
    title: "Build the dossier",
    text: "Capela assembles eight inspectable sections and verifies that every evidence and paper reference exists before saving the result.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicPage
      eyebrow="System walkthrough"
      title="From molecule to evidence dossier."
      intro="One investigation runs the complete research workflow. The simplicity belongs in the interface; the scientific chain stays visible underneath."
    >
      <div className="border-b border-white/[.07] py-10 md:py-14">
        <div className="shell premium-surface flex flex-wrap items-center gap-3 p-4 md:p-5">
          {["Molecule", "PubChem", "Literature", "Extraction", "Classification", "Synthesis", "Dossier"].map(
            (step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="rounded-full border border-white/[.08] bg-white/[.035] px-3.5 py-2.5 mono text-[9px] uppercase tracking-[.1em] text-[#c0c8bc]">
                  {step}
                </span>
                {i < 6 && <ArrowRight size={13} className="text-[#9fad7c]/40" />}
              </div>
            ),
          )}
        </div>
      </div>
      {steps.map((step) => (
        <NumberedBlock key={step.number} {...step} />
      ))}
      <NumberedBlock
        number="AUTOMATIC"
        title="What Capela does automatically"
        text="The user supplies only a molecule. Capela handles the complete evidence investigation without a chain of separate prompts."
      >
        <FactGrid
          items={[
            { label: "Identity resolution", text: "Names, synonyms, properties, and structure." },
            {
              label: "Literature retrieval",
              text: "Bounded searches, deduplication, ranking, and source-depth tracking.",
            },
            {
              label: "Evidence analysis",
              text: "Structured extraction, deterministic validation, normalization, and aggregation.",
            },
            {
              label: "Scientific assessment",
              text: "Evidence strength, consistency, mechanism support, conflicts, and gaps.",
            },
          ]}
        />
      </NumberedBlock>
    </PublicPage>
  );
}
