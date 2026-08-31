import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 text-sm font-bold tracking-[-.01em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#9fad7c]/15 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "action-sheen border-[#b8c493]/45 bg-[#9fad7c] text-[#10140d] shadow-[0_12px_36px_rgba(104,122,78,.16)] hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-[#b4c18f] hover:shadow-[0_16px_42px_rgba(104,122,78,.22)] active:translate-y-0 active:scale-[.98]",
        secondary:
          "border-white/[.14] bg-white/[.06] text-white shadow-[inset_0_1px_rgba(255,255,255,.04)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-[#9fad7c]/30 hover:bg-[#9fad7c]/[.09]",
        ghost: "border-transparent bg-transparent text-[#c2c9bf] hover:bg-white/[.06] hover:text-white",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  className,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
