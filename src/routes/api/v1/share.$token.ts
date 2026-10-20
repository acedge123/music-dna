import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { loadPublicDefiningChoices } from "@/musicdna/adapters/public-evidence";
import { buildPublicReveal, type PublicRevealInput } from "@/musicdna/engine/reveal";
import { loadPublishedRead } from "@/musicdna/adapters/published-read";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
export const Route = createFileRoute("/api/v1/share/$token")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ params }) => {
        const token = z.string().min(8).max(64).safeParse(params.token);
        if (!token.success) return errorResponse("INVALID_INPUT", "Invalid token", 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          if (process.env.MUSICDNA_BACKEND_PERSISTENCE_V2 !== "1") {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              token.data,
            );
            let query = supabaseAdmin
              .from("sessions")
              .select(
                "id,share_token,is_public,started_at,completed_at,interpretation,vector,lane,archetype:archetype_id(id,name,tagline,description)",
              )
              .not("completed_at", "is", null);

            query = isUuid
              ? query.eq("id", token.data).eq("is_public", true)
              : query.eq("share_token", token.data).eq("is_public", true);

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
          }
          const read = await loadPublishedRead(supabaseAdmin, token.data);
          return read ? jsonResponse(read) : errorResponse("NOT_FOUND", "Session not found", 404);
        } catch {
          return errorResponse("UPSTREAM", "Could not load the published reading", 502);
        }
      },
    },
  },
});
