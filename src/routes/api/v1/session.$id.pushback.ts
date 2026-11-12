// POST /api/v1/session/:id/pushback — halftime (Q3) objection, self-report only.
// GET returns saved pushback entries for restore. See experience-contract-v1.md.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { PushbackError, recordHalftimePushbackImpl } from "@/musicdna/adapters/halftime-pushback";
import { loadSessionHistory } from "@/musicdna/adapters/session-history";

const UUID = z.string().uuid();
const Body = z.object({
  text: z.string().trim().min(1).max(500),
  mutation_id: z.string().min(8).max(80),
});

export const Route = createFileRoute("/api/v1/session/$id/pushback")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          const { supabase, userId } = await verifyBearer(request);
          const s = await supabase.from("sessions").select("user_id").eq("id", sid.data).maybeSingle();
          if (!s.data || s.data.user_id !== userId) return errorResponse("NOT_FOUND", "Session not found", 404);
          const items = (await loadSessionHistory(supabase, sid.data)).filter((e) => e.type === "pushback");
          return jsonResponse({ contract: 1, pushback: items });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          return errorResponse("INTERNAL", e instanceof Error ? e.message : String(e), 500);
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
            return errorResponse("INVALID_INPUT", "Invalid pushback request", 400);
          }
          const body = Body.safeParse(raw);
          if (!body.success) return errorResponse("INVALID_INPUT", "text must be 1–500 characters and mutation_id 8–80", 400);
          const { supabase, userId } = await verifyBearer(request);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const r = await recordHalftimePushbackImpl(supabase, supabaseAdmin, userId, {
            sessionId: sid.data,
            text: body.data.text,
            mutationId: body.data.mutation_id,
          });
          return jsonResponse({ contract: 1, ...r });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          if (e instanceof PushbackError)
            return errorResponse(e.code, e.message, e.code === "NOT_FOUND" ? 404 : e.code === "MUTATION_CONFLICT" ? 409 : 500);
          return errorResponse("INTERNAL", e instanceof Error ? e.message : String(e), 500);
        }
      },
    },
  },
});
