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
import { nextPairingImpl } from "@/lib/musicdna.functions";
import { nextV1 } from "./-experience";

const BodySchema = z.object({
  kind: z.enum(["thats_me", "not_quite", "harder"]),
  pairing_id: z.string().uuid().optional(),
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
          try { raw = await request.json(); } catch { return errorResponse("INVALID_INPUT", "Invalid JSON body", 400); }
          const body = BodySchema.safeParse(raw);
          if (!body.success) return errorResponse("INVALID_INPUT", body.error.message, 400);
          const { supabase, userId } = await verifyBearer(request);

          const { data: session } = await supabase
            .from("sessions").select("user_id, completed_at").eq("id", sid.data).maybeSingle();
          if (!session || session.user_id !== userId) return errorResponse("NOT_FOUND", "Session not found", 404);

          await supabase.from("event_log").insert({
            user_id: userId,
            session_id: sid.data,
            pairing_id: body.data.pairing_id ?? null,
            event_type: "reaction_submitted",
            client: "rest",
            props: { kind: body.data.kind } as never,
          });

          if (body.data.kind === "thats_me" || session.completed_at) {
            return jsonResponse({
              contract: 1,
              effect: "pacing_only",
              message: body.data.kind === "thats_me" ? "Noted. Let's keep pushing on it." : "Session's done — push back on the reading instead.",
              next: null,
            });
          }

          const steer = body.data.kind === "harder" ? "harder" : "not_quite";
          const r = await nextPairingImpl(supabase, { sessionId: sid.data, steer });
          const next = nextV1(r as Parameters<typeof nextV1>[0]);
          const replaced = !!next.pairing;
          return jsonResponse({
            contract: 1,
            effect: replaced ? (steer === "harder" ? "harder_pairing" : "retest_pairing") : "no_alternative",
            message: replaced
              ? steer === "harder" ? "Fine. Try this one." : "Alright — other side of the same question."
              : "Nothing in the catalog tests that differently right now. Your call on the next one stands.",
            next,
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
