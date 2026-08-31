import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteConfig.url,
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: "%s | Capela",
  },
  description: siteConfig.description,
  keywords: [
    "molecule investigation",
    "scientific literature analysis",
    "evidence grading",
    "molecular targets",
    "biological activity",
    "research dossier",
    "AI research agent",
  ],
  authors: [{ name: "Capela" }],
  creator: "Capela",
  publisher: "Capela",
  category: "science",
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
