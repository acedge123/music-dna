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
          // Identity-only RPC, not broader anonymous access to the scored table.
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
          const { data, error } = await db.rpc("musicdna_public_song_search", { p_query: q });
          if (error) return errorResponse("INTERNAL", "Search unavailable", 500);
          const rows: SongSuggestion[] = data ?? [];
          const results = rankSongs(rows, q).map(({ id, title, artist, year }) => ({
            id,
            title,
            artist,
            year,
          }));
          return jsonResponse({ ok: true, results });
        } catch {
          return errorResponse("INTERNAL", "Search unavailable", 500);
        }
      },
    },
  },
});
