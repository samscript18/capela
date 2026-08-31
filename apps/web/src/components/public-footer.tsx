import Link from "next/link";
import { Brand } from "./brand";

export function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[.08] bg-[#090d0a]">
      <div className="pointer-events-none absolute -bottom-40 left-1/3 size-96 rounded-full bg-[#9fad7c]/[.035] blur-3xl" />
      <div className="shell relative grid gap-12 py-16 md:grid-cols-[1.4fr_.6fr_.6fr] md:py-20">
        <div>
          <Brand />
          <p className="mt-6 max-w-sm text-sm leading-6 text-[#8d968a]">
            A molecule investigation system built around a simple standard: every scientific claim should reveal what
            supports it.
          </p>
          <span className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-[#70e6a5]">
            <span className="size-1.5 rounded-full bg-[#70e6a5] shadow-[0_0_12px_#70e6a5]" /> Ready to investigate
          </span>
        </div>
        <nav className="grid content-start gap-3 text-xs text-[#a9b0a4]" aria-label="Footer navigation">
          <span className="mb-2 text-xs font-semibold text-[#788274]">Product</span>
          <Link className="transition hover:text-[#9fad7c]" href="/how-it-works">
            How it works
          </Link>
          <Link className="transition hover:text-[#9fad7c]" href="/methodology">
            Methodology
          </Link>
          {/* <Link className="transition hover:text-[#9fad7c]" href="/pricing">
            Pricing
          </Link> */}
        </nav>
        <nav className="grid content-start gap-3 text-xs text-[#a9b0a4]" aria-label="Company navigation">
          <span className="mb-2 text-xs font-semibold text-[#788274]">Capela</span>
          <Link className="transition hover:text-[#9fad7c]" href="/about">
            About
          </Link>
          <Link className="transition hover:text-[#9fad7c]" href="/dashboard">
            Open app
          </Link>
        </nav>
      </div>
      <div className="shell relative flex flex-col gap-2 border-t border-white/[.07] py-5 text-[11px] text-[#667061] sm:flex-row sm:justify-between">
        <span>© 2026 Capela · Orion Agents Hackathon</span>
        <span>Evidence first, uncertainty visible.</span>
      </div>
    </footer>
  );
}
