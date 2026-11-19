// Static Critic waiting lines so Flutter renders the exact web copy. No user data.
import { createFileRoute } from "@tanstack/react-router";
import {
  FILLER_NEUTRAL,
  FILLER_PERSON,
  FILLER_OVERTIME,
  FILLER_REACTION,
  FILLER_DECADE,
  FILLER_SKIP,
  SKIP_OLD,
  SKIP_YOUNG,
} from "@/musicdna/engine/critic-fillers";
import { jsonResponse, preflightResponse } from "./_cors";
import { PICK_QUIP_PATTERN, QUIP_INTERVAL_MS } from "@/lib/critic-wait";

export const Route = createFileRoute("/api/v1/critic-fillers")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async () =>
        jsonResponse({
          contract: 1,
          version: "fillers-v1",
          pacing_version: "six-pick-overtime-v1",
          interval_ms: QUIP_INTERVAL_MS,
          pick_patterns: PICK_QUIP_PATTERN,
          overtime: FILLER_OVERTIME,
          neutral: FILLER_NEUTRAL,
          reaction: FILLER_REACTION,
          person: FILLER_PERSON,
          decade: FILLER_DECADE,
          skip: FILLER_SKIP,
          skip_young: SKIP_YOUNG,
          skip_old: SKIP_OLD,
        }),
    },
  },
});
