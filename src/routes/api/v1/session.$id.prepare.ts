// Same reviewed preparation as web; only for an owned, actually offered pairing.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { prepareReadsImpl } from "@/lib/musicdna.functions";
import { acknowledgeExposure } from "@/musicdna/adapters/exposure";
import { verifyBearer, HttpError } from "./_auth";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";

const Body = z.object({ pairing_id: z.string().uuid(), exposure_id: z.string().uuid() }).strict();

export const Route = createFileRoute("/api/v1/session/$id/prepare")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request, params }) => {
        try {
          const sessionId = z.string().uuid().parse(params.id);
          const { supabase, userId } = await verifyBearer(request);
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            return errorResponse("INVALID_INPUT", "Invalid preparation request", 400);
          }
          const body = Body.parse(raw);
          // This existing helper verifies both ownership and the served binding.
          try {
            await acknowledgeExposure(
              supabase,
              userId,
              sessionId,
              body.pairing_id,
              body.exposure_id,
              "flutter",
            );
          } catch {
            return errorResponse("FORBIDDEN", "Offered pairing unavailable", 403);
          }
          const result = await prepareReadsImpl(supabase, userId, {
            sessionId,
            pairingId: body.pairing_id,
          });
          return jsonResponse({ contract: 1, prepared: result.prepared });
        } catch (error) {
          if (error instanceof HttpError)
            return errorResponse(error.code, error.message, error.status);
          if (error instanceof z.ZodError)
            return errorResponse("INVALID_INPUT", "Invalid preparation request", 400);
          return errorResponse(
            "UPSTREAM",
            "Preparation unavailable; choosing a song still works",
            503,
          );
        }
      },
    },
  },
});
