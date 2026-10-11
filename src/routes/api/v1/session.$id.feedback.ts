// /api/v1/session/:id/feedback — result feedback over REST (RES06, TGA-313).
//
// POST { accuracy?, rating?, comment?, target?, most_accurate_sentence?,
//        least_accurate_sentence?, result_version?, mutation_id? }
// records feedback bound to the exact result version the listener saw.
// One row per (user, session, target): resubmitting updates it. A retry with
// the same mutation_id replays the saved row (`replayed: true`).
//
// GET returns the caller's feedback rows for the session.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { submitFeedbackImpl } from "@/lib/musicdna.functions";

const UUID = z.string().uuid();
const BodySchema = z.object({
  accuracy: z
    .enum(["accurate", "not_accurate", "mixed", "partly", "wrong"])
    .nullable()
    .optional(),
  rating: z.number().int().min(-1).max(1).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  target: z.string().max(120).nullable().optional(),
  most_accurate_sentence: z.string().max(1000).nullable().optional(),
  least_accurate_sentence: z.string().max(1000).nullable().optional(),
  result_version: z.number().int().min(1).nullable().optional(),
  mutation_id: z.string().max(80).optional(),
});

export const Route = createFileRoute("/api/v1/session/$id/feedback")({
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

          const { data: owned, error: ownErr } = await supabase
            .from("sessions")
            .select("user_id")
            .eq("id", sid.data)
            .maybeSingle();
          if (ownErr) return errorResponse("INTERNAL", ownErr.message, 500);
          if (!owned) return errorResponse("NOT_FOUND", "Session not found", 404);
          if (owned.user_id !== userId) return errorResponse("FORBIDDEN", "forbidden", 403);

          const r = await submitFeedbackImpl(supabase, userId, {
            ...body.data,
            session_id: sid.data,
          });
          return jsonResponse({
            contract: 1,
            id: r.id,
            updated: r.updated,
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
          const { data: rows, error } = await supabase
            .from("result_feedback")
            .select(
              "id, accuracy, rating, comment, target, result_version, most_accurate_sentence, least_accurate_sentence, created_at",
            )
            .eq("user_id", userId)
            .eq("session_id", sid.data)
            .order("created_at", { ascending: true });
          if (error) return errorResponse("INTERNAL", error.message, 500);
          return jsonResponse({ contract: 1, session_id: sid.data, feedback: rows ?? [] });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
