// Explicit publication consent (D03 / TGA-311). A share token alone never
// makes a reading public: public lookups require is_public = true, which only
// the owner sets by publishing. Revoking unpublishes AND rotates the token so
// any copied link dies immediately.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function newToken(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function setSharePublication(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  publish: boolean,
): Promise<{ is_public: boolean; share_token: string | null }> {
  const { data: s, error } = await supabase
    .from("sessions")
    .select("user_id, completed_at, share_token")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s || s.user_id !== userId) throw new Error("Session not found");
  if (publish && !s.completed_at) throw new Error("Finish the reading before sharing it.");

  const patch = publish
    ? { is_public: true, share_token: s.share_token ?? newToken() }
    : { is_public: false, share_token: newToken() };
  const { error: upErr } = await supabase
    .from("sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (upErr) throw new Error(upErr.message);
  return { is_public: patch.is_public, share_token: publish ? patch.share_token : null };
}
