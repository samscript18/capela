import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Capela — AI Molecule Investigation Agent",
    short_name: "Capela",
    description:
      "Evidence-graded molecule investigations with biological activity, targets, mechanisms, and scientific citations.",
    start_url: "/",
    display: "standalone",
    background_color: "#070907",
    theme_color: "#9fad7c",
    categories: ["science", "education", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
