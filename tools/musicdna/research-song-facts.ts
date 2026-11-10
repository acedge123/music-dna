// Drafts verified-source song facts for the critic. Writes DRAFTS only; humans approve in admin.
// Source = the song's English Wikipedia article. The drafter may use ONLY that text, and a
// second model checks each fact against the same text (never its own memory).
// Usage: bun tools/musicdna/research-song-facts.ts --limit 100 [--dry]
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIMIT = Number(arg("--limit", "100"));
const DRY = process.argv.includes("--dry");
const KINDS = ["sound", "arrangement_production", "influences", "cultural_context", "distinctive_moment"] as const;

async function ai(model: string, prompt: string, schema: Record<string, unknown>) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, reasoning_effort: "low", messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "out", strict: true, schema } } }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return JSON.parse((await res.json()).choices[0].message.content);
}

// Wikipedia throttles bursts with a plain-text body; serialize and back off.
let wikiChain: Promise<unknown> = Promise.resolve();
async function wjson(url: string): Promise<any> {
  const run = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 400 + i * 2000));
      const res = await fetch(url, { headers: { "User-Agent": "MusicDNA-facts/1.0 (catalog research; contact admin@musicdna.fm)" } });
      const body = await res.text();
      if (res.ok && body.startsWith("{")) return JSON.parse(body);
    }
    throw new Error("wikipedia_unavailable");
  };
  const p = wikiChain.then(run, run);
  wikiChain = p.catch(() => undefined);
  return p;
}

async function wiki(title: string, artist: string) {
  const q = encodeURIComponent(`${title} ${artist} song`);
  const s = await wjson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json`);
  for (const hit of s?.query?.search ?? []) {
    const p = await wjson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(hit.title)}&format=json`);
    const page = Object.values(p?.query?.pages ?? {})[0] as { title: string; extract?: string } | undefined;
    const text = page?.extract ?? "";
    // Must be about this song: title mentioned and artist named.
    if (text.toLowerCase().includes(title.toLowerCase().replace(/\s*\(.*\)$/, "")) && text.toLowerCase().includes(artist.toLowerCase().split(/[,&]| feat/)[0].trim()))
      return { title: page!.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page!.title.replace(/ /g, "_"))}`, text: text.slice(0, 14000) };
  }
  return null;
}

const DRAFT_SCHEMA = { type: "object", additionalProperties: false, required: ["facts"], properties: { facts: { type: "array", items: {
  type: "object", additionalProperties: false, required: ["kind", "text", "quote"],
  properties: { kind: { type: "string", enum: [...KINDS] }, text: { type: "string" }, quote: { type: "string" } } } } } };
const CHECK_SCHEMA = { type: "object", additionalProperties: false, required: ["checks"], properties: { checks: { type: "array", items: {
  type: "object", additionalProperties: false, required: ["index", "verdict", "note"],
  properties: { index: { type: "integer" }, verdict: { type: "string", enum: ["supported", "unclear", "unsupported"] }, note: { type: "string" } } } } } };

async function main() {
  const { data: pairs } = await supabaseAdmin.from("pairings").select("song_a_id,song_b_id").eq("active", true).limit(2000);
  const uses = new Map<string, number>();
  for (const p of pairs ?? []) for (const id of [p.song_a_id, p.song_b_id]) uses.set(id, (uses.get(id) ?? 0) + 1);
  const { data: existing } = await supabaseAdmin.from("song_facts").select("song_id").limit(10000);
  const done = new Set((existing ?? []).map((r) => r.song_id));
  const ids = [...uses.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => !done.has(id)).slice(0, LIMIT);
  const { data: songs } = await supabaseAdmin.from("songs").select("id,title,artist,year").in("id", ids);
  const stats = { songs: 0, no_source: 0, drafted: 0, ready: 0, needs_human: 0, dropped: 0 };
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < (songs ?? []).length) {
      const s = songs![next++];
      stats.songs++;
      try {
        const src = await wiki(s.title, s.artist);
        if (!src) { stats.no_source++; continue; }
        const draft = await ai("openai/gpt-6.1-sol", `From the SOURCE TEXT ONLY, extract 3-8 vivid, specific facts a music critic could use about "${s.title}" by ${s.artist}.
Kinds: sound (instruments, vocals, tones), arrangement_production (producer, recording, structure), influences, cultural_context (reception, scene, legacy), distinctive_moment (a memorable section or moment).
Each fact: one plain sentence under 200 characters, and an exact supporting quote copied from the source. No outside knowledge. No chart numbers unless striking. Skip kinds the source doesn't cover.
SOURCE TEXT:\n${src.text}`, DRAFT_SCHEMA);
        const facts = (draft.facts as Array<{ kind: string; text: string; quote: string }>).filter((f) => f.text.length >= 8 && f.text.length <= 300);
        if (!facts.length) continue;
        const check = await ai("openai/gpt-6.1-terra", `You are a fact checker. For each FACT, decide ONLY from the SOURCE TEXT whether it is fully supported. Do not use your own knowledge. "unclear" if partly supported or overstated.
FACTS:\n${facts.map((f, i) => `${i}. ${f.text} [quote: ${f.quote}]`).join("\n")}
SOURCE TEXT:\n${src.text}`, CHECK_SCHEMA);
        const rows = [];
        for (const c of check.checks as Array<{ index: number; verdict: string; note: string }>) {
          const f = facts[c.index];
          if (!f || c.verdict === "unsupported") { stats.dropped++; continue; }
          const quoteFound = src.text.includes(f.quote.trim().slice(0, 60));
          const ready = c.verdict === "supported" && quoteFound;
          ready ? stats.ready++ : stats.needs_human++;
          rows.push({ song_id: s.id, kind: f.kind, text: f.text, source_url: src.url, source_title: `Wikipedia: ${src.title}`,
            confidence: ready ? 85 : 50, status: ready ? "draft" : "needs_human",
            check_note: `${c.verdict}${quoteFound ? "" : "; quote not found verbatim"}: ${c.note}`.slice(0, 500) });
        }
        stats.drafted += rows.length;
        if (!DRY && rows.length) { const { error } = await supabaseAdmin.from("song_facts").insert(rows); if (error) throw error; }
      } catch (e) { console.log(`fail ${s.title}: ${(e as Error).message}`); }
    }
  }));
  console.log(JSON.stringify(stats));
}
main();
