import type { Metadata } from "next";
import { InvestigationComposer } from "./InvestigationComposer";

export const metadata: Metadata = {
  title: "New investigation",
};

export default async function InvestigatePage({ searchParams }: { searchParams: Promise<{ molecule?: string }> }) {
  const molecule = (await searchParams).molecule?.slice(0, 200) ?? "";
  return <InvestigationComposer initialMolecule={molecule} />;
}
