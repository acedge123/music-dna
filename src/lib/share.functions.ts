import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublicDefiningChoices } from "@/musicdna/adapters/public-evidence";
import { buildPublicReveal, type PublicRevealInput } from "@/musicdna/engine/reveal";

// Public read of a single completed session, addressed by an opaque share_token
// (NOT by the internal session UUID). The token is generated server-side, has
// no relationship to the auth user, and is only minted for completed readings
// the user explicitly shared. No PII surfaced.
//
// Thin wrapper: DB fetch here, DTO shaping in engine/reveal.ts. The REST
// endpoint /api/v1/share/:token calls the exact same `buildPublicReveal`.
export const getPublicSession = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({
      // Accept either the share_token (hex string) or — for back-compat with
      // old links — a session UUID. UUIDs are only honored if the session is
      // explicitly marked is_public.
      token: z.string().min(8).max(64),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.token);

    let query = supabaseAdmin
      .from("sessions")
      .select(
        "id,share_token,is_public,started_at,completed_at,interpretation,vector,lane,archetype:archetype_id(id,name,tagline,description)",
      )
      .not("completed_at", "is", null);

    query = isUuid
      ? query.eq("id", data.token).eq("is_public", true)
      : query.eq("share_token", data.token);

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
  });
