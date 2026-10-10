// MusicDNA — SupabaseGateway adapter.
//
// Thin implementation of the engine's SupabaseGateway port over a real
// SupabaseClient. Owns SELECT projection strings so the engine never sees
// PostgREST syntax.
//
// Import protection: this file lives under src/musicdna/adapters/ and only
// touches a SupabaseClient passed in by the caller — no direct import of
// @/integrations/supabase/client.server. Callers decide user-scoped vs admin.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseGateway } from "@/musicdna/engine/ports";
import type { Lane, Pairing, SongLite, Vector } from "@/musicdna/engine/types";

const SONG_COLS = "id,title,artist,year,primary_lane,lane";

export function createSupabaseGateway(supabase: SupabaseClient<Database>): SupabaseGateway {
  return {
    async getSession(sessionId) {
      const { data, error } = await supabase
        .from("sessions")
        .select("id,user_id,lane,vector,completed_at,archetype_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.id as string,
        user_id: data.user_id as string,
        lane: (data.lane ?? "general") as Lane,
        vector: (data.vector ?? {}) as Vector,
        completed_at: (data.completed_at as string | null) ?? null,
        archetype_id: (data.archetype_id as string | null) ?? null,
      };
    },

    async getSongs(ids) {
      if (!ids.length) return [];
      const { data, error } = await supabase.from("songs").select(SONG_COLS).in("id", ids);
      if (error) throw new Error(error.message);
      return (data ?? []) as SongLite[];
    },

    async getPairing(pairingId) {
      const { data, error } = await supabase
        .from("pairings")
        .select(`id, song_a:song_a_id(${SONG_COLS}), song_b:song_b_id(${SONG_COLS})`)
        .eq("id", pairingId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as unknown as {
        id: string;
        song_a: SongLite | null;
        song_b: SongLite | null;
      };
      if (!row.song_a || !row.song_b) return null;
      return { id: row.id, song_a: row.song_a, song_b: row.song_b } satisfies Pairing;
    },
  };
}
