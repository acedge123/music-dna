import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadSessionHistory, type Exchange } from "@/musicdna/adapters/session-history";

// Web resume: the caller's most recent interview (last 24h) with its full
// conversation, so a refresh lands back mid-session — and browser Back from
// chat lands on the finished result instead of a blank start screen.
export const resumeLatestSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ sessionId: z.string().uuid().optional() }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let query = supabase
      .from("sessions")
      .select("id, started_at, completed_at")
      .eq("user_id", userId);
    query = data.sessionId ? query.eq("id", data.sessionId) : query.gte("started_at", since);
    const { data: s, error } = await query
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Couldn't restore the interview. Please retry.");
    if (data.sessionId && !s) throw new Error("Reading not available for this account.");
    if (!s) return null;
    const exchanges: Exchange[] = await loadSessionHistory(supabase, s.id);
    if (!exchanges.some((e) => e.type === "choice")) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("opening_hypothesis, opening_lane")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      sessionId: s.id,
      completed: s.completed_at != null,
      exchanges,
      opener: profile
        ? { hypothesis: profile.opening_hypothesis ?? "", lane: profile.opening_lane ?? "" }
        : null,
    };
  });
