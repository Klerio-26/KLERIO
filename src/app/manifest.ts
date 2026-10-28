import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klerio — la paperasse, en clair",
    short_name: "Klerio",
    description: "Scanner, ranger, comprendre et traiter vos documents administratifs.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#1e5754",
    lang: "fr",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      { name: "Scanner un document", url: "/app/scan" },
      { name: "Mon coffre-fort", url: "/app/vault" },
      { name: "Demander à Klerio", url: "/app/assistant" }
    ]
  };
}
