// Operator-only read pass: no database writes, downloads, keys or display activation.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { releaseCandidates, type Recording } from "../../src/musicdna/artwork/matching";

const input = process.argv[2];
const output = process.argv[3];
const max = Number(process.argv[4] ?? 100);
if (!input || !output) throw new Error("Usage: bun tools/musicdna/match-artwork.ts catalog.json report.json [max-new-songs]");
const songs = JSON.parse(readFileSync(input, "utf8")) as { id: string; title: string; artist: string; year: string | number | null }[];
type Result = Record<string, unknown> & { song_id: string };
const rows: Result[] = existsSync(output) ? JSON.parse(readFileSync(output, "utf8")).rows : [];
const done = new Set(rows.map((r) => r.song_id));
const cache = "/tmp/musicdna-artwork/cache";
mkdirSync(cache, { recursive: true });
let lastRequest = 0;
async function request(url: string, rateLimited = false): Promise<{ data: unknown; status: number }> {
  const key = `${cache}/${Buffer.from(url).toString("base64url")}.json`;
  if (existsSync(key)) return JSON.parse(readFileSync(key, "utf8"));
  for (let attempt = 0; attempt < 3; attempt++) {
    if (rateLimited) { await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (Date.now() - lastRequest)))); lastRequest = Date.now(); }
    try {
      const response = await fetch(url, { headers: { "User-Agent": "MusicDNA-CatalogReview/1.0 (https://www.musicdna.fm)", Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) { await new Promise((r) => setTimeout(r, 2200 * (attempt + 1))); continue; }
      const result = { status: response.status, data: response.ok ? await response.json() : null };
      if (response.ok || response.status === 404) writeFileSync(key, JSON.stringify(result));
      return result;
    } catch { if (attempt === 2) return { status: 0, data: null }; }
  }
  return { status: 0, data: null };
}
let processed = 0;
for (const song of songs) {
  if (done.has(song.id)) continue;
  if (processed++ >= max) break;
  const quote = (s: string) => `"${s.replace(/["\\]/g, " ")}"`;
  const params = new URLSearchParams({ query: `recording:${quote(song.title)} AND artist:${quote(song.artist)}`, fmt: "json", limit: "100" });
  const mb = await request(`https://musicbrainz.org/ws/2/recording/?${params}`, true);
  const payload = mb.data as { recordings?: Recording[]; count?: number } | null;
  const candidates = releaseCandidates({ ...song, year: Number(song.year) || null }, payload?.recordings ?? []);
  let result: Result = { song_id: song.id, title: song.title, artist: song.artist, match_status: mb.status === 200 ? "not_found" : "upstream_error", checked_at: new Date().toISOString(), rights_status: "unreviewed", display_enabled: false, search_count: payload?.count ?? null, search_truncated: (payload?.count ?? 0) > 100 };
  for (const { recording, release } of candidates.slice(0, 3)) {
    const caa = await request(`https://coverartarchive.org/release/${release.id}`);
    const front = (caa.data as { images?: { front?: boolean; approved?: boolean; thumbnails?: Record<string, string>; image?: string }[] } | null)?.images?.find((i) => i.front && i.approved);
    const image = front?.thumbnails?.["500"] ?? front?.thumbnails?.large ?? front?.image;
    result = { ...result, recording_mbid: recording.id, release_mbid: release.id, release_title: release.title, release_artist: song.artist, release_date: release.date ?? null, match_score: recording.score ?? null, match_status: "candidate", artwork_available: Boolean(image), candidate_image_url: image?.replace(/^http:/, "https:") ?? null, archive_status: caa.status };
    if (image) break;
  }
  rows.push(result);
  const summary = { total_catalog: songs.length, checked: rows.length, candidates_with_artwork: rows.filter((r) => r.artwork_available).length, candidates_without_artwork: rows.filter((r) => r.match_status === "candidate" && !r.artwork_available).length, not_found: rows.filter((r) => r.match_status === "not_found").length, upstream_errors: rows.filter((r) => r.match_status === "upstream_error").length };
  writeFileSync(output, JSON.stringify({ version: "musicdna-artwork-review-v1", summary, rows }, null, 2) + "\n");
  console.log(`${rows.length}/${songs.length} ${song.artist} — ${song.title}: ${result.match_status}${result.artwork_available ? " + artwork" : ""}`);
}