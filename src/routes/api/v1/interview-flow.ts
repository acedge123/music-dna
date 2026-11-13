// Which interview flow clients should render. No user data.
import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, preflightResponse } from "./_cors";

export const Route = createFileRoute("/api/v1/interview-flow")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      // ?session=<id> returns the flow frozen when that interview started; omit it for new interviews.
      GET: async ({ request }) => {
        const sid = new URL(request.url).searchParams.get("session");
        const { sessionFlowImpl } = await import("@/lib/musicdna.functions");
        const on =
          (await sessionFlowImpl(sid && /^[0-9a-f-]{36}$/i.test(sid) ? sid : null)) === "checkpoints";
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
