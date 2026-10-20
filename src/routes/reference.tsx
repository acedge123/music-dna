import { createFileRoute, notFound } from "@tanstack/react-router";
import { Reference } from "../../tools/musicdna/web-reference";

// Local acceptance book. Production returns 404; this never authenticates a
// listener, enables V1, publishes a reading or calls a backend.
export const Route = createFileRoute("/reference")({
  ssr: false,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Reference,
});
