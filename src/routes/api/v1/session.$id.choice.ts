// POST /api/v1/session/:id/choice — record a pairing choice.
//
// Body: { pairing_id, chosen_song_id, ms_to_decide? }. Delegates to
// recordChoiceImpl which updates the session vector, probe state, etc.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { ChoiceConflictError, currentReadImpl, recordChoiceImpl } from "@/lib/musicdna.functions";
import { experienceVersion } from "./-experience";

const BodySchema = z.object({
  pairing_id: z.string().uuid(),
  chosen_song_id: z.string().uuid(),
  ms_to_decide: z.number().int().nonnegative().max(600_000).optional(),
  // Client-generated retry key. Same key or same pairing → same committed result.
  mutation_id: z.string().min(8).max(64).optional(),
});

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/choice")({
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
          if (!body.success) {
            return errorResponse("INVALID_INPUT", body.error.message, 400);
          }
          const { supabase, userId } = await verifyBearer(request);
          const result = await recordChoiceImpl(supabase, userId, {
            sessionId: sid.data,
            pairingId: body.data.pairing_id,
            chosenSongId: body.data.chosen_song_id,
            msToDecide: body.data.ms_to_decide,
            mutationId: body.data.mutation_id,
          });
          if (experienceVersion(request) !== 1) {
            const { vector, verdict, why, hesitation, dim, delta } = result;
            return jsonResponse({ vector, verdict, why, hesitation, dim, delta });
          }
          const read = await currentReadImpl(supabase, userId, { sessionId: sid.data });
          return jsonResponse({
            contract: 1,
            replayed: result.replayed === true,
            feedback: { verdict: result.verdict, why: result.why },
            read: {
              tier: read.tier,
              direction: read.direction,
              thesis: read.thesis,
              hook: read.hook,
              question: read.question,
              evidence: read.evidence,
              revision: read.revision ?? null,
            },
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          if (e instanceof ChoiceConflictError) return errorResponse("CONFLICT", e.message, 409);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
