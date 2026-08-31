import type { ReactNode } from "react";

export function AppPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-10 grid w-full gap-7 border-b border-white/[.075] pb-9 pt-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#a7b587] before:size-1.5 before:rounded-full before:bg-[#9fad7c]">
          {eyebrow}
        </span>
        <h1 className="mt-4 max-w-[20ch] text-[clamp(2.55rem,5vw,4.5rem)] font-semibold leading-[1.02] tracking-[-.055em]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base sm:leading-7">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center lg:justify-end">{action}</div> : null}
    </header>
  );
}
