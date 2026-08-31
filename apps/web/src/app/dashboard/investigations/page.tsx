import type { Metadata } from "next";
import InvestigationHistory from "./InvestigationHistory";

export const metadata: Metadata = {
  title: "Investigation history",
};

export default function InvestigationHistoryPage() {
  return <InvestigationHistory />;
}
