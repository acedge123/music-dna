#!/usr/bin/env node
/**
 * Batch backfill: propose archetype_signals for untagged songs.
 *
 * Reads active songs where archetype_signals is empty (default: lanes
 * classic_rock, electronic, hip_hop, pop) and asks the Lovable AI Gateway
 * to pick 1–3 signals from the shared vocabulary based on title / artist /
 * subculture. Writes:
 *   - data/musicdna/archetype_signals_backfill_proposals.csv   (for human review)
 *   - data/musicdna/archetype_signals_backfill.sql             (apply after review)
 *
 * Nothing is written to the database. Review the CSV, edit signals as needed,
 * then apply the SQL via a migration.
 *
 * Env required:
 *   SUPABASE_URL, SB_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), LOVABLE_API_KEY
 *
 * Usage:
 *   node tools/musicdna/backfill_archetype_signals.mjs
 *   node tools/musicdna/backfill_archetype_signals.mjs --lanes=classic_rock,pop --limit=20
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

// ---------- Config ----------
const DEFAULT_LANES = ["classic_rock", "electronic", "hip_hop", "pop"];
const MODEL = "google/gemini-3.5-flash";
const CONCURRENCY = 4;

// Controlled vocabulary — the 9 canonical signals used across seeded lanes.
// Keep this in sync with tools/musicdna/generate_alternative_canon.cjs.
const SIGNAL_VOCAB = [
  { slug: "open_signal",             desc: "Anthemic, radio-friendly, invites everyone in." },
  { slug: "bassline_mystic",         desc: "Groove and low-end carry the song; body-forward." },
  { slug: "melody_maximalist",       desc: "Big memorable hooks, melody is the point." },
  { slug: "catharsis_engine",        desc: "Emotional release, loud/quiet payoff, explosive climax." },
  { slug: "texture_astronaut",       desc: "Atmosphere and sonic space over song structure." },
  { slug: "communal_lift_seeker",    desc: "Made for crowds, gospel/choir energy, collective uplift." },
  { slug: "cinematic_romantic",      desc: "Widescreen, slow-burn, film-scored feeling." },
  { slug: "forward_motion_romantic", desc: "Propulsive rhythm + emotional pull, driving yearning." },
  { slug: "beautiful_doom_seeker",   desc: "Dark, gorgeous, melancholy that feels sublime." },
];

// ---------- Args ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const lanes = args.lanes ? String(args.lanes).split(",") : DEFAULT_LANES;
const limit = args.limit ? Number(args.limit) : null;

// ---------- Env ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, LOVABLE_API_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
}

// ---------- Supabase REST helpers ----------
async function sbSelect(qs) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/songs?${qs}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------- LLM ----------
const SYSTEM = `You are a music critic tagging songs with archetype signals for a diagnostic engine.
Pick 1 to 3 signals from the CONTROLLED VOCABULARY below that best describe how this song feels to a listener.
Prefer the fewest signals that fit — 1 is often correct. Only pick 2–3 if the song genuinely spans them.
Reply with ONLY a JSON object: {"signals": ["slug1", ...], "why": "one short sentence"}.

CONTROLLED VOCABULARY:
${SIGNAL_VOCAB.map((s) => `- ${s.slug}: ${s.desc}`).join("\n")}`;

async function proposeSignals(song) {
  const user = `Song: "${song.title}" by ${song.artist} (${song.year ?? "?"})
Lane: ${song.lane}
Subculture tags: ${(song.subculture || []).join(", ") || "(none)"}

Pick 1–3 signals from the vocabulary.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
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
  try { parsed = JSON.parse(raw); } catch { parsed = { signals: [], why: "parse_error" }; }
  const valid = new Set(SIGNAL_VOCAB.map((s) => s.slug));
  const signals = (parsed.signals || [])
    .filter((s) => typeof s === "string" && valid.has(s))
    .slice(0, 3);
  return { signals, why: String(parsed.why || "").slice(0, 200) };
}

// ---------- Main ----------
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  console.log(`Lanes: ${lanes.join(", ")}${limit ? ` (limit ${limit})` : ""}`);
  const laneFilter = `lane=in.(${lanes.join(",")})`;
  const qs = [
    "select=id,title,artist,year,lane,subculture,archetype_signals",
    "active=eq.true",
    laneFilter,
    "or=(archetype_signals.is.null,archetype_signals.eq.{})",
    "order=lane.asc,artist.asc,title.asc",
    limit ? `limit=${limit}` : "",
  ].filter(Boolean).join("&");
  const songs = await sbSelect(qs);
  console.log(`Fetched ${songs.length} untagged songs.`);
  if (!songs.length) return;

  const results = new Array(songs.length);
  let done = 0;
  async function worker(i) {
    while (i < songs.length) {
      const song = songs[i];
      try {
        const proposal = await proposeSignals(song);
        results[i] = { song, ...proposal, error: null };
      } catch (e) {
        results[i] = { song, signals: [], why: "", error: String(e.message || e) };
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

  // Write CSV
  const outDir = path.join(ROOT, "data", "musicdna");
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, "archetype_signals_backfill_proposals.csv");
  const headers = ["id", "lane", "artist", "title", "year", "subculture", "proposed_signals", "why", "error"];
  const csv = [
    headers.join(","),
    ...results.map((r) => [
      r.song.id,
      r.song.lane,
      r.song.artist,
      r.song.title,
      r.song.year ?? "",
      (r.song.subculture || []).join("|"),
      r.signals.join("|"),
      r.why,
      r.error ?? "",
    ].map(csvEscape).join(",")),
  ].join("\n") + "\n";
  fs.writeFileSync(csvPath, csv);
  console.log(`Wrote proposals → ${path.relative(ROOT, csvPath)}`);

  // Write SQL migration (only for rows with ≥1 signal)
  const sqlPath = path.join(outDir, "archetype_signals_backfill.sql");
  const stmts = results
    .filter((r) => r.signals.length > 0)
    .map((r) => {
      const arr = `ARRAY[${r.signals.map((s) => `'${s}'`).join(",")}]::text[]`;
      return `UPDATE public.songs SET archetype_signals = ${arr}, updated_at = now() WHERE id = '${r.song.id}';`;
    });
  fs.writeFileSync(
    sqlPath,
    `-- Auto-generated by tools/musicdna/backfill_archetype_signals.mjs\n` +
    `-- Review the CSV before applying. ${stmts.length} songs will be updated.\n\n` +
    `BEGIN;\n${stmts.join("\n")}\nCOMMIT;\n`
  );
  console.log(`Wrote SQL       → ${path.relative(ROOT, sqlPath)}  (${stmts.length} updates)`);

  const empty = results.filter((r) => r.signals.length === 0).length;
  const errs = results.filter((r) => r.error).length;
  console.log(`Done. tagged=${results.length - empty} empty=${empty} errors=${errs}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
