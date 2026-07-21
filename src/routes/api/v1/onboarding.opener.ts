// POST /api/v1/onboarding/opener — post-signup opening analysis.
//
// Signup itself lives in Supabase Auth (web: @supabase/supabase-js, mobile:
// supabase_flutter). This route is what a client calls AFTER signing up: it
// takes 3 opening songs, runs the LLM opening analysis, and persists the
// result to the caller's `profiles` row so /api/v1/session can seed a
// session. Same code path web onboarding uses (`commitOpeningThreeImpl`) —
// one implementation, many transports.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { commitOpeningThreeImpl } from "@/lib/musicdna.functions";

const BodySchema = z.object({
  songs: z.array(z.string().trim().min(1).max(200)).length(3),
});

export const Route = createFileRoute("/api/v1/onboarding/opener")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request }) => {
        try {
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
          const analysis = await commitOpeningThreeImpl(supabase, userId, {
            songs: body.data.songs,
          });
          return jsonResponse({
            ok: true,
            lane: analysis.lane,
            confidence: analysis.confidence,
            lane_confidence: analysis.confidence,
            hypothesis: analysis.hypothesis,
            reaction: analysis.reaction,
            observation: analysis.observation,
            reasoning: analysis.reasoning,
            secondary_lanes: analysis.secondary_lanes,
            candidate_dimensions: analysis.candidate_dimensions,
            per_song: analysis.per_song,
            canon_matches: analysis.canon_matches,
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
