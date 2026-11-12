// Static Critic waiting lines so Flutter renders the exact web copy. No user data.
import { createFileRoute } from "@tanstack/react-router";
import {
  FILLER_NEUTRAL,
  FILLER_PERSON,
  FILLER_REACTION,
  FILLER_SKIP,
} from "@/musicdna/engine/critic-fillers";
import { jsonResponse, preflightResponse } from "./_cors";

export const Route = createFileRoute("/api/v1/critic-fillers")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async () =>
        jsonResponse({
          contract: 1,
          version: "fillers-v1",
          neutral: FILLER_NEUTRAL,
          reaction: FILLER_REACTION,
          person: FILLER_PERSON,
          skip: FILLER_SKIP,
        }),
    },
  },
});
