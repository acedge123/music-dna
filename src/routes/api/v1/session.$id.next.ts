// GET /api/v1/session/:id/next — next pairing for an in-progress session.
//
// Delegates to nextPairingImpl. Session ownership is enforced by RLS on the
// user-scoped Supabase client we mint from the bearer token.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { nextPairingImpl } from "@/lib/musicdna.functions";

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/next")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request, params }) => {
        try {
          const parsed = UUID.safeParse(params.id);
          if (!parsed.success) {
            return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          }
          // Optional ?steer=not_quite|harder — the reaction row on the client.
          // Selection hint only; it never writes to the vector.
          const rawSteer = new URL(request.url).searchParams.get("steer");
          const steer = rawSteer === "not_quite" || rawSteer === "harder" ? rawSteer : undefined;
          const { supabase } = await verifyBearer(request);
          const result = await nextPairingImpl(supabase, { sessionId: parsed.data, steer });
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
