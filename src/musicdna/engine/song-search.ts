// Opener autocomplete ranking. Pure: active catalog first, then unscored recognition rows.
// Suggestions are confirmation only — selecting one fills "Title — Artist";
// it never changes lane/era classification, scoring or intake.

export type SongSuggestion = { id: string; title: string; artist: string; year: number | null };

export const SONG_SEARCH_MIN_CHARS = 2;
export const SONG_SEARCH_LIMIT = 5;

export function normalizeQuery(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Split "Title — Artist" / "Title - Artist" / "Title by Artist" input. */
export function splitQuery(raw: string): { title: string; artist: string | null } {
  const m = raw.split(/\s+[—–-]\s+|\s+by\s+/i);
  if (m.length >= 2)
    return {
      title: normalizeQuery(m[0] ?? ""),
      artist: normalizeQuery(m.slice(1).join(" ")) || null,
    };
  return { title: normalizeQuery(raw), artist: null };
}

function fieldScore(field: string, q: string): number {
  if (!q) return 0;
  if (field === q) return 100;
  if (field.startsWith(q)) return 70;
  if (field.split(" ").some((w) => w.startsWith(q))) return 45;
  if (field.includes(q)) return 25;
  return 0;
}

export function rankSongs(
  rows: SongSuggestion[],
  raw: string,
  limit = SONG_SEARCH_LIMIT,
): SongSuggestion[] {
  const { title, artist } = splitQuery(raw);
  const whole = normalizeQuery(raw);
  if (whole.length < SONG_SEARCH_MIN_CHARS) return [];
  const scored: { row: SongSuggestion; score: number }[] = [];
  for (const row of rows) {
    const t = normalizeQuery(row.title);
    const a = normalizeQuery(row.artist);
    let score: number;
    if (artist) {
      const ts = fieldScore(t, title);
      const as = fieldScore(a, artist);
      score = ts && as ? ts + as : 0;
    } else {
      const titleScore = fieldScore(t, whole);
      score = Math.max(titleScore ? titleScore + 5 : 0, fieldScore(a, whole));
    }
    if (score > 0) scored.push({ row, score });
  }
  scored.sort(
    (x, y) =>
      y.score - x.score ||
      x.row.title.localeCompare(y.row.title) ||
      x.row.artist.localeCompare(y.row.artist),
  );
  const seen = new Set<string>();
  const out: SongSuggestion[] = [];
  for (const { row } of scored) {
    const key = `${normalizeQuery(row.title)}|${normalizeQuery(row.artist)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export function suggestionLabel(s: Pick<SongSuggestion, "title" | "artist">): string {
  return `${s.title} — ${s.artist}`;
}
