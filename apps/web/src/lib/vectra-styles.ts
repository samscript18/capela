export const vectraStyles = {
  page: "mx-auto max-w-7xl",
  pageNarrow: "mx-auto max-w-5xl",
  pageMedium: "mx-auto max-w-6xl",
  pageHeader:
    "mb-10 max-w-4xl py-2 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-2 [&>span]:text-xs [&>span]:font-bold [&>span]:uppercase [&>span]:tracking-[0.18em] [&>span]:text-[#a7b587] [&>span]:before:inline-flex [&>span]:before:size-1.5 [&>span]:before:rounded-full [&>span]:before:bg-[#9fad7c] [&_h1]:mt-4 [&_h1]:mb-0 [&_h1]:max-w-[18ch] [&_h1]:text-3xl [&_h1]:leading-[1.1] [&_h1]:font-semibold [&_h1]:tracking-tight md:[&_h1]:text-4xl [&>p]:mt-4 [&>p]:max-w-2xl [&>p]:text-base [&>p]:leading-relaxed [&>p]:text-white/70",
  card: "relative overflow-hidden rounded-3xl border border-white/10 bg-[#111] shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl",
  nested: "rounded-2xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10",
  iconTile: "grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/90",
  label: "text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55",
  field:
    "grid gap-2 text-sm font-semibold text-white/70 [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-white/10 [&_input]:bg-white/5 [&_input]:px-4 [&_input]:outline-none [&_input]:transition-all [&_input:focus]:border-white/30 [&_input:focus]:bg-white/10 [&_input:focus]:shadow-[0_0_0_4px_rgba(255,255,255,0.05)] [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-white/10 [&_textarea]:bg-white/5 [&_textarea]:p-4 [&_textarea]:outline-none [&_textarea]:transition-all [&_textarea:focus]:border-white/30 [&_textarea:focus]:bg-white/10 [&_textarea:focus]:shadow-[0_0_0_4px_rgba(255,255,255,0.05)] [&_select]:min-h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-white/10 [&_select]:bg-white/5 [&_select]:px-4 [&_select]:outline-none [&_select:focus]:border-white/30",
  primaryAction:
    "inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-white px-6 py-3 text-center text-sm font-medium text-black shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  secondaryAction:
    "inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white/90 transition-all duration-200 hover:border-white/20 hover:bg-white/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  state:
    "rounded-3xl border border-white/10 bg-[#111] p-8 shadow-2xl [&>span]:text-[12px] [&>span]:font-bold [&>span]:uppercase [&>span]:tracking-[0.14em] [&>span]:text-white/60 [&_h1]:mt-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-2xl [&_h2]:font-bold [&_p]:max-w-2xl [&_p]:text-base [&_p]:font-medium [&_p]:leading-relaxed [&_p]:text-white/60",
  dialog:
    "w-full max-w-3xl rounded-3xl border border-white/10 bg-[#111] p-7 shadow-2xl [&_h2]:text-2xl [&_h2]:font-bold [&_p]:text-base [&_p]:font-medium [&_p]:leading-relaxed [&_p]:text-white/60",
} as const;
