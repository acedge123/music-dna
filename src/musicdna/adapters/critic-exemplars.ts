import { exemplarVoiceBlock, pickExemplars, type Exemplar } from "@/musicdna/engine/critic-exemplars";

/** Extra writer system message with approved voice references; [] when the flag is off or nothing is approved. */
export async function exemplarMessages(sessionId: string): Promise<{ role: "system"; content: string }[]> {
  if (process.env.MUSICDNA_CRITIC_EXEMPLARS_V1 !== "1") return [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("critic_exemplars").select("id,text,why_it_works").eq("status", "approved").limit(200);
    if (error) return [];
    const block = exemplarVoiceBlock(pickExemplars((data ?? []) as Exemplar[], sessionId));
    return block ? [{ role: "system", content: block }] : [];
  } catch {
    return [];
  }
}
