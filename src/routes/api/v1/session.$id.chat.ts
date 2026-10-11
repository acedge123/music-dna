// /api/v1/session/:id/chat — the critic conversation over REST (CHAT01/02, D04).
//
// POST { message, mutation_id? } submits one turn and returns the critic's
// reply. A retried submit with the same mutation_id replays the saved reply
// (`replayed: true`) instead of double-posting — same contract as choices.
// Chat is self-report: it never changes the session's scores or the frozen
// version-1 result; each refinement is saved as a new `chat_self_report`
// result version with `base_version` pointing at the original.
//
// GET returns the chronological transcript plus the session's result
// versions, so a client can restore the conversation and its revisions.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { chatTurnImpl } from "@/lib/musicdna.functions";

const BodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  mutation_id: z.string().max(80).optional(),
});
const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/chat")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
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
          const body = BodySchema.safeParse(raw);
          if (!body.success) return errorResponse("INVALID_INPUT", body.error.message, 400);
          const { supabase, userId } = await verifyBearer(request);

          let r;
          try {
            r = await chatTurnImpl(supabase, userId, {
              message: body.data.message,
              sessionId: sid.data,
              mutationId: body.data.mutation_id,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg === "forbidden") return errorResponse("FORBIDDEN", msg, 403);
            throw e;
          }
          return jsonResponse({
            contract: 1,
            reply: r.reply,
            session_id: r.sessionId,
            replayed: r.replayed === true,
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
      GET: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          const { supabase, userId } = await verifyBearer(request);

          const { data: owned, error: ownErr } = await supabase
            .from("sessions")
            .select("user_id")
            .eq("id", sid.data)
            .maybeSingle();
          if (ownErr) return errorResponse("INTERNAL", ownErr.message, 500);
          if (!owned) return errorResponse("NOT_FOUND", "Session not found", 404);
          if (owned.user_id !== userId) return errorResponse("FORBIDDEN", "forbidden", 403);

          const { data: rows, error: msgErr } = await supabase
            .from("chat_messages")
            .select("role, content, created_at")
            .eq("session_id", sid.data)
            .order("created_at", { ascending: true })
            .limit(200);
          if (msgErr) return errorResponse("INTERNAL", msgErr.message, 500);

          const { data: versions, error: verErr } = await supabase
            .from("session_results")
            .select("version, source, base_version, created_at")
            .eq("session_id", sid.data)
            .order("version", { ascending: true });
          if (verErr) return errorResponse("INTERNAL", verErr.message, 500);

          return jsonResponse({
            contract: 1,
            session_id: sid.data,
            messages: (rows ?? []).map((m) => ({
              role: m.role,
              content: m.content,
              created_at: m.created_at,
            })),
            result_versions: (versions ?? []).map((v) => ({
              version: v.version,
              source: v.source,
              base_version: v.base_version,
              created_at: v.created_at,
            })),
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
