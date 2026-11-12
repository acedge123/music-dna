// POST /api/v1/session/:id/refine { "operation_id"?: string } — start "Refine My DNA":
// six more picks whose reading is cumulative with the original. Drive it with
// /next, /choice, /skip, /reveal like any session.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { ExploreError, startRefineImpl } from "@/lib/explore.functions";

const UUID = z.string().uuid();
const Body = z.object({ operation_id: z.string().min(8).max(80).nullable().optional() });

export const Route = createFileRoute("/api/v1/session/$id/refine")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          let raw: unknown = {};
          try {
            const text = await request.text();
            raw = text.trim() ? JSON.parse(text) : {};
          } catch {
            return errorResponse("INVALID_INPUT", "Invalid JSON body", 400);
          }
          const body = Body.safeParse(raw);
          if (!body.success) return errorResponse("INVALID_INPUT", body.error.message, 400);
          const { supabase, userId } = await verifyBearer(request);
          const r = await startRefineImpl(supabase, userId, {
            sessionId: sid.data,
            startKey: body.data.operation_id ?? null,
          });
          return jsonResponse({ session_id: r.sessionId, mode: "refine", replayed: r.replayed });
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
