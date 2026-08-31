import { FactGrid, NumberedBlock, PublicPage } from "@/components/public-page";

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="About Capela"
      title="Scientific evidence, made easier to inspect."
      intro="Capela is an AI molecule investigation agent built for the Orion Agents Hackathon. It exists to answer one bounded question well: what does the available evidence actually support?"
    >
      <NumberedBlock
        number="01"
        title="Why Capela exists"
        text="Molecule research is fragmented across chemical databases, paper indexes, full texts, and manual interpretation. Capela makes that workflow feel simple without hiding how conclusions were reached."
      />
      <NumberedBlock
        number="02"
        title="Evidence-first by design"
        text="Uncertainty is not treated as failure. Limited evidence, conflicting results, unsupported targets, and missing mechanisms are all valid investigation outcomes."
      />
      <NumberedBlock
        number="03"
        title="Built for a focused hackathon demo"
        text="The architecture is intentionally direct: a Next.js interface, a NestJS investigation runner, MongoDB persistence, and Privy authentication."
      >
        <FactGrid
          items={[
            { label: "Chemical data", text: "PubChem PUG REST" },
            { label: "Scientific literature", text: "Tavily over trusted publication sources" },
            { label: "Structured analysis", text: "Google Cloud Gemini with Groq fallback" },
            { label: "Access", text: "Privy authentication with free preview investigations" },
          ]}
        />
      </NumberedBlock>
      <NumberedBlock
        number="04"
        title="A clear product boundary"
        text="Capela does not perform docking, predict ADMET, generate molecules, recommend experiments, or decide whether a molecule is a good drug. It investigates the retrieved evidence and makes certainty inspectable."
      />
    </PublicPage>
  );
}
