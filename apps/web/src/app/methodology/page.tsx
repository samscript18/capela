import { FactGrid, NumberedBlock, PublicPage } from "@/components/public-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Evidence Methodology",
  description:
    "Explore Capela's retrieval-first evidence framework for separating direct experiments, indirect findings, computational predictions, and scientific inference.",
  path: "/methodology",
});

const sections = [
  {
    number: "01",
    title: "Retrieval before synthesis",
    text: "The model analyzes retrieved scientific material. It does not answer from memory and search for supporting citations afterward.",
  },
  {
    number: "02",
    title: "Direct experimental evidence",
    text: "A relationship or effect must be measured experimentally. Direct binding requires an appropriate binding measurement; it cannot be inferred from a downstream pathway change.",
  },
  {
    number: "03",
    title: "Indirect experimental evidence",
    text: "An effect was observed experimentally, but the proposed molecular relationship itself was not directly established.",
  },
  {
    number: "04",
    title: "Computational prediction",
    text: "Docking, molecular dynamics, QSAR, machine-learning prediction, target prediction, and network pharmacology remain visibly computational.",
  },
  {
    number: "05",
    title: "Capela inference",
    text: "When Capela connects findings across stored evidence, that synthesis is labeled as an inference and never presented as a direct paper result.",
  },
  {
    number: "06",
    title: "Mechanism rules",
    text: "Every mechanism edge must reference existing evidence and papers. If the chain cannot be supported, the mechanism status is insufficient, partial, or conflicting.",
  },
  {
    number: "07",
    title: "Research assessment",
    text: "Strength is computed from explainable inputs such as independent experimental support, directness, consistency, source depth, conflicts, and computational dependence.",
  },
  {
    number: "08",
    title: "Scientific limitations",
    text: "Capela assesses what retrieved literature supports. It does not determine whether a molecule is a good drug, predict clinical success, recommend experiments, or replace expert review.",
  },
];

export default function MethodologyPage() {
  return (
    <PublicPage
      eyebrow="Evidence methodology"
      title="Certainty should be inspectable."
      intro="Capela’s framework is designed to prevent the most consequential category errors in AI-assisted molecule research."
    >
      {sections.map((section, i) => (
        <NumberedBlock key={section.number} {...section}>
          {i === 3 && (
            <FactGrid
              items={[
                { label: "Docking", text: "Computational prediction, never direct experimental binding." },
                {
                  label: "Expression change",
                  text: "Experimental observation, not automatic evidence of direct binding.",
                },
                {
                  label: "Review claim",
                  text: "Literature reported unless analyzed primary evidence independently establishes it.",
                },
                {
                  label: "Missing mechanism",
                  text: "Insufficient evidence is returned instead of biological plausibility.",
                },
              ]}
            />
          )}
        </NumberedBlock>
      ))}
    </PublicPage>
  );
}
