import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = { title: "Profile", ...privatePageMetadata };

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
