import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { PublicPage } from "@/components/public-page";
import { buttonVariants } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Preview Access",
  description:
    "Run complete Capela molecule investigations free during preview, including sourced literature, evidence classification, and the full research dossier.",
  path: "/pricing",
});

const features = [
  "Full molecule investigation",
  "Complete eight-section dossier",
  "Evidence classification",
  "Retrieved literature sources",
];
export default function PricingPage() {
  return (
    <PublicPage
      eyebrow="Access"
      title="Free access during preview."
      intro="Payments are temporarily disabled. Every authenticated researcher can run complete Capela investigations during the preview period."
    >
      <section className="shell py-20">
        <div className="mx-auto max-w-3xl">
          <PriceCard label="Preview access" price="Free" note="No payment or subscription required" featured />
        </div>
        <div className="premium-surface mt-6 flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm">Run full molecule investigations during the preview.</p>
            <p className="mt-1 text-xs text-[#788274]">
              Failed runs remain retryable, and only one investigation runs at a time per account.
            </p>
          </div>
          <Link href="/dashboard/investigate" className={buttonVariants({ variant: "primary" })}>
            Start a free investigation <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </PublicPage>
  );
}
function PriceCard({
  label,
  price,
  note,
  featured = false,
}: {
  label: string;
  price: string;
  note: string;
  featured?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-[1.75rem] border p-7 md:p-10 ${featured ? "border-[#9fad7c]/25 bg-[#9fad7c]/[.045]" : "border-white/[.09] bg-[#101310]/85"}`}
    >
      {featured && <div className="absolute -right-12 -top-20 size-60 rounded-full bg-[#9fad7c]/10 blur-3xl" />}
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <span className="mono text-[9px] uppercase tracking-[.18em] text-[#9fad7c]">{label}</span>
          <span className="rounded-full border border-white/[.08] px-3 py-1.5 mono text-[8px] uppercase tracking-[.12em] text-[#879184]">
            {featured ? "Included" : "Available"}
          </span>
        </div>
        <h2 className="mt-12 text-5xl font-medium tracking-[-.06em]">{price}</h2>
        <p className="mt-3 text-xs leading-5 text-[#879184]">{note}</p>
        <ul className="mt-10 space-y-3 border-t border-white/[.08] pt-7">
          {features.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-[#a9b0a4]">
              <Check size={14} className="text-[#63e6a1]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
