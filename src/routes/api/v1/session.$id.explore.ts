// GET  /api/v1/session/:id/explore — decade options + past decade runs for a reading.
// POST /api/v1/session/:id/explore { "decade": 1980 } — start an "Explore your DNA" run.
// The new run is a normal session: drive it with /next, /choice, /skip, /reveal.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { ExploreError, exploreOptionsImpl, startExploreImpl } from "@/lib/explore.functions";

const UUID = z.string().uuid();
const Body = z.object({
  decade: z.number().int(),
  operation_id: z.string().min(8).max(80).nullable().optional(),
});

export const Route = createFileRoute("/api/v1/session/$id/explore")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          const { supabase, userId } = await verifyBearer(request);
          const o = await exploreOptionsImpl(supabase, userId, { sessionId: sid.data });
          return jsonResponse({
            root_session_id: o.rootSessionId,
            decades: o.decades,
            runs: o.runs.map((r) => ({
              session_id: r.id,
              decade: r.decade,
              completed: r.completed,
              started_at: r.startedAt,
            })),
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          if (e instanceof ExploreError) return errorResponse("INVALID_INPUT", msg, 400);
          if (msg === "Reading not found") return errorResponse("NOT_FOUND", msg, 404);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            return errorResponse("INVALID_INPUT", "Invalid JSON body", 400);
          }
          const body = Body.safeParse(raw);
          if (!body.success) return errorResponse("INVALID_INPUT", body.error.message, 400);
          const { supabase, userId } = await verifyBearer(request);
          const r = await startExploreImpl(supabase, userId, {
            sessionId: sid.data,
            decade: body.data.decade,
            startKey: body.data.operation_id ?? null,
          });
          return jsonResponse({
            session_id: r.sessionId,
            mode: "explore",
            decade: body.data.decade,
            replayed: r.replayed,
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
