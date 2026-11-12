// Optional follow-up to a V1 defer_read choice. Same Critic, never a new pipeline.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { currentReadImpl } from "@/lib/musicdna.functions";
import { ReadSupersededError } from "@/musicdna/adapters/read-cursor";
import { requireVisibleSession, SessionUnavailableError } from "@/musicdna/adapters/session-access";
import { HttpError, verifyBearer } from "./_auth";
import { experienceVersion } from "./-experience";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";

const Body = z
  .object({ after_pairing_id: z.string().uuid(), answered: z.number().int().min(1).max(100) })
  .strict();
export const Route = createFileRoute("/api/v1/session/$id/read")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request, params }) => {
        try {
          const sessionId = z.string().uuid().parse(params.id);
          const { supabase, userId } = await verifyBearer(request);
          if (experienceVersion(request) !== 1)
            return errorResponse("INVALID_INPUT", "Experience V1 is required", 400);
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            return errorResponse("INVALID_INPUT", "Invalid JSON body", 400);
          }
          const body = Body.parse(raw);
          const session = requireVisibleSession<{ user_id: string }>(
            await supabase.from("sessions").select("user_id").eq("id", sessionId).maybeSingle(),
          );
          if (!session || session.user_id !== userId) throw new SessionUnavailableError();
          const read = await currentReadImpl(supabase, userId, {
            sessionId,
            afterChoice: { pairingId: body.after_pairing_id, answered: body.answered },
          });
          return jsonResponse({
            contract: 1,
            after_pairing_id: body.after_pairing_id,
            answered: body.answered,
            read,
          });
        } catch (error) {
          if (error instanceof HttpError)
            return errorResponse(error.code, error.message, error.status);
          if (error instanceof SessionUnavailableError)
            return errorResponse("NOT_FOUND", error.message, 404);
          if (error instanceof ReadSupersededError)
            return errorResponse("CONFLICT", error.message, 409);
          if (error instanceof z.ZodError)
            return errorResponse("INVALID_INPUT", "Invalid read request", 400);
          return errorResponse(
            "UPSTREAM",
            "The Critic response is unavailable. You can keep choosing songs.",
            503,
          );
        }
      },
    },
  },
});
