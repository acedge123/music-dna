// POST /api/v1/session/:id/skip — user doesn't recognize either song.
//
// Body: { pairing_id, ms_to_decide? }. Delegates to skipPairingImpl which
// marks the pairing as skipped (excluded from future draws), flips
// wants_wider_probe so the next bootstrap can reach outside opener lanes,
// and logs a pairing_skipped diagnostic event. Never mutates the vector.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { skipPairingImpl } from "@/lib/musicdna.functions";

const BodySchema = z.object({
  pairing_id: z.string().uuid(),
  ms_to_decide: z.number().int().nonnegative().max(600_000).optional(),
});

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/skip")({
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
          const result = await skipPairingImpl(supabase, userId, {
            sessionId: sid.data,
            pairingId: body.data.pairing_id,
            msToDecide: body.data.ms_to_decide,
          });
          return jsonResponse(result);
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
