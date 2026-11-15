import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

// Use the owner from a caller-visible session, never a client-supplied owner.
export async function loadOpenerAnalysis(client: Client, ownerId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("opening_analysis_json")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw new Error("Couldn't load your opening songs. Please retry.");
  return data?.opening_analysis_json ?? null;
}

export async function saveOpeningProfile(
  client: Client,
  ownerId: string,
  values: {
    opening_songs: string[];
    opening_hypothesis: string;
    opening_lane: string;
    opening_lane_confidence: number;
    opening_analysis_json: Json;
  },
) {
  const { data, error } = await client
    .from("profiles")
    .update(values)
    .eq("user_id", ownerId)
    .select("user_id, opening_songs, opening_analysis_json")
    .maybeSingle();
  if (
    error ||
    data?.user_id !== ownerId ||
    JSON.stringify(data.opening_songs) !== JSON.stringify(values.opening_songs) ||
    !data.opening_analysis_json
  ) {
    throw new Error("Couldn't save your opening songs. Please retry.");
  }
  return data.opening_analysis_json;
}