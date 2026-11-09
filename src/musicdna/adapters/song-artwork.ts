import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Artwork = { image_url: string; album_title: string | null; release_mbid: string | null; source: string; attribution: string | null };
type ArtworkRow = Pick<Database["public"]["Tables"]["song_artwork"]["Row"], "song_id" | "image_url" | "release_title" | "release_mbid" | "source" | "attribution" | "display_enabled" | "match_status" | "rights_status" | "rights_reference">;

export function approvedArtwork(row: ArtworkRow): Artwork | null {
  if (!row.display_enabled || row.match_status !== "verified" || !["licensed", "permission_granted"].includes(row.rights_status) || !row.rights_reference?.trim() || !row.image_url?.startsWith("https://")) return null;
  return { image_url: row.image_url, album_title: row.release_title, release_mbid: row.release_mbid, source: row.source, attribution: row.attribution };
}

// RLS uses the caller, never an admin client. Fail-soft: art cannot interrupt the interview.
export async function withPairingArtwork<T>(supabase: SupabaseClient<Database>, pairing: T): Promise<T> {
  if (!pairing || typeof pairing !== "object") return pairing;
  const p = pairing as Record<string, unknown>;
  const songs = [p.song_a, p.song_b].filter((s): s is Record<string, unknown> => Boolean(s && typeof s === "object"));
  const ids = songs.map((s) => s.id).filter((id): id is string => typeof id === "string");
  const artworks = new Map<string, Artwork>();
  try {
    if (ids.length) {
      const { data, error } = await supabase.from("song_artwork").select("song_id,image_url,release_title,release_mbid,source,attribution,display_enabled,match_status,rights_status,rights_reference").in("song_id", ids).eq("display_enabled", true).eq("match_status", "verified").in("rights_status", ["licensed", "permission_granted"]);
      if (!error) for (const row of data ?? []) { const art = approvedArtwork(row); if (art) artworks.set(row.song_id, art); }
    }
  } catch { /* Optional catalog decoration must never block a pick. */ }
  const attach = (s: unknown) => s && typeof s === "object" ? { ...s, artwork: artworks.get(String((s as Record<string, unknown>).id)) ?? null } : s;
  return { ...p, song_a: attach(p.song_a), song_b: attach(p.song_b) } as T;
}