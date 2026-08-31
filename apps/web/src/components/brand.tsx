import Link from "next/link";

export function Brand({
  compact = false,
  href = "/",
  variant = "default",
}: {
  compact?: boolean;
  href?: string;
  variant?: "default" | "workspace";
}) {
  if (variant === "workspace") {
    return (
      <Link aria-label="Capela workspace home" className="inline-flex items-center gap-2.5" href={href}>
        {/* <span
          aria-hidden="true"
          className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#a7b587] via-[#79b493] to-[#c8d1aa] p-px shadow-[0_12px_32px_-14px_rgba(159,173,124,.8)]"
        >
          <span className="grid size-full place-items-center rounded-[11px] bg-[#0a0a0d] text-sm font-black text-white">
            C
          </span>
        </span> */}
        <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#9fad7c]/20 bg-gradient-to-br from-[#9fad7c]/15 to-[#63e6a1]/5 text-[#9fad7c] shadow-[0_10px_32px_rgba(142,197,64,.12)] transition duration-500 group-hover:-rotate-3 group-hover:scale-105 group-hover:border-[#9fad7c]/40">
          <svg viewBox="0 0 36 36" aria-hidden="true" className="size-6" fill="none">
            <path d="M8 24.5 15.2 8l12.5 5.2-4.1 14.6L8 24.5Z" stroke="currentColor" strokeWidth="1.15" />
            <path d="m15.2 8 8.4 19.8M27.7 13.2 8 24.5" stroke="currentColor" strokeOpacity=".42" strokeWidth=".8" />
            <circle cx="15.2" cy="8" r="2.2" fill="currentColor" />
            <circle cx="27.7" cy="13.2" r="1.8" fill="#63E6A1" />
            <circle cx="23.6" cy="27.8" r="2" fill="currentColor" />
            <circle cx="8" cy="24.5" r="1.5" fill="#F7F9EF" />
          </svg>
        </span>
        {!compact && (
          <span className="text-[17px] font-bold tracking-[-0.04em] text-white">
            Capela<span className="text-[#a7b587]">°</span>
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link href={href} className="group inline-flex items-center gap-3" aria-label="Capela home">
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#9fad7c]/20 bg-gradient-to-br from-[#9fad7c]/15 to-[#63e6a1]/5 text-[#9fad7c] shadow-[0_10px_32px_rgba(142,197,64,.12)] transition duration-500 group-hover:-rotate-3 group-hover:scale-105 group-hover:border-[#9fad7c]/40">
        <svg viewBox="0 0 36 36" aria-hidden="true" className="size-6" fill="none">
          <path d="M8 24.5 15.2 8l12.5 5.2-4.1 14.6L8 24.5Z" stroke="currentColor" strokeWidth="1.15" />
          <path d="m15.2 8 8.4 19.8M27.7 13.2 8 24.5" stroke="currentColor" strokeOpacity=".42" strokeWidth=".8" />
          <circle cx="15.2" cy="8" r="2.2" fill="currentColor" />
          <circle cx="27.7" cy="13.2" r="1.8" fill="#63E6A1" />
          <circle cx="23.6" cy="27.8" r="2" fill="currentColor" />
          <circle cx="8" cy="24.5" r="1.5" fill="#F7F9EF" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="text-[17px] font-bold tracking-[-0.04em] text-white">
            Capela<span className="text-[#a7b587]">°</span>
          </span>
          <span className="mt-1.5 block text-[10px] font-medium text-[#879184]">Scientific intelligence</span>
        </span>
      )}
    </Link>
  );
}
