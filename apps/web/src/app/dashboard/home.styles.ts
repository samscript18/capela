import { vectraStyles as ui } from "@/lib/vectra-styles";

export const homeStyles = {
  page: ui.page,
  pageHeader: ui.pageHeader,
  composerEntry: `${ui.card} flex min-h-52 items-center justify-between gap-8 p-10 max-md:flex-col max-md:items-start [&>div:first-child>span]:text-[10px] [&>div:first-child>span]:font-semibold [&>div:first-child>span]:uppercase [&>div:first-child>span]:tracking-[0.14em] [&>div:first-child>span]:text-white/60 [&_h2]:mt-4 [&_h2]:mb-0 [&_h2]:max-w-[24ch] [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight md:[&_h2]:text-3xl [&_a]:inline-flex [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-full [&_a]:bg-white [&_a]:px-8 [&_a]:py-4 [&_a]:text-sm [&_a]:font-medium [&_a]:text-black [&_a]:transition-transform [&_a:hover]:scale-[1.02]`,
  overviewGrid:
    "mt-6 grid grid-cols-1 gap-6 [&>section]:relative [&>section]:min-h-96 [&>section]:overflow-hidden [&>section]:rounded-3xl [&>section]:border [&>section]:border-white/10 [&>section]:bg-[#111] [&>section]:px-8 [&>section]:py-10 [&>section]:shadow-2xl [&>aside]:relative [&>aside]:min-h-96 [&>aside]:overflow-hidden [&>aside]:rounded-3xl [&>aside]:border [&>aside]:border-white/10 [&>aside]:bg-[#111] [&>aside]:px-8 [&>aside]:py-10 [&>aside]:shadow-2xl",
  sectionHeader:
    "mb-6 flex items-center justify-between gap-4 [&>span]:text-[10px] [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-[0.14em] [&>span]:text-white/60 [&_a]:text-xs [&_a]:font-medium [&_a]:text-white/80 [&_a:hover]:text-white",
  emptyState:
    "flex min-h-72 max-w-xl flex-col items-start justify-center [&>span]:text-[10px] [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-[0.14em] [&>span]:text-white/50 [&_h2]:my-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:m-0 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-white/50",
  recentLoading:
    "grid gap-3 [&>span]:text-[10px] [&>span]:uppercase [&>span]:tracking-[0.14em] [&>span]:text-white/30 [&_div]:h-16 [&_div]:animate-pulse [&_div]:rounded-2xl [&_div]:bg-white/5",
  recentError:
    "rounded-2xl border border-[#ff7474]/20 bg-[#ff7474]/[0.06] p-4 [&>span]:text-xs [&>span]:text-[#ff8b8b] [&_p]:text-sm [&_p]:text-white/50 [&_button]:rounded-full [&_button]:border [&_button]:border-white/10 [&_button]:bg-white/5 [&_button]:px-4 [&_button]:py-2.5 [&_button]:text-xs",
  recentList:
    "m-0 grid list-none gap-3 p-0 [&_a]:grid [&_a]:grid-cols-[minmax(0,1fr)_minmax(21rem,1.1fr)] [&_a]:items-center [&_a]:gap-6 [&_a]:rounded-2xl [&_a]:border [&_a]:border-white/10 [&_a]:bg-white/5 [&_a]:p-5 [&_a]:transition-all [&_a:hover]:-translate-y-0.5 [&_a:hover]:border-white/20 [&_a:hover]:bg-white/10 max-[1280px]:[&_a]:grid-cols-1 [&_a>div]:grid [&_a>div]:min-w-0 [&_a>div]:gap-2 [&_a:hover_strong]:text-white [&_span]:font-mono [&_span]:text-[10px] [&_span]:text-white/40 [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-medium [&_strong]:text-white/90 [&_strong]:transition-colors [&_dl]:m-0 [&_dl]:grid [&_dl]:grid-cols-[0.6fr_0.8fr_0.5fr_1.2fr] [&_dl]:gap-4 max-md:[&_dl]:grid-cols-2 [&_dl_div]:grid [&_dl_div]:min-w-0 [&_dl_div]:gap-1 [&_dt]:text-[10px] [&_dt]:uppercase [&_dt]:tracking-[0.1em] [&_dt]:text-white/40 [&_dd]:m-0 [&_dd]:truncate [&_dd]:text-xs [&_dd]:capitalize [&_dd]:text-white/80",
  principles:
    "mt-2 grid list-none gap-3 p-0 [&_li]:grid [&_li]:grid-cols-[1.25rem_1fr] [&_li]:gap-3 [&_li]:rounded-2xl [&_li]:border [&_li]:border-white/10 [&_li]:bg-white/5 [&_li]:p-5 [&_li]:text-xs [&_li]:leading-relaxed [&_li]:text-white/70 [&_svg]:text-[#79b493]",
} as const;
