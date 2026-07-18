#!/usr/bin/env node
/**
 * Batch backfill: propose `year` and `canon_score` for songs missing them.
 *
 * - year: release year of the recording (integer, 1950..current)
 * - canon_score: 0-100 cultural footprint / recognizability, matching the
 *   style used to seed country + r_and_b (see generate_alternative_canon.cjs).
 *
 * Reads active songs where year IS NULL OR canon_score IS NULL, asks the
 * Lovable AI Gateway for both fields (skipping any that are already set),
 * and writes:
 *   - data/musicdna/year_canon_backfill_proposals.csv   (human review)
 *   - data/musicdna/year_canon_backfill.sql             (apply after review)
 *
 * Env: SUPABASE_URL, SB_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), LOVABLE_API_KEY
 *
 * Usage:
 *   node tools/musicdna/backfill_year_and_canon.mjs
 *   node tools/musicdna/backfill_year_and_canon.mjs --limit=20
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const MODEL = "google/gemini-3.5-flash";
const CONCURRENCY = 4;
const CURRENT_YEAR = new Date().getFullYear();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const limit = args.limit ? Number(args.limit) : null;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, LOVABLE_API_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
}

async function sbSelect(qs) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/songs?${qs}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  return res.json();
}

const SYSTEM = `You are a music historian assigning two fields to a song for a diagnostic engine.

Return ONLY a JSON object of the form:
{"year": <int|null>, "canon_score": <int 0-100|null>, "why": "one short sentence"}

FIELD DEFINITIONS
- year: the release year of the ORIGINAL studio recording (single/album), 1950..${CURRENT_YEAR}.
  If uncertain within ±2 years, still give your best estimate. Return null only if
  you truly cannot identify the song.
- canon_score: 0-100 cultural footprint / recognizability to a broad music-fan
  audience today. Use this scale:
    90-100 = universally known standard (e.g. "Billie Jean", "Smells Like Teen Spirit")
    75-89  = major hit, most fans of the genre know it instantly
    60-74  = well-known deep cut or genre landmark
    45-59  = respected but not a household track
    30-44  = fan-favorite / cult
    15-29  = obscure to most listeners
    0-14   = deep obscurity
  Consider chart performance, cultural reuse (film/TV/sampling), streaming
  footprint, and critical stature. Do NOT inflate for personal taste.`;

async function propose(song) {
  const needYear = song.year == null;
  const needCanon = song.canon_score == null;
  const user = `Song: "${song.title}" by ${song.artist}
Lane: ${song.lane}${song.year != null ? `\nKnown year: ${song.year}` : ""}${song.canon_score != null ? `\nKnown canon_score: ${song.canon_score}` : ""}

Fill ${[needYear && "year", needCanon && "canon_score"].filter(Boolean).join(" and ")}.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }

  let year = null;
  if (needYear) {
    const y = Number(parsed.year);
    if (Number.isInteger(y) && y >= 1950 && y <= CURRENT_YEAR) year = y;
  }
  let canon = null;
  if (needCanon) {
    const c = Number(parsed.canon_score);
    if (Number.isFinite(c) && c >= 0 && c <= 100) canon = Math.round(c);
  }
  return { year, canon_score: canon, why: String(parsed.why || "").slice(0, 200) };
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const qs = [
    "select=id,title,artist,year,canon_score,lane,subculture",
    "active=eq.true",
    "or=(year.is.null,canon_score.is.null)",
    "order=lane.asc,artist.asc,title.asc",
    limit ? `limit=${limit}` : "",
  ].filter(Boolean).join("&");
  const songs = await sbSelect(qs);
  console.log(`Fetched ${songs.length} songs missing year and/or canon_score.`);
  if (!songs.length) return;

  const results = new Array(songs.length);
  let done = 0;
  async function worker(i) {
    while (i < songs.length) {
      const song = songs[i];
      try {
        const p = await propose(song);
        results[i] = { song, ...p, error: null };
      } catch (e) {
        results[i] = { song, year: null, canon_score: null, why: "", error: String(e.message || e) };
      }
      done++;
      if (done % 10 === 0 || done === songs.length) {
        process.stdout.write(`\r  ${done}/${songs.length}`);
      }
      i += CONCURRENCY;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, k) => worker(k)));
  process.stdout.write("\n");

  const outDir = path.join(ROOT, "data", "musicdna");
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, "year_canon_backfill_proposals.csv");
  const headers = ["id", "lane", "artist", "title", "existing_year", "proposed_year", "existing_canon", "proposed_canon", "why", "error"];
  const csv = [
    headers.join(","),
    ...results.map((r) => [
      r.song.id, r.song.lane, r.song.artist, r.song.title,
      r.song.year ?? "", r.year ?? "",
      r.song.canon_score ?? "", r.canon_score ?? "",
      r.why, r.error ?? "",
    ].map(csvEscape).join(",")),
  ].join("\n") + "\n";
  fs.writeFileSync(csvPath, csv);
  console.log(`Wrote proposals → ${path.relative(ROOT, csvPath)}`);

  const stmts = [];
  for (const r of results) {
    const sets = [];
    if (r.year != null && r.song.year == null) sets.push(`year = ${r.year}`);
    if (r.canon_score != null && r.song.canon_score == null) sets.push(`canon_score = ${r.canon_score}`);
    if (!sets.length) continue;
    sets.push("updated_at = now()");
    stmts.push(`UPDATE public.songs SET ${sets.join(", ")} WHERE id = '${r.song.id}';`);
  }
  const sqlPath = path.join(outDir, "year_canon_backfill.sql");
  fs.writeFileSync(
    sqlPath,
    `-- Auto-generated by tools/musicdna/backfill_year_and_canon.mjs\n` +
    `-- Review the CSV before applying. ${stmts.length} songs will be updated.\n\n` +
    `BEGIN;\n${stmts.join("\n")}\nCOMMIT;\n`
  );
  console.log(`Wrote SQL       → ${path.relative(ROOT, sqlPath)}  (${stmts.length} updates)`);

  const missingYear = results.filter((r) => r.song.year == null && r.year == null).length;
  const missingCanon = results.filter((r) => r.song.canon_score == null && r.canon_score == null).length;
  const errs = results.filter((r) => r.error).length;
  console.log(`Done. still_missing_year=${missingYear} still_missing_canon=${missingCanon} errors=${errs}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
