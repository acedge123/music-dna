import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function acknowledgeExposure(
  client: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  pairingId: string,
  exposureId: string,
  channel: string,
) {
  const owned = await client
    .from("sessions")
    .select("user_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (owned.error || !owned.data) throw new Error("Exposure ownership unavailable");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const offered = await supabaseAdmin
    .from("pairing_exposures")
    .select("id,reported_shown_at")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("pairing_id", pairingId)
    .eq("id", exposureId)
    .maybeSingle();
  if (offered.error || !offered.data) throw new Error("Served exposure unavailable");
  if (!offered.data.reported_shown_at) {
    const updated = await supabaseAdmin
      .from("pairing_exposures")
      .update({ reported_shown_at: new Date().toISOString(), client: channel })
      .eq("id", offered.data.id)
      .is("reported_shown_at", null);
    if (updated.error) throw new Error("Exposure measurement unavailable");
  }
  return { recorded: true };
}
