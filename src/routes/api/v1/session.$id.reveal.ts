// POST /api/v1/session/:id/reveal — finalize a session and return the reveal.
//
// Delegates to finalizeSessionImpl, which now internally uses the engine's
// pure assignArchetype for scoring/margin/flagging. Same code path as web.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { finalSynthesisImpl, finalizeSessionImpl } from "@/lib/musicdna.functions";
import { experienceVersion } from "./-experience";

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/reveal")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          const { supabase, userId } = await verifyBearer(request);
          const raw = await request.text();
          let input: unknown = {};
          try { input = raw.trim() ? JSON.parse(raw) : {}; }
          catch { return errorResponse("INVALID_INPUT", "Invalid reveal request", 400); }
          const body = z
            .object({ finish_early: z.boolean().optional() })
            .safeParse(input);
          if (!body.success) return errorResponse("INVALID_INPUT", "Invalid reveal request", 400);
          const result = await finalizeSessionImpl(supabase, userId, {
            sessionId: sid.data,
            finishEarly: body.data.finish_early,
          });
          if (experienceVersion(request) !== 1) return jsonResponse(result);
          const synth = await finalSynthesisImpl(supabase, userId, { sessionId: sid.data });
          const allowed = (result as { allowed_claims?: unknown[] }).allowed_claims ?? [];
          return jsonResponse({
            contract: 1,
            result_version: synth.result_version ?? null,
            reveal: synth.reveal ?? null,
            outcome: allowed.length > 0 ? "supported" : "insufficient_evidence",
            headline: synth.synthesis,
            voice_version: synth.voice_version ?? "claim-language-v1",
            audit_text: synth.audit_text ?? synth.synthesis,
            narration_status: synth.narration_status ?? "ok",
            supporting_choices: synth.kept_choosing,
            tension: synth.counter_reads[0] ?? null,
            full: result,
            share_token: (result as { share_token?: string }).share_token ?? null,
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "An initial reading needs four answered choices.") return errorResponse("INVALID_INPUT", msg, 400);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
