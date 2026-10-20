import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublicDefiningChoices } from "@/musicdna/adapters/public-evidence";
import { buildPublicReveal, type PublicRevealInput } from "@/musicdna/engine/reveal";
import { loadPublishedRead } from "@/musicdna/adapters/published-read";
export const getPublicSession = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (process.env.MUSICDNA_BACKEND_PERSISTENCE_V2 !== "1") {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        data.token,
      );

      let query = supabaseAdmin
        .from("sessions")
        .select(
          "id,share_token,is_public,started_at,completed_at,interpretation,vector,lane,archetype:archetype_id(id,name,tagline,description)",
        )
        .not("completed_at", "is", null);

      query = isUuid
        ? query.eq("id", data.token).eq("is_public", true)
        : query.eq("share_token", data.token).eq("is_public", true);

      const { data: session, error } = await query.maybeSingle();
      if (error) throw new Error(error.message);
      if (!session) throw new Error("Session not found");

      const definingChoices = await loadPublicDefiningChoices(supabaseAdmin, session.id);

      const reveal = buildPublicReveal({
        session: session as PublicRevealInput["session"],
        definingChoices,
      });

      // Keep the legacy web shape for /s/:token (session + definingChoices),
      // built from the same engine DTO so there's still one source of truth.
      return {
        session,
        definingChoices: reveal.defining_choices,
      };
    }
    const read = await loadPublishedRead(supabaseAdmin, data.token);
    if (!read) throw new Error("Session not found");
    return { session: { ...read, id: read.session_id }, definingChoices: read.defining_choices };
  });
