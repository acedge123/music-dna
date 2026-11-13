// Which interview flow clients should render. No user data.
import { createFileRoute } from "@tanstack/react-router";
import { checkpointsEnabled } from "@/musicdna/engine/checkpoints";
import { jsonResponse, preflightResponse } from "./_cors";

export const Route = createFileRoute("/api/v1/interview-flow")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async () => {
        const on = checkpointsEnabled(process.env.MUSICDNA_CRITIC_CHECKPOINTS);
        return jsonResponse({
          contract: 1,
          flow: on ? "checkpoints" : "per_pick",
          checkpoints: on ? [{ index: 1, after_answered: 2, actions: ["continue"] }, { index: 2, after_answered: 4, actions: ["finish", "continue"] }] : [],
          finish_early_min_answered: on ? 4 : null,
        });
      },
    },
  },
});
