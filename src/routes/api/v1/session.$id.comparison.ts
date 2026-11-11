// GET /api/v1/session/:id/comparison — how a decade run compares to the original
// reading (held / flipped / new / quiet), from both frozen ledgers.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { ExploreError, exploreComparisonImpl } from "@/lib/explore.functions";

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/comparison")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          const { supabase, userId } = await verifyBearer(request);
          const c = await exploreComparisonImpl(supabase, userId, { sessionId: sid.data });
          if (!c) return errorResponse("NOT_FOUND", "Not a decade run", 404);
          return jsonResponse({
            decade: c.decade,
            root_session_id: c.rootSessionId,
            shifts: c.shifts,
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          if (e instanceof ExploreError) return errorResponse("INVALID_INPUT", msg, 400);
          if (msg === "Reading not found") return errorResponse("NOT_FOUND", msg, 404);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
