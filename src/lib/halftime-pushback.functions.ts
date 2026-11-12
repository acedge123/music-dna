import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { halftimePushbackReply } from "@/musicdna/engine/halftime";

// Halftime pushback is the listener's own words (self-report). It is stored
// as a trusted event with its pick number and never touches votes, scores,
// the ledger or matchup selection.
export const halftimePushback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ sessionId: z.string().uuid(), message: z.string().trim().min(1).max(500) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await context.supabase
      .from("sessions")
      .select("user_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (s.error || !s.data || s.data.user_id !== context.userId) throw new Error("forbidden");
    const { count } = await context.supabase
      .from("choices")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data.sessionId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_log").insert({
      user_id: context.userId,
      session_id: data.sessionId,
      event_type: "halftime_pushback",
      props: { text: data.message, at_pick: count ?? 0, counts_as_vote: false } as never,
      client: "server",
    });
    if (error) throw new Error("Could not save your reply.");
    return { reply: halftimePushbackReply(data.message) };
  });
