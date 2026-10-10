import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadSessionHistory, type Exchange } from "@/musicdna/adapters/session-history";

// Web resume: the caller's most recent unfinished interview (last 24h) with
// its full conversation, so a refresh lands back mid-session.
export const resumeLatestSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: s } = await supabase
      .from("sessions")
      .select("id, started_at")
      .eq("user_id", userId)
      .is("completed_at", null)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!s) return null;
    const exchanges: Exchange[] = await loadSessionHistory(supabase, s.id);
    if (!exchanges.some((e) => e.type === "choice")) return null;
    const { data: profile } = await supabase
      .from("profiles").select("opening_hypothesis, opening_lane").eq("user_id", userId).maybeSingle();
    return {
      sessionId: s.id,
      exchanges,
      opener: profile ? { hypothesis: profile.opening_hypothesis ?? "", lane: profile.opening_lane ?? "" } : null,
    };
  });
