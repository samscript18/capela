import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/how-it-works", "/methodology", "/pricing"],
      disallow: ["/dashboard", "/notifications", "/profile", "/settings"],
    },
    sitemap: new URL("/sitemap.xml", siteConfig.url).href,
    host: siteConfig.url.origin,
  };
}
