// GET /api/v1/songs/search?q=… — opener autocomplete over ACTIVE catalog songs.
// Public by design: returns only public catalog identity (id, title, artist,
// year) — no scores, lanes or evidence. Confirmation only; opener submission
// still sends "Title — Artist" strings to the existing opener contract.
import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { rankSongs, SONG_SEARCH_MIN_CHARS, splitQuery, type SongSuggestion } from "@/musicdna/engine/song-search";

export const Route = createFileRoute("/api/v1/songs/search")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request }) => {
        const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 120);
        if (q.trim().length < SONG_SEARCH_MIN_CHARS) return jsonResponse({ ok: true, results: [] });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { title, artist } = splitQuery(q);
          const term = (artist ? title : q.trim()).replace(/[%_,()*\\]/g, " ").trim();
          const like = `%${term}%`;
          const base = () => supabaseAdmin.from("songs").select("id,title,artist,year").eq("active", true).limit(200);
          const [byTitle, byArtist] = await Promise.all([
            base().ilike("title", like),
            artist ? Promise.resolve({ data: [], error: null }) : base().ilike("artist", like),
          ]);
          if (byTitle.error || byArtist.error) return errorResponse("INTERNAL", "Search unavailable", 500);
          const rows = [...(byTitle.data ?? []), ...(byArtist.data ?? [])] as SongSuggestion[];
          return jsonResponse({ ok: true, results: rankSongs(rows, q) });
        } catch {
          return errorResponse("INTERNAL", "Search unavailable", 500);
        }
      },
    },
  },
});
