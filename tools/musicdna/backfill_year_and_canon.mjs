#!/usr/bin/env node
/**
 * Batch backfill: propose `year` and `canon_score` for songs missing either.
 *
 * Reads active songs where `year` or `canon_score` is null and asks an LLM
 * to propose values from title / artist / subculture. Writes:
 *   - data/musicdna/year_canon_backfill_proposals.csv   (for human review)
 *   - data/musicdna/year_canon_backfill.sql             (apply after review)
 *
 * Nothing is written to the database. Review the CSV, edit as needed, then
 * apply the SQL via `supabase--insert` or a migration.
 *
 * Provider selection (pick one):
 *   --provider=lovable   (default) → Lovable AI Gateway; needs LOVABLE_API_KEY
 *   --provider=openai              → OpenAI (or any OpenAI-compatible endpoint);
 *                                    needs OPENAI_API_KEY, optional OPENAI_BASE_URL
 *
 * Env required:
 *   SUPABASE_URL, SB_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 *   + one of:
 *     LOVABLE_API_KEY                                        (provider=lovable)
 *     OPENAI_API_KEY [+ OPENAI_BASE_URL] [+ OPENAI_MODEL]    (provider=openai)
 *
 * Usage:
 *   node tools/musicdna/backfill_year_and_canon.mjs
 *   node tools/musicdna/backfill_year_and_canon.mjs --provider=openai --model=gpt-4o-mini
 *   node tools/musicdna/backfill_year_and_canon.mjs --lanes=classic_rock,pop --limit=50
 *   node tools/musicdna/backfill_year_and_canon.mjs --only=canon    # or --only=year
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

// ---------- Args ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const lanes = args.lanes ? String(args.lanes).split(",") : null;
const limit = args.limit ? Number(args.limit) : null;
const only = args.only ? String(args.only) : "both"; // both|year|canon
const provider = String(args.provider || "lovable").toLowerCase();
const CONCURRENCY = Number(args.concurrency || 4);

// ---------- Env ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SB_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// ---------- Provider setup ----------
/** @type {{ url: string, headers: Record<string,string>, model: string, label: string }} */
let providerCfg;
if (provider === "lovable") {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) { console.error("Missing LOVABLE_API_KEY (needed for --provider=lovable)"); process.exit(1); }
  providerCfg = {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    model: String(args.model || "google/gemini-3.5-flash"),
    label: "lovable",
  };
} else if (provider === "openai") {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.error("Missing OPENAI_API_KEY (needed for --provider=openai)"); process.exit(1); }
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  providerCfg = {
    url: `${base}/chat/completions`,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    model: String(args.model || process.env.OPENAI_MODEL || "gpt-4o-mini"),
    label: `openai(${base})`,
  };
} else {
  console.error(`Unknown --provider=${provider}. Use "lovable" or "openai".`);
  process.exit(1);
}

// ---------- Supabase REST helpers ----------
async function sbSelect(qs) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/songs?${qs}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------- LLM ----------
const SYSTEM = `You are a music metadata assistant. For the given song, return:
- year: integer release year of the original studio release (single or album). If unknown, null.
- canon_score: integer 0-100 measuring cultural footprint / recognition among general listeners.
    0-20   = deep cut, only fans of the artist/scene know it
    21-40  = known within the subculture, minor mainstream awareness
    41-60  = respected/known by broad music fans
    61-80  = widely recognized hit, most listeners over 25 know it
    81-100 = cultural touchstone, near-universal recognition
Base canon_score on cultural footprint (chart performance, radio play, film/TV syncs, cover versions,
lasting influence) — NOT on how good the song is.

Reply with ONLY a JSON object: {"year": 1997, "canon_score": 72, "why": "one short sentence"}.
Use null for values you genuinely don't know.`;

async function proposeMeta(song) {
  const user = `Song: "${song.title}" by ${song.artist}
Lane: ${song.lane}
Subculture tags: ${(song.subculture || []).join(", ") || "(none)"}
Known year: ${song.year ?? "unknown"}
Known canon_score: ${song.canon_score ?? "unknown"}

Fill in the missing metadata.`;

  const res = await fetch(providerCfg.url, {
    method: "POST",
    headers: providerCfg.headers,
    body: JSON.stringify({
      model: providerCfg.model,
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

  const year = Number.isFinite(parsed.year) && parsed.year >= 1900 && parsed.year <= 2100
    ? Math.round(parsed.year) : null;
  const canon = Number.isFinite(parsed.canon_score) && parsed.canon_score >= 0 && parsed.canon_score <= 100
    ? Math.round(parsed.canon_score) : null;
  return { year, canon_score: canon, why: String(parsed.why || "").slice(0, 200) };
}

// ---------- Main ----------
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  console.log(`Provider: ${providerCfg.label}  model=${providerCfg.model}`);
  console.log(`Scope: only=${only}${lanes ? ` lanes=${lanes.join(",")}` : ""}${limit ? ` limit=${limit}` : ""}`);

  // Build filter: rows missing whatever the user asked for.
  const missingClauses =
    only === "year"  ? "year=is.null"
    : only === "canon" ? "canon_score=is.null"
    : "or=(year.is.null,canon_score.is.null)";

  const parts = [
    "select=id,title,artist,year,canon_score,lane,subculture",
    "active=eq.true",
    lanes ? `lane=in.(${lanes.join(",")})` : "",
    missingClauses,
    "order=lane.asc,artist.asc,title.asc",
    limit ? `limit=${limit}` : "",
  ].filter(Boolean);
  const songs = await sbSelect(parts.join("&"));
  console.log(`Fetched ${songs.length} songs missing metadata.`);
  if (!songs.length) return;

  const results = new Array(songs.length);
  let done = 0;
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= songs.length) return;
      const song = songs[i];
      try {
        const proposal = await proposeMeta(song);
        results[i] = { song, ...proposal, error: null };
      } catch (e) {
        results[i] = { song, year: null, canon_score: null, why: "", error: String(e.message || e) };
      }
      done++;
      if (done % 10 === 0 || done === songs.length) {
        process.stdout.write(`\r  ${done}/${songs.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  process.stdout.write("\n");

  // Write CSV
  const outDir = path.join(ROOT, "data", "musicdna");
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, "year_canon_backfill_proposals.csv");
  const headers = ["id","lane","artist","title","current_year","current_canon","proposed_year","proposed_canon","why","error"];
  const csv = [
    headers.join(","),
    ...results.map((r) => [
      r.song.id, r.song.lane, r.song.artist, r.song.title,
      r.song.year ?? "", r.song.canon_score ?? "",
      r.year ?? "", r.canon_score ?? "",
      r.why, r.error ?? "",
    ].map(csvEscape).join(",")),
  ].join("\n") + "\n";
  fs.writeFileSync(csvPath, csv);
  console.log(`Wrote proposals → ${path.relative(ROOT, csvPath)}`);

  // Write SQL — only fields that were actually missing get filled in.
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
    `-- Provider: ${providerCfg.label}  model=${providerCfg.model}\n` +
    `-- Review the CSV before applying. ${stmts.length} rows will be updated.\n\n` +
    `BEGIN;\n${stmts.join("\n")}\nCOMMIT;\n`
  );
  console.log(`Wrote SQL       → ${path.relative(ROOT, sqlPath)}  (${stmts.length} updates)`);

  const errs = results.filter((r) => r.error).length;
  console.log(`Done. proposals=${results.length} sql_updates=${stmts.length} errors=${errs}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
