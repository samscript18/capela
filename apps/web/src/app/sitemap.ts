import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

const publicRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/how-it-works", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/methodology", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.65, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map(({ path, priority, changeFrequency }) => ({
    url: new URL(path, siteConfig.url).href,
    priority,
    changeFrequency,
  }));
}
