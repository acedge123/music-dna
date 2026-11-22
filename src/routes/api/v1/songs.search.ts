// GET /api/v1/songs/search?q=… — active scored songs + unscored recognition identities.
// Public by design: returns only public catalog identity (id, title, artist,
// year) — no scores, lanes or evidence. Confirmation only; opener submission
// still sends "Title — Artist" strings to the existing opener contract.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import {
  rankSongs,
  SONG_SEARCH_MIN_CHARS,
  splitQuery,
  type SongSuggestion,
} from "@/musicdna/engine/song-search";

export const Route = createFileRoute("/api/v1/songs/search")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request }) => {
        const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 120);
        if (q.trim().length < SONG_SEARCH_MIN_CHARS) return jsonResponse({ ok: true, results: [] });
        try {
          const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
          const key =
            process.env["SUPABASE_PUBLISHABLE_KEY"] ||
            process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
            process.env["VITE_SUPABASE_ANON_KEY"];
          if (!url || !key) return errorResponse("INTERNAL", "Search unavailable", 500);
          // Public identities use the caller-independent public read policies, not admin access.
          const db = createClient<Database>(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: (input, init) => {
                const headers = new Headers(init?.headers);
                if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
                  headers.delete("Authorization");
                headers.set("apikey", key);
                return fetch(input, { ...init, headers });
              },
            },
          });
          const { title, artist } = splitQuery(q);
          const term = (artist ? title : q.trim()).replace(/[%_,()*\\]/g, " ").trim();
          const like = `%${term}%`;
          const base = () =>
            db
              .from("songs")
              .select("id,title,artist,year")
              .eq("active", true)
              .order("title")
              .order("id")
              .limit(200);
          const recognition = () =>
            db
              .from("song_recognition")
              .select("id,title,artist,year")
              .order("listen_count", { ascending: false })
              .order("id")
              .limit(200);
          const [byTitle, byArtist, recognizedTitle, recognizedArtist] = await Promise.all([
            base().ilike("title", like),
            artist ? Promise.resolve({ data: [], error: null }) : base().ilike("artist", like),
            recognition().ilike("title", like),
            artist
              ? Promise.resolve({ data: [], error: null })
              : recognition().ilike("artist", like),
          ]);
          if (byTitle.error || byArtist.error || recognizedTitle.error || recognizedArtist.error)
            return errorResponse("INTERNAL", "Search unavailable", 500);
          // Imported album dates are not confirmed original recording years. Do not display them as such.
          const rows = [
            ...(byTitle.data ?? []),
            ...(byArtist.data ?? []),
            ...[...(recognizedTitle.data ?? []), ...(recognizedArtist.data ?? [])].map((row) => ({
              ...row,
              year: null,
            })),
          ] as SongSuggestion[];
          return jsonResponse({ ok: true, results: rankSongs(rows, q) });
        } catch {
          return errorResponse("INTERNAL", "Search unavailable", 500);
        }
      },
    },
  },
});
