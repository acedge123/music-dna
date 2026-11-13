// POST /api/v1/session — start a new MusicDNA session for the caller.
//
// Thin transport: verify the caller's Supabase bearer, then call the same
// startSessionImpl helper the web `startSession` server fn uses. Web,
// Flutter, and future clients share one implementation.

import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { startSessionImpl } from "@/lib/musicdna.functions";
import { INTERVIEW_FLOW_HEADER } from "@/musicdna/engine/checkpoints";

export const Route = createFileRoute("/api/v1/session")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request }) => {
        try {
          const { supabase, userId } = await verifyBearer(request);
          const result = await startSessionImpl(supabase, userId, {
            client: "mobile",
            capability: request.headers.get(INTERVIEW_FLOW_HEADER),
          });
          return jsonResponse({
            session_id: result.sessionId,
            lane: result.lane,
            lane_confidence: result.lane_confidence,
            flow: result.flow,
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "interview_flow_save_failed")
            return errorResponse("PERSISTENCE_FAILED", "Couldn't start the interview. Retry.", 503);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
