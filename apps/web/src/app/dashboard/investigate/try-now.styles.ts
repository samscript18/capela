import { vectraStyles as ui } from "@/lib/vectra-styles";

export const tryNowStyles = {
  page: `${ui.page} relative isolate`,
  header: `${ui.pageHeader} relative overflow-hidden rounded-[2rem] border border-white/[.06] bg-black/20 p-[clamp(1.5rem,5vw,3.5rem)] backdrop-blur-xl [&>div:first-child]:flex [&>div:first-child]:flex-wrap [&>div:first-child]:gap-3 [&>div:first-child_span]:inline-flex [&>div:first-child_span]:items-center [&>div:first-child_span]:gap-2 [&>div:first-child_span]:rounded-full [&>div:first-child_span]:border [&>div:first-child_span]:border-[#c8d1aa]/15 [&>div:first-child_span]:bg-[#9fad7c]/[.06] [&>div:first-child_span]:px-3 [&>div:first-child_span]:py-1.5 [&>div:first-child_span]:text-[10px] [&>div:first-child_span]:font-bold [&>div:first-child_span]:uppercase [&>div:first-child_span]:tracking-[0.14em] [&>div:first-child_span]:text-[#c8d1aa]`,
  workspace: "grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6 max-lg:grid-cols-1",
  composer: `${ui.card} min-w-0 overflow-hidden border-[#c8d1aa]/10 bg-[#0d0e11]/90 shadow-[0_40px_100px_-55px_rgba(121,180,147,.75)] backdrop-blur-xl`,
  allowance:
    "m-4 flex items-center justify-between gap-5 rounded-3xl border border-[#9fad7c]/15 bg-gradient-to-br from-[#9fad7c]/[0.09] to-[#79b493]/[0.03] p-5 max-sm:flex-col max-sm:items-start [&>div:first-child]:grid [&>div:first-child]:gap-1.5 [&_span]:text-[10px] [&_span]:font-bold [&_span]:uppercase [&_span]:tracking-[0.14em] [&_span]:text-[#c8d1aa] [&_strong]:text-base [&_strong]:font-semibold [&_p]:m-0 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:text-white/50",
  allowanceMeter:
    "flex shrink-0 gap-2 [&_span]:block [&_span]:size-3 [&_span]:rounded-full [&_span]:border [&_span]:border-white/10 [&_span]:bg-white/[0.04] [&_span[data-available=true]]:border-[#79b493]/40 [&_span[data-available=true]]:bg-[#79b493] [&_span[data-available=true]]:shadow-[0_0_16px_rgba(121,180,147,0.45)]",
  connectionNotice:
    "mx-4 rounded-2xl border border-[#f2d66b]/20 bg-[#f2d66b]/[.06] px-5 py-4 text-xs leading-6 text-[#f5e69d]/75",
  modePicker:
    "m-4 grid grid-cols-2 gap-3 border-0 p-0 max-sm:grid-cols-1 [&_legend]:mb-3 [&_legend]:text-[10px] [&_legend]:font-bold [&_legend]:uppercase [&_legend]:tracking-[0.14em] [&_legend]:text-white/45 [&_label]:relative [&_label]:cursor-pointer [&_label]:rounded-3xl [&_label]:border [&_label]:border-white/[0.06] [&_label]:bg-white/[0.02] [&_label]:p-5 [&_label]:transition-all [&_label:has(input:checked)]:border-[#9fad7c]/30 [&_label:has(input:checked)]:bg-[#9fad7c]/[0.08] [&_input]:absolute [&_input]:top-4 [&_input]:right-4 [&_input]:accent-[#9fad7c] [&_label>span]:grid [&_label>span]:gap-2 [&_strong]:pr-6 [&_strong]:text-sm [&_strong]:font-semibold [&_small]:max-w-xs [&_small]:text-xs [&_small]:leading-relaxed [&_small]:text-white/45",
  tabs: "flex gap-2 overflow-x-auto border-y border-white/[0.05] bg-black/10 p-4 [&_button]:inline-flex [&_button]:items-center [&_button]:justify-center [&_button]:gap-2 [&_button]:rounded-full [&_button]:border [&_button]:border-white/[0.05] [&_button]:bg-white/[0.02] [&_button]:px-5 [&_button]:py-3 [&_button]:text-sm [&_button]:font-medium [&_button]:text-white/60 [&_button]:transition-all [&_button:hover]:-translate-y-0.5 [&_button:hover]:bg-white/[0.05]",
  activeTab: "!border-[#9fad7c]/25 !bg-[#9fad7c]/10 !text-[#c8d1aa] shadow-[0_0_30px_rgba(159,173,124,0.08)]",
  primaryInput: `grid gap-3 p-1 [&>label]:text-[12px] [&>label]:font-bold [&>label]:uppercase [&>label]:tracking-[0.14em] [&>label]:text-white/60 [&>input]:min-h-14 ${ui.field}`,
  options: "grid grid-cols-2 gap-4 border-t border-white/[0.05] p-6 max-md:grid-cols-1 md:p-8",
  automaticField:
    "grid gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 [&>span]:text-[10px] [&>span]:font-bold [&>span]:uppercase [&>span]:tracking-[0.12em] [&>span]:text-white/45 [&>strong]:text-sm [&>strong]:font-semibold [&>p]:m-0 [&>p]:text-[11px] [&>p]:leading-relaxed [&>p]:text-white/35",
  fieldError: "m-0 text-[11px] text-[#ff7474]",
  errorState:
    "m-6 rounded-2xl border border-[#ff7474]/20 bg-[#ff7474]/[.06] p-5 [&_strong]:text-xs [&_strong]:text-[#ff8b8b] [&_span]:font-mono [&_span]:text-[10px] [&_span]:text-white/35 [&_p]:text-sm [&_p]:text-white/50",
  activeState:
    "m-6 rounded-2xl border border-[#f2d66b]/20 bg-[#f2d66b]/[.06] p-5 [&_strong]:text-xs [&_strong]:text-[#f2d66b] [&_p]:text-sm [&_p]:text-white/50 [&_a]:text-xs [&_a]:font-semibold [&_a]:text-[#f5e69d]",
  submitRow:
    "flex items-center justify-between gap-6 border-t border-white/[0.05] p-6 [&>span]:text-[11px] [&>span]:text-white/35 [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-gradient-to-r [&_button]:from-[#a7b587] [&_button]:to-[#79b493] [&_button]:px-5 [&_button]:py-3 [&_button]:text-sm [&_button]:font-medium [&_button]:text-[#10140d] [&_button]:transition-all [&_button:hover]:scale-[1.02] [&_button:disabled]:opacity-50",
  guidance: `${ui.card} sticky top-24 overflow-hidden border-[#79b493]/10 bg-[radial-gradient(circle_at_100%_0%,rgba(121,180,147,.09),transparent_18rem),rgba(13,14,17,.9)] p-6 backdrop-blur-xl max-lg:static [&_span]:text-[12px] [&_span]:font-bold [&_span]:uppercase [&_span]:tracking-[0.14em] [&_span]:text-[#79b493] [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_dl]:m-0 [&_dl]:mt-6 [&_dl]:grid [&_dl]:gap-3 [&_dl_div]:grid [&_dl_div]:gap-2 [&_dl_div]:rounded-2xl [&_dl_div]:border [&_dl_div]:border-white/[0.04] [&_dl_div]:bg-white/[0.025] [&_dl_div]:p-4 [&_dt]:text-[12px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-[0.1em] [&_dt]:text-white/80 [&_dd]:m-0 [&_dd]:text-sm [&_dd]:leading-relaxed [&_dd]:text-white/70`,
  limit:
    "mt-6 border-t border-white/[0.05] pt-5 [&_span]:text-[12px] [&_span]:font-bold [&_span]:uppercase [&_span]:tracking-[0.1em] [&_span]:text-white/80 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-white/60",
} as const;
