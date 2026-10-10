// GET /api/v1/share/:token
//
// Public read of a completed session by its opaque share token. This is the
// v1 REST surface for the same data src/lib/share.functions.ts serves the
// web via createServerFn — both paths call the same pure buildPublicReveal
// helper in the engine, so there is one implementation to change.
//
// Backwards compatible with old links: a token that looks like a UUID is
// treated as a session id and only honored when the session is is_public.

import { loadPublicDefiningChoices } from "@/musicdna/adapters/public-evidence";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildPublicReveal, type PublicRevealInput } from "@/musicdna/engine/reveal";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";

const TokenSchema = z.string().min(8).max(64);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/v1/share/$token")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ params }) => {
        const parsed = TokenSchema.safeParse(params.token);
        if (!parsed.success) {
          return errorResponse("INVALID_INPUT", "Invalid token", 400);
        }
        const token = parsed.data;
        const isUuid = UUID_RE.test(token);

        // Route files are client-reachable — load the admin client inside the
        // handler to keep it out of the client bundle graph.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let query = supabaseAdmin
          .from("sessions")
          .select(
            "id,share_token,is_public,started_at,completed_at,interpretation,vector,lane,archetype:archetype_id(id,name,tagline,description)",
          )
          .not("completed_at", "is", null);

        query = isUuid
          ? query.eq("id", token).eq("is_public", true)
          : query.eq("share_token", token);

        const { data: session, error } = await query.maybeSingle();
        if (error) return errorResponse("UPSTREAM", error.message, 502);
        if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);

        let definingChoices;
        try {
          definingChoices = await loadPublicDefiningChoices(supabaseAdmin, session.id);
        } catch (e) {
          return errorResponse("UPSTREAM", e instanceof Error ? e.message : String(e), 502);
        }

        const reveal = buildPublicReveal({
          session: session as PublicRevealInput["session"],
          definingChoices,
        });

        return jsonResponse(reveal);
      },
    },
  },
});
