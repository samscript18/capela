"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDeleteInvestigation } from "@/lib/api";
import { cn } from "@/lib/utils";

export function DeleteInvestigationButton({ id, name, className }: { id: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteInvestigation(id);
  const router = useRouter();

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !remove.isPending && setOpen(next)}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-full border border-[#ff7474]/20 bg-[#ff7474]/[.045] px-3 text-[10px] font-semibold text-[#ff8b8b] transition hover:border-[#ff7474]/35 hover:bg-[#ff7474]/10",
            className,
          )}
        >
          <Trash2 aria-hidden="true" size={14} />
          Delete investigation
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-100 bg-black/75 backdrop-blur-md" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-101 w-[min(92vw,38rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/[.08] bg-[#0f1012] p-6 shadow-[0_35px_100px_rgba(0,0,0,.75)] sm:p-9">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#ff8b8b]">
              Permanent deletion
            </span>
            <Dialog.Close
              aria-label="Close dialog"
              disabled={remove.isPending}
              className="grid size-10 place-items-center rounded-full border-0 bg-white/[.045] text-white/70"
            >
              <X aria-hidden="true" size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Title className="mt-7 text-2xl font-semibold tracking-[-.035em]">
            Delete this investigation?
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-white/50">
            This permanently removes the investigation for {name}, its dossier, extracted evidence, and related
            notifications. This action cannot be undone.
          </Dialog.Description>
          {remove.isError && (
            <p
              role="alert"
              className="mt-5 rounded-2xl border border-[#ff7474]/20 bg-[#ff7474]/[.06] p-4 text-xs text-red-200"
            >
              {remove.error.message}
            </p>
          )}
          <footer className="mt-8 flex flex-wrap justify-end gap-2">
            <Dialog.Close
              disabled={remove.isPending}
              className="min-h-11 rounded-full border border-white/10 bg-white/[.04] px-5 text-xs! font-medium text-white/70"
            >
              Keep investigation
            </Dialog.Close>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    setOpen(false);
                    router.replace("/dashboard/investigations");
                  },
                })
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#ff7474]/30 bg-[#ff7474]/10 px-5 text-xs! font-semibold text-red-200 transition hover:bg-[#ff7474]/15 disabled:opacity-40"
            >
              {remove.isPending ? (
                <LoaderCircle aria-hidden="true" size={15} className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" size={15} />
              )}
              {remove.isPending ? "Deleting investigation…" : "Delete permanently"}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
