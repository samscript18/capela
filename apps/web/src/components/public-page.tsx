import type { ReactNode } from "react";
import { PremiumBackground } from "./premium-background";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

export function PublicPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main className="page-enter relative overflow-hidden">
        <PremiumBackground />
        <header className="relative border-b border-white/[.07] pb-20 pt-40 md:pb-28 md:pt-48">
          <div className="shell relative text-center">
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="text-balance mx-auto mt-8 max-w-4xl break-words text-5xl leading-[.94] md:text-7xl lg:text-[5.6rem]">
              {title}
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-[#a9b0a4]">{intro}</p>
          </div>
        </header>
        {children}
      </main>
      <PublicFooter />
    </>
  );
}

export function NumberedBlock({
  number,
  title,
  text,
  children,
}: {
  number: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <section className="reveal-section border-b border-white/[.07] py-16 md:py-24">
      <div className="shell grid gap-8 md:grid-cols-[200px_1fr] md:gap-12">
        <span className="mono flex items-start gap-3 text-[10px] uppercase tracking-[.18em] text-[#788274]">
          <span className="mt-1.5 h-px w-7 bg-[#9fad7c]/50" /> {number}
        </span>
        <div>
          <h2 className="text-balance text-3xl font-medium tracking-[-.045em] md:text-5xl">{title}</h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[#a9b0a4] md:text-base">{text}</p>
          {children && <div className="mt-10">{children}</div>}
        </div>
      </div>
    </section>
  );
}

export function FactGrid({ items }: { items: { label: string; text: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <article key={item.label} className="spotlight-card p-6 md:p-7">
          <span className="mb-8 block size-1.5 rounded-full bg-[#9fad7c]" />
          <h3 className="text-base font-medium">{item.label}</h3>
          <p className="mt-3 text-sm leading-6 text-[#8d968a]">{item.text}</p>
        </article>
      ))}
    </div>
  );
}
