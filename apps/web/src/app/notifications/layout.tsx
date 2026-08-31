import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = { title: "Notifications", ...privatePageMetadata };

export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
