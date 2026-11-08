import { createFileRoute, notFound } from "@tanstack/react-router";
import { Reference } from "../../tools/musicdna/web-reference";

// Local acceptance book. Production returns 404; this never authenticates a
// listener, enables V1, publishes a reading or calls a backend.
export const Route = createFileRoute("/reference")({
  ssr: false,
  head: () => ({ meta: [
    { title: "MusicDNA — Experience reference" },
    { name: "description", content: "Local acceptance states for the MusicDNA interview and saved readings." },
    { property: "og:title", content: "MusicDNA — Experience reference" },
    { property: "og:description", content: "MusicDNA interview and saved-reading acceptance states." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Reference,
});
