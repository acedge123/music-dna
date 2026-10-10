// POST /api/v1/session/:id/react — the in-interview reaction row (REA01).
//
// Body: { kind: "thats_me" | "not_quite" | "harder", pairing_id? }.
// Records the reaction and returns its effect. Reactions are never song votes
// and never touch the vector:
//   thats_me  → pacing only; the current pairing stays.
//   not_quite → replace the outstanding pairing with a retest/counterexample.
//   harder    → replace it with a harder matchup on the same question.
// When no eligible alternative exists the effect says so honestly.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { recordReactionImpl } from "@/lib/musicdna.functions";
import { nextV1 } from "./-experience";

const BodySchema = z.object({
  kind: z.enum(["thats_me", "not_quite", "harder"]),
  pairing_id: z.string().uuid().optional(),
  mutation_id: z.string().max(80).optional(),
});
const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/react")({
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
            r = await recordReactionImpl(supabase, userId, {
              sessionId: sid.data,
              kind: body.data.kind,
              pairingId: body.data.pairing_id ?? null,
              mutationId: body.data.mutation_id ?? null,
              client: "rest",
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg === "Session not found") return errorResponse("NOT_FOUND", msg, 404);
            throw e;
          }
          return jsonResponse({
            contract: 1,
            effect: r.effect,
            message: r.message,
            next: r.next ? nextV1(r.next as Parameters<typeof nextV1>[0]) : null,
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
