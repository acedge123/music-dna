// Opener autocomplete ranking. Pure: active catalog first, then unscored recognition rows.
// Suggestions are confirmation only — selecting one fills "Title — Artist";
// it never changes lane/era classification, scoring or intake.

import { fuzzy } from "fast-fuzzy";

export type SongSuggestion = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  listen_count?: number;
};

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
  if (field.includes(q) && (!q.includes(" ") || ` ${field} `.includes(` ${q} `))) return 25;
  return 0;
}

function combinedScore(t: string, a: string, q: string): number {
  const titleScore = fieldScore(t, q);
  const direct = Math.max(titleScore ? titleScore + 5 : 0, fieldScore(a, q));
  const words = `${t} ${a}`.split(" ");
  const tokens = q.split(" ");
  if (
    tokens.length > 1 &&
    tokens.every((token) => words.some((word) => word.startsWith(token))) &&
    tokens.some((token) => t.split(" ").some((word) => word.startsWith(token))) &&
    tokens.some((token) => a.split(" ").some((word) => word.startsWith(token)))
  )
    return Math.max(direct, 90);
  return direct;
}

function typoScore(t: string, a: string, q: string): number {
  if (q.length < 5) return 0;
  const similarity = Math.max(
    ...[t, a, `${t} ${a}`, `${a} ${t}`].map((candidate) =>
      fuzzy(q, candidate, { useSellers: false, ignoreSymbols: false }),
    ),
  );
  return similarity >= 0.8 ? similarity * 20 : 0;
}

function recordingGroup(title: string): string {
  return normalizeQuery(
    title.replace(/\s*[-–—([]\s*(?:demo|live|remaster(?:ed)?|\d{4} remaster)[^\])]*[\])]?$/i, ""),
  );
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
  const identities = new Set<string>();
  const uniqueRows = rows.filter((row) => {
    const identity = `${normalizeQuery(row.title)}|${normalizeQuery(row.artist)}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
    return true;
  });
  for (const row of uniqueRows) {
    const t = normalizeQuery(row.title);
    const a = normalizeQuery(row.artist);
    let score: number;
    if (artist) {
      const ts = fieldScore(t, title);
      const as = fieldScore(a, artist);
      score = ts && as ? ts + as : 0;
    } else {
      score = combinedScore(t, a, whole);
    }
    if (score > 0) scored.push({ row, score });
  }
  // Bounded spelling fallback, never overriding direct matches.
  if (scored.length === 0 && !artist) {
    for (const row of uniqueRows) {
      const score = typoScore(normalizeQuery(row.title), normalizeQuery(row.artist), whole);
      if (score > 0) scored.push({ row, score });
    }
  }
  scored.sort(
    (x, y) =>
      y.score - x.score ||
      Number(recordingGroup(x.row.title) !== normalizeQuery(x.row.title)) -
        Number(recordingGroup(y.row.title) !== normalizeQuery(y.row.title)) ||
      (y.row.listen_count ?? 0) - (x.row.listen_count ?? 0) ||
      x.row.title.localeCompare(y.row.title) ||
      x.row.artist.localeCompare(y.row.artist),
  );
  const seen = new Set<string>();
  const out: SongSuggestion[] = [];
  for (const { row } of scored) {
    const key = `${recordingGroup(row.title)}|${normalizeQuery(row.artist)}`;
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
