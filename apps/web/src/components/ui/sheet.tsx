"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export function SheetContent({
  className,
  children,
  title = "Panel",
  ...props
}: ComponentProps<typeof Dialog.Content> & { title?: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <Dialog.Content
        className={cn(
          "sheet-panel fixed inset-y-3 right-3 z-50 w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101310]/95 p-6 shadow-[0_35px_100px_rgba(0,0,0,.72)] backdrop-blur-2xl outline-none",
          className,
        )}
        {...props}
      >
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {children}
        <Dialog.Close
          aria-label="Close panel"
          className="absolute right-5 top-5 grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.04] text-[#a9b0a4] transition hover:border-[#9fad7c]/25 hover:bg-[#9fad7c]/[.08] hover:text-white"
        >
          <X size={20} />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
