import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublishedRead } from "@/musicdna/adapters/published-read";
export const getPublicSession = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const read = await loadPublishedRead(supabaseAdmin, data.token);
    if (!read) throw new Error("Session not found");
    return { session: { ...read, id: read.session_id }, definingChoices: read.defining_choices };
  });
