// Which interview flow clients should render.
// No `session`: the flow a NEW interview would get (no auth, no user data).
// `?session=<id>`: bearer + ownership required; returns that interview's saved flow, or an
// error if it can't be read — never the current flag.
import { createFileRoute } from "@tanstack/react-router";
import {
  assignInterviewFlow,
  INTERVIEW_FLOW_HEADER,
  type InterviewFlow,
} from "@/musicdna/engine/checkpoints";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function body(flow: InterviewFlow, saved: boolean) {
  const on = flow === "checkpoints";
  return {
    contract: 1,
    flow,
    saved,
    checkpoints: on
      ? [
          { index: 1, after_answered: 2, actions: ["continue"] },
          { index: 2, after_answered: 4, actions: ["finish", "continue"] },
        ]
      : [],
    finish_early_min_answered: on ? 4 : null,
  };
}

export const Route = createFileRoute("/api/v1/interview-flow")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request }) => {
        const sid = new URL(request.url).searchParams.get("session");
        if (sid === null) {
          const flow = assignInterviewFlow({
            flag: process.env.MUSICDNA_CRITIC_CHECKPOINTS,
            client: "mobile",
            capability: request.headers.get(INTERVIEW_FLOW_HEADER),
          });
          return jsonResponse(body(flow, false));
        }
        if (!UUID.test(sid)) return errorResponse("BAD_REQUEST", "Invalid session id.", 400);
        try {
          const { supabase, userId } = await verifyBearer(request);
          const { sessionFlowImpl } = await import("@/lib/musicdna.functions");
          return jsonResponse(body(await sessionFlowImpl(supabase, userId, sid), true));
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "not_found") return errorResponse("NOT_FOUND", "Session not found.", 404);
          return errorResponse("FLOW_LOOKUP_FAILED", "Couldn't read this interview's flow. Retry.", 503);
        }
      },
    },
  },
});
