import type { Metadata } from "next";

const configuredUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const siteConfig = {
  name: "Capela",
  title: "Capela — AI Molecule Investigation Agent",
  description:
    "Investigate a molecule with evidence-graded scientific literature, biological activity, targets, mechanisms, and citations in one sourced research dossier.",
  url: new URL(configuredUrl),
  socialImage: "/opengraph-image",
};

export function createPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
}): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} | ${siteConfig.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: path,
      siteName: siteConfig.name,
      title: socialTitle,
      description,
      images: [
        { url: siteConfig.socialImage, width: 1200, height: 630, alt: "Capela molecule evidence dossier preview" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [siteConfig.socialImage],
    },
  };
}

export const privatePageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};
