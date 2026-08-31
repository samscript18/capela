import { vectraStyles as ui } from "@/lib/vectra-styles";

export const investigationHistoryStyles = {
  page: ui.pageMedium,
  header: `${ui.pageHeader} [&_h1]:text-3xl! md:[&_h1]:text-4xl!`,
  filters: `${ui.card} flex flex-wrap items-end gap-4 p-5 [&_label]:grid [&_label]:gap-2 [&_label]:text-xs [&_label]:font-medium [&_label]:text-white/40 [&_select]:min-w-40 [&_select]:rounded-full [&_select]:border [&_select]:border-white/10 [&_select]:bg-white/[0.04] [&_select]:px-4 [&_select]:py-3 [&_a]:ml-auto [&_a]:rounded-full [&_a]:bg-gradient-to-r [&_a]:from-[#a7b587] [&_a]:to-[#71805d] [&_a]:px-5 [&_a]:py-3 [&_a]:text-xs [&_a]:font-medium [&_a]:text-white`,
  list: "mt-6 overflow-x-auto rounded-3xl border border-white/[0.05] bg-white/[0.015]",
  listHeader:
    "grid min-w-[860px] grid-cols-[minmax(18rem,1.5fr)_7rem_8rem_6rem_10rem_5rem] items-center gap-5 border-b border-white/[0.06] px-5 py-4 [&>span]:text-[10px] [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-[0.1em] [&>span]:text-white/30",
  record:
    "grid min-w-[860px] grid-cols-[minmax(18rem,1.5fr)_7rem_8rem_6rem_10rem_5rem] items-center gap-5 border-b border-white/[0.04] bg-white/[0.015] p-5 transition-colors duration-300 last:border-b-0 hover:bg-white/[0.04] [&>div]:min-w-0 [&>div>span]:block [&>div>span]:font-mono [&>div>span]:text-[10px] [&>div>span]:text-white/30 [&_strong]:mt-1.5 [&_strong]:block [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-medium [&>span]:truncate [&>span]:text-xs [&>span]:text-white/40 [&>a]:inline-flex [&>a]:w-fit [&>a]:items-center [&>a]:justify-center [&>a]:gap-1.5 [&>a]:justify-self-end [&>a]:rounded-full [&>a]:border [&>a]:border-white/10 [&>a]:bg-white/[0.04] [&>a]:px-3 [&>a]:py-2 [&>a]:text-xs [&>a]:font-medium [&>a]:text-[#b8c493]",
  loading:
    "grid gap-3 py-8 [&>span]:text-[10px] [&>span]:uppercase [&>span]:tracking-[0.14em] [&>span]:text-white/30 [&>div]:h-20 [&>div]:animate-pulse [&>div]:rounded-2xl [&>div]:bg-white/[0.04]",
  error: `${ui.state} [&_h2]:text-2xl! [&_button]:rounded-full [&_button]:border [&_button]:border-white/10 [&_button]:bg-white/[0.04] [&_button]:px-5 [&_button]:py-3 [&_button]:text-sm [&_button]:font-medium`,
  empty: `${ui.state} [&_h2]:text-2xl! [&_a]:inline-flex [&_a]:rounded-full [&_a]:border-0 [&_a]:bg-gradient-to-r [&_a]:from-[#a7b587] [&_a]:to-[#71805d] [&_a]:px-5 [&_a]:py-3 [&_a]:text-sm [&_a]:font-medium [&_a]:text-white`,
} as const;
