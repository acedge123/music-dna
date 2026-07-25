import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assignArchetype } from "@/musicdna/engine/archetypes";
import { CRITIC_PERSONA as PERSONA, CRITIC_VOICE_EDITORIAL as VOICE } from "@/musicdna/engine/critic";
import { callLovableAi, DEFAULT_MODEL as MODEL } from "@/musicdna/adapters/llm-gateway";
import { recommendForSession, type Regime } from "@/musicdna/router";
import { regimeToKnobs } from "@/musicdna/router/knobs";

// Phase 4: routing mode. Read once per request from env.
//   "legacy"  — original behavior, no shadow diff, no regime knobs.
//   "shadow"  — compute a shadow pick with regime-derived knobs and log the
//               divergence on `regime_recommended`. User still gets the
//               legacy pick. This is the default when a router
//               recommendation is available.
//   "live"    — apply the regime knobs to the real `selectPairing` call.
//               Reserved for Phase 5 canary. Not enabled unless the env
//               variable is set explicitly.
type RoutingMode = "legacy" | "shadow" | "live";
function readRoutingMode(): RoutingMode {
  const v = (typeof process !== "undefined" ? process.env?.MUSICDNA_ROUTING_MODE : undefined) ?? "";
  if (v === "legacy" || v === "shadow" || v === "live") return v;
  return "shadow";
}

// Deterministic RNG shared by the live and shadow selectPairing calls so
// their draw sequences match — divergence between the two picks is then
// attributable to knob differences, not to Math.random() luck. mulberry32
// is a 32-bit seeded PRNG; the seed is derived from sessionId + round so
// each pick is reproducible and independent across rounds.
function mulberry32(seed: number): { next: () => number } {
  let s = seed >>> 0;
  return {
    next: () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
function seedFrom(sessionId: string, round: number): number {
  let h = 2166136261 >>> 0;
  const s = `${sessionId}:${round}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}


// Shared Supabase client type used by the *Impl exports below. The test
// harness (src/routes/api/public/test/$action.ts) calls these Impl variants
// directly with a service-role admin client + synthetic userId, bypassing
// the auth middleware so agents can drive end-to-end runs without auth.
export type AuthedSupabase = SupabaseClient<Database>;



// Canonical 10 axes. Source of truth: public.axes (9 rows) + transformation.
// Moods (nostalgic, dreamy, dark, hopeful, romantic, etc.) are DERIVED from
// combinations of these — see deriveDescriptors below. Never stored.
const DIMS = [
  "movement","atmosphere","immersion","scale","community",
  "perspective","confidence","tension","texture","transformation",
] as const;

// Pole labels match the public.axes table verbatim so the LLM, the DB, and the
// reveal copy all speak the same vocabulary.
const DIM_LABEL: Record<string, { hi: string; lo: string }> = {
  movement: { hi: "forward motion", lo: "stillness" },
  atmosphere: { hi: "immersive mood", lo: "statement" },
  immersion: { hi: "slow reveal", lo: "immediacy" },
  scale: { hi: "vast", lo: "intimate" },
  community: { hi: "communal", lo: "solitary" },
  perspective: { hi: "witness", lo: "feeling" },
  confidence: { hi: "command", lo: "vulnerability" },
  tension: { hi: "danger", lo: "release" },
  texture: { hi: "refinement", lo: "rawness" },
  transformation: { hi: "takes you somewhere", lo: "holds its shape" },
};


// PERSONA + VOICE (imported above) live in @/musicdna/engine/critic so the
// exact same critic voice ships to any client. `ai()` delegates to the
// LLMGateway adapter — one place owns transport + auth.
async function ai(messages: Array<{ role: string; content: string }>) {
  return callLovableAi(messages, { model: MODEL });
}


// ============ Lane classifier ============
const LANES = ["alternative", "pop", "hip_hop", "electronic", "classic_rock", "metal", "country", "r_and_b", "general"] as const;
type Lane = (typeof LANES)[number];

// Shared lane rules — classic_rock keeps hard rock/prog; metal now routes to its
// own lane, but still needs canon + pairings seeding before it behaves like a full lane.
const LANE_RULES = `Lane rules:
- alternative = post-punk, indie, shoegaze, britpop, grunge, goth, college rock, emo, post-rock.
- pop = mainstream chart pop, pop-rock (Swift, Eilish, Beyonce pop work).
- hip_hop = rap, trap, boom-bap, drill. Rap-first artists only; if the record is sung-first with soul/gospel/funk phrasing, route to r_and_b even when it charts as pop.
- electronic = techno, house, IDM, drum-n-bass, EDM, ambient, trip-hop.
- metal = heavy metal, thrash, doom, black metal, death metal, nu metal, metalcore, prog metal. Sabbath, Metallica, Iron Maiden, Slayer, Tool, Mastodon, Deftones, Korn, Gojira, Pantera.
- r_and_b = R&B, soul, neo-soul, quiet storm, contemporary soul, vocal-led groove music. Marvin Gaye, Stevie Wonder, D'Angelo, Frank Ocean, SZA, The Weeknd, Solange.
- classic_rock = 60s-80s mainstream rock (Stones, Zeppelin, Fleetwood Mac), hard rock, prog (Rush, Yes, Pink Floyd, King Crimson), arena rock, glam, southern rock. If it is loud guitars and not "indie/alternative" in the modern sense, it belongs here for now.
- country = classic country, outlaw country, contemporary country, alt-country, Americana, country-pop, Nashville. Cash, Hank Williams, Willie Nelson, Sturgill Simpson, Kacey Musgraves, Chris Stapleton, Zach Bryan, Jelly Roll, Kenny Rogers, Merle Haggard, Dolly Parton, Miranda Lambert, Luke Combs, Morgan Wallen.
- Use "general" ONLY when the picks genuinely scatter across lanes with no center of gravity.`;

// Map catalog sub-lanes (currently all alternative sub-genres) to top-level lanes.
function catalogLaneToTopLane(sub: string | null | undefined): Lane | null {
  if (!sub) return null;
  const s = sub.toLowerCase();
  if ((LANES as readonly string[]).includes(s)) return s as Lane;
  if (
    s.includes("post_punk") || s.includes("post-punk") ||
    s.includes("shoegaze") || s.includes("dreampop") || s.includes("britpop") ||
    s.includes("indie") || s.includes("madchester") || s.includes("manchester") ||
    s.includes("grunge") || s.includes("alt-rock") || s.includes("altrock") ||
    s.includes("goth") || s.includes("darkwave") || s.includes("noise") ||
    s.includes("artrock") || s.includes("punk") || s.includes("sophistipop") ||
    s.includes("emo") || s.includes("post_rock") || s.includes("post-rock")
  ) return "alternative";
  if (
    s.includes("metal") || s.includes("heavy metal") || s.includes("thrash") ||
    s.includes("death metal") || s.includes("black metal") || s.includes("doom metal") ||
    s.includes("groove metal") || s.includes("nu metal") || s.includes("metalcore") ||
    s.includes("prog metal") || s.includes("progressive metal")
  ) return "metal";
  if (
    s.includes("country") || s.includes("americana") || s.includes("outlaw") ||
    s.includes("bluegrass") || s.includes("alt_country") || s.includes("alt-country") ||
    s.includes("nashville")
  ) return "country";
  if (
    s.includes("r_and_b") || s.includes("rnb") || s === "r&b" || s.includes("r-and-b") ||
    s.includes("soul") || s.includes("neo_soul") || s.includes("neo-soul") ||
    s.includes("quiet_storm") || s.includes("quiet-storm") || s.includes("pbr&b") ||
    s.includes("contemporary_r") || s.includes("motown") || s.includes("funk_soul")
  ) return "r_and_b";
  if (s.includes("electronic")) return "electronic";
  if (s.includes("r&b") || s.includes("r_and_b") || s.includes("neo-soul") || s.includes("neosoul") || s.includes("soul") || s.includes("quiet storm") || s.includes("contemporary soul")) return "r_and_b";
  // Hard rock / prog funnel into classic_rock. Metal has its own lane.
  if (
    s.includes("hard_rock") || s.includes("hard-rock") ||
    s.includes("hardrock") || s.includes("prog") || s.includes("arena_rock") ||
    s.includes("arena-rock") || s.includes("glam") || s.includes("classic_rock") ||
    s.includes("classic-rock") || s === "rock"
  ) return "classic_rock";
  return null;
}

// Slot weighting for the opener: users list their most-defining song first.
// Onboarding is 3 songs (has always been 3 — earlier prompts and docs that
// said 5 were legacy). Weights sum to 6; a lane clearing ≥ 3 is a majority.
// Kept as a named constant so admin diagnostics and the classifier prompt
// reference the same scheme.
export const OPENER_SLOT_WEIGHTS = [3, 2, 1] as const;
export const OPENER_WEIGHT_TOTAL = OPENER_SLOT_WEIGHTS.reduce((s, n) => s + n, 0); // 6


// Best-guess lane when the model is unsure (confidence < 0.4).
// Weighted vote — slot 1 is worth 3× slot 5. Ties still return null so a
// genuinely-scattered picks stays "general".
export function dominantPerSongLane(perSong: Array<{ lane: Lane | "unknown" }>): Lane | null {
  const share = weightedLaneShare(perSong);
  if (!share) return null;
  if (share.tied) return null;
  return share.lane;
}

// Weighted lane share across the opener slots. Returns the top lane, its
// share of OPENER_WEIGHT_TOTAL, and a `tied` flag when the second-place lane
// has identical weight. Used by both the low-confidence fallback and the
// post-LLM confidence floor.
export function weightedLaneShare(
  perSong: Array<{ lane: Lane | "unknown" }>,
): { lane: Lane; weight: number; share: number; tied: boolean } | null {
  const tally: Record<string, number> = {};
  for (let i = 0; i < perSong.length; i++) {
    const w = OPENER_SLOT_WEIGHTS[i] ?? 1;
    const lane = perSong[i]?.lane;
    if (lane && lane !== "unknown") tally[lane] = (tally[lane] ?? 0) + w;
  }
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const [topLane, topWeight] = entries[0];
  const tied = entries.length > 1 && entries[1][1] === topWeight;
  return {
    lane: topLane as Lane,
    weight: topWeight,
    share: topWeight / OPENER_WEIGHT_TOTAL,
    tied,
  };
}

const CLASSIFIER_VOICE = `${PERSONA}
Mode: taste-reader. You read three songs a user named as ones they love, ranked top to bottom, and produce a structured taste sketch. The reasoning and hypothesis fields carry the voice — keep them sharp, specific, and a little uncomfortable.

You return a JSON object with this exact shape:
{
  "lane": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "metal" | "country" | "r_and_b" | "general",
  "confidence": 0.0-1.0,
  "secondary_lanes": [lane, ...],
  "candidate_dimensions": {
    "movement": -100..100, "atmosphere": -100..100, "immersion": -100..100,
    "scale": -100..100, "community": -100..100, "perspective": -100..100,
    "confidence": -100..100, "tension": -100..100, "texture": -100..100,
    "transformation": -100..100
  },
  "per_song": [{"input": "...", "lane": "alternative|pop|hip_hop|electronic|classic_rock|metal|country|r_and_b|unknown"}],
  "reasoning": ["one short observation", "..."],
  "hypothesis": "ONE sentence, max 30 words, Rolling Stone voice. Name what these choices reveal — specific dimensions like movement, atmosphere, transformation, melody. End with 'Let's see if that holds.' or similar half-promise."
}

${LANE_RULES}

Slot weighting: the three songs are NOT equal. Weight them 3, 2, 1 (slot 1 is 3× slot 3). Users lead with their most-defining pick — if slot 1 lands in one lane and slots 2-3 scatter, the lane call follows slot 1.

Confidence: 1.0 = all three point to one lane. 0.7-0.9 = clear majority. 0.4-0.6 = mixed but a leaning. <0.4 = scattered, use "general". Three songs is thin evidence — stay honest.

candidate_dimensions: read what the three songs collectively reward. Negative = the low pole (stillness, statement, light, etc.), positive = the high pole. Be opinionated — leave dimensions at 0 only when the songs are genuinely silent on that axis.

Voice for hypothesis: specific, restrained, slightly uncomfortable. No platitudes. No genre labels. Use "you reward", "you choose", "you trust" — never "you like".

Respond ONLY with valid JSON. No prose, no markdown fences.`;


type LlmDimensions = Partial<Record<(typeof DIMS)[number], number>>;

type OpeningAnalysis = {
  lane: Lane;
  confidence: number;
  secondary_lanes: Lane[];
  reasoning: string[];
  hypothesis: string;
  candidate_dimensions: LlmDimensions;
  per_song: Array<{ input: string; lane: Lane | "unknown"; source: "llm" | "catalog"; canon_id?: string }>;
  canon_matches: Array<{ input: string; song_id: string; title: string; artist: string; primary_lane: string }>;
};

const FALLBACK: OpeningAnalysis = {
  lane: "general",
  confidence: 0,
  secondary_lanes: [],
  reasoning: ["Couldn't read those three clearly. The matchups will do the work."],
  hypothesis: "Three songs is a sketch, not a portrait. Let's see if the matchups hold.",
  candidate_dimensions: {},
  per_song: [],
  canon_matches: [],
};

async function classifyLane(
  songs: string[],
  supabase: { from: (t: string) => { select: (c: string) => { ilike: (col: string, v: string) => { limit: (n: number) => Promise<{ data: Array<{ id: string; primary_lane?: string | null; lane: string; title: string; artist: string }> | null }> } } } },
): Promise<OpeningAnalysis> {
  // Step 1: LLM reads all five at once — lane, confidence, dimensions, hypothesis.
  let llm: OpeningAnalysis = { ...FALLBACK, per_song: songs.map((s) => ({ input: s, lane: "unknown", source: "llm" })) };
  try {
    const txt = await ai([
      { role: "system", content: CLASSIFIER_VOICE },
      { role: "user", content: `The user named these three songs as ones they love (ranked top to bottom):\n${songs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nReturn the JSON object now.` },
    ]);
    const cleaned = txt.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<OpeningAnalysis>;
    const lane = (LANES as readonly string[]).includes(parsed.lane as string) ? (parsed.lane as Lane) : "general";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
    const secondary = Array.isArray(parsed.secondary_lanes)
      ? parsed.secondary_lanes.filter((l): l is Lane => (LANES as readonly string[]).includes(l as string) && l !== lane && l !== "general")
      : [];
    const dims: LlmDimensions = {};
    if (parsed.candidate_dimensions && typeof parsed.candidate_dimensions === "object") {
      for (const d of DIMS) {
        const v = (parsed.candidate_dimensions as Record<string, unknown>)[d];
        if (typeof v === "number" && Number.isFinite(v)) dims[d] = Math.max(-100, Math.min(100, Math.round(v)));
      }
    }
    const perSong = songs.map((input) => {
      const match = Array.isArray(parsed.per_song) ? parsed.per_song.find((p) => p?.input === input) : null;
      const songLane = match && (LANES as readonly string[]).includes(match.lane as string) ? (match.lane as Lane) : "unknown";
      return { input, lane: songLane as Lane | "unknown", source: "llm" as const };
    });
    llm = {
      lane: confidence < 0.4 ? (dominantPerSongLane(perSong) ?? "general") : lane,
      confidence,
      secondary_lanes: secondary,
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 4).map(String) : [],
      hypothesis: typeof parsed.hypothesis === "string" && parsed.hypothesis.trim() ? parsed.hypothesis.trim() : FALLBACK.hypothesis,
      candidate_dimensions: dims,
      per_song: perSong,
      canon_matches: [],
    };
  } catch { /* keep FALLBACK */ }

  // Step 2: Hidden canon enrichment — try to map each entry to a catalog song.
  // This is a free signal, never shown to the user. Failures are silent.
  for (let i = 0; i < songs.length; i++) {
    const raw = songs[i];
    const [titlePart, artistPart] = raw.split(/—|–|-/).map((s) => s.trim());
    const title = titlePart || raw;
    if (!title) continue;
    try {
      const { data } = await supabase.from("songs").select("id,primary_lane,lane,title,artist").ilike("title", title).limit(5);
      if (!data?.length) continue;
      const best = artistPart
        ? data.find((r) => r.artist?.toLowerCase().includes(artistPart.toLowerCase())) ?? data[0]
        : data[0];
      const topLane = catalogLaneToTopLane(best.primary_lane ?? best.lane);
      llm.canon_matches.push({
        input: raw,
        song_id: best.id,
        title: best.title,
        artist: best.artist,
        primary_lane: best.primary_lane ?? best.lane,
      });
      if (llm.per_song[i]) {
        llm.per_song[i] = { ...llm.per_song[i], source: "catalog", canon_id: best.id, lane: topLane ?? llm.per_song[i].lane };
      }
    } catch { /* swallow */ }
  }

  // Weighted-slot confidence floor: after canon enrichment, tally per_song by
  // slot weight (3-2-1 across the three openers, total 6). If one lane owns
  // ≥ 50% of the weight (≥ 3 of 6) AND isn't tied for first, floor confidence
  // to 0.6 so we route to that lane instead of falling back to `general`.
  // Slot 1's 3× weight is what usually saves "one clear favorite + two
  // scattered picks" from ending up as general.
  const share = weightedLaneShare(llm.per_song);
  const weighting = share
    ? { scheme: "3-2-1" as const, top_lane: share.lane, top_lane_share: Math.round(share.share * 100) / 100, tied: share.tied }
    : { scheme: "3-2-1" as const, top_lane: null, top_lane_share: 0, tied: false };
  if (share && !share.tied && share.share >= 0.5 && llm.confidence < 0.6) {
    llm.lane = share.lane;
    llm.confidence = Math.max(llm.confidence, 0.6);
    llm.reasoning = [
      ...llm.reasoning,
      `Slot-1 anchored the read (${share.lane}, ${Math.round(share.share * 100)}% of weighted picks).`,
    ].slice(0, 4);
  }
  (llm as OpeningAnalysis & { weighting?: unknown }).weighting = weighting;


  return llm;
}

export const analyzeOpeningSongs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ songs: z.array(z.string().trim().min(1).max(200)).length(3) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const analysis = await classifyLane(data.songs, supabase as never);
    await supabase
      .from("profiles")
      .update({
        opening_songs: data.songs,
        opening_hypothesis: analysis.hypothesis,
        opening_lane: analysis.lane,
        opening_lane_confidence: analysis.confidence,
        opening_analysis_json: JSON.parse(JSON.stringify(analysis)),
      })
      .eq("user_id", userId);
    return analysis;
  });

// Back-compat alias — old call sites keep working.
export const generateOpeningHypothesis = analyzeOpeningSongs;

// ============ Start session ============
const ALL_LANES: Lane[] = ["alternative", "pop", "hip_hop", "electronic", "classic_rock", "metal", "country", "r_and_b"];

export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => startSessionImpl(context.supabase, context.userId));

// Prior seeding lives in the engine so priors weighting is testable and
// shared by any future caller (see src/musicdna/engine/priors.ts).
import { PRIOR_SEED_WEIGHT, seedVectorFromPriors } from "@/musicdna/engine/priors";
import { buildStartSessionSeed } from "@/musicdna/engine/session";
import { selectPairing, shouldStop, assertWithinLane, type PairingCandidate } from "@/musicdna/engine/pairing";
import { applyChoice } from "@/musicdna/engine/choice";
export { PRIOR_SEED_WEIGHT, seedVectorFromPriors };



export async function startSessionImpl(supabase: AuthedSupabase, userId: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("opening_lane, opening_lane_confidence, opening_analysis_json")
      .eq("user_id", userId)
      .maybeSingle();

    // Pure: lane + confidence + probe candidates + seed vector.
    const seed = buildStartSessionSeed({
      profile: profile as never,
      all_lanes: ALL_LANES,
      rng: { next: () => Math.random() },
    });

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        vector: seed.seed_vector,
        lane: seed.lane,
        lane_confidence: seed.lane_confidence,
        probe_candidate_lanes: seed.probe_candidate_lanes,
        probe_state: { probes_shown: [], pending: {}, lane_alignment: {}, flips: [] },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: data.id, lane: seed.lane, lane_confidence: seed.lane_confidence };
}

// ============ Next pairing ============
// Probe schedule: at these rounds we silently inject a pairing from a
// candidate lane (not the user's current lane) to see if the user resonates.
const PROBE_ROUNDS = new Set([4, 9, 14]);

type ProbeState = {
  probes_shown: Array<{ round: number; pairing_id: string; lane: Lane }>;
  pending: Record<string, Lane>; // pairing_id → probe lane (not yet recorded)
  lane_alignment: Record<string, { wins: number; total: number; magnitude: number; cosine_sum: number }>;
  flips: Array<{ round: number; from: Lane; to: Lane; reason: string }>;
  // Pairings the user explicitly skipped ("I don't know either of these").
  // Excluded from every future selection in this session. Never scored.
  skipped_pairing_ids?: string[];
  // Set true the first time a user hits Skip. Signals to nextPairingImpl
  // that we may widen bootstrap probes beyond opener lanes — the user has
  // told us the in-lane read isn't landing, so try adjacent territory.
  wants_wider_probe?: boolean;
};

// One row per bootstrap pairing the user has answered while in `general`.
// Written by recordChoiceImpl; read by both nextPairingImpl (to decide when
// the bootstrap phase is over) and the promotion check (to decide whether
// the 2 winners agree on a lane).
type BootstrapChoiceEntry = {
  pairing_id: string;
  winner_primary_lane: string | null;
  loser_primary_lane: string | null;
};

export const nextPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => nextPairingImpl(context.supabase, data));

export async function nextPairingImpl(supabase: AuthedSupabase, data: { sessionId: string }) {
    const [usedRes, sessionRes, profileRes] = await Promise.all([
      supabase.from("choices").select("pairing_id").eq("session_id", data.sessionId),
      supabase
        .from("sessions")
        .select("vector, lane, lane_confidence, probe_candidate_lanes, probe_state, bootstrap_choices_json, user_id")
        .eq("id", data.sessionId)
        .single(),
      supabase
        .from("sessions")
        .select("user_id, profiles!inner(opening_analysis_json)")
        .eq("id", data.sessionId)
        .maybeSingle(),
    ]);
    const sessionLane = (sessionRes.data?.lane as Lane | null) ?? "general";
    const laneConfidence = Number(sessionRes.data?.lane_confidence ?? 0);
    const probeCandidates = (sessionRes.data?.probe_candidate_lanes as Lane[] | null) ?? [];
    const probeState = (sessionRes.data?.probe_state ?? {}) as ProbeState;
    probeState.probes_shown = probeState.probes_shown ?? [];
    probeState.pending = probeState.pending ?? {};
    probeState.lane_alignment = probeState.lane_alignment ?? {};
    probeState.flips = probeState.flips ?? [];
    const bootstrapChoices = ((sessionRes.data as { bootstrap_choices_json?: unknown } | null)
      ?.bootstrap_choices_json as BootstrapChoiceEntry[] | null) ?? [];

    // Extract the set of lanes the opener songs actually landed in. Used by
    // the bootstrap phase to keep probe pairings inside the user's stated
    // taste territory (rock/pop/alt if that's what they named) instead of
    // reaching for R&B or country cold. Empty = fall back to any bootstrap.
    const openingAnalysis = (profileRes.data as { profiles?: { opening_analysis_json?: unknown } } | null)
      ?.profiles?.opening_analysis_json as
        | { per_song?: Array<{ lane?: string | null }>; secondary_lanes?: string[] | null }
        | null
        | undefined;
    const openerLanes = new Set<string>();
    for (const p of openingAnalysis?.per_song ?? []) {
      if (p?.lane && p.lane !== "unknown" && p.lane !== "general") openerLanes.add(p.lane);
    }
    for (const l of openingAnalysis?.secondary_lanes ?? []) {
      if (l && l !== "general") openerLanes.add(l);
    }


    const pairingSelect = `
      id, tests, hypothesis, why_good, diagnostic_weight, lane, is_bootstrap,
      song_a:songs!pairings_song_a_id_fkey(id,title,artist,year,primary_lane,lane),
      song_b:songs!pairings_song_b_id_fkey(id,title,artist,year,primary_lane,lane)
    `;

    const usedIds = new Set((usedRes.data ?? []).map((c) => c.pairing_id));
    // Skipped pairings are excluded from every future selection in this session.
    for (const pid of probeState.skipped_pairing_ids ?? []) usedIds.add(pid);
    const round = usedIds.size;
    const vector = (sessionRes.data?.vector ?? {}) as Record<string, number>;
    const stop = shouldStop({ round, vector, dims: DIMS as readonly string[] });
    if (stop.done) {
      return { pairing: null, round, confidence: stop.confidence, done: true as const };
    }

    // ---- Shadow router (Step 0 of Agent Brain integration) -----------------
    // Emit a `regime_recommended` event WITHOUT touching selection. Awaited so
    // the write actually lands in serverless runtimes (Cursor telemetry fix).
    // Also logs the legacy selector's decision (selected_mode, selection_reason)
    // and whether the regime agrees — that's the metric Step 4 rollout gates on.
    //
    // Cursor #3 (Phase 3.5 corrected): vectors accumulate around 0 in
    // choice.ts (`vec[d] = (vec[d] ?? 0) + delta * w`), not around 50. The
    // old |v-50|/50 formula was mis-centered — a neutral session read as
    // fully confident. Use the same test shouldStop() applies: count axes
    // whose |v| has crossed the 30-point confidence threshold, divided by
    // the total dimension count. Matches Cursor review #3.
    const dimsRef = DIMS as readonly string[];
    const AXIS_CONF_THRESHOLD = 30;
    const confidentAxes = dimsRef.filter(
      (d) => Math.abs(Number(vector[d] ?? 0)) >= AXIS_CONF_THRESHOLD,
    ).length;
    const vectorConfidence = dimsRef.length > 0 ? confidentAxes / dimsRef.length : 0;

    // Cursor #5: legacy selector → regime mapping so we can compute `scoring_agrees`.
    //   bootstrap             → explore (probing lane boundaries)
    //   recognition_first     → explore (widening / general lane)
    //   recognition_boost     → prune   (narrowing within a leaning lane)
    //   diagnostic_first      → compound (confident lane, exploiting signal)
    const legacyToRegime = (mode: string, isBootstrap: boolean): Regime => {
      if (isBootstrap) return "explore";
      if (mode === "recognition_first") return "explore";
      if (mode === "recognition_boost") return "prune";
      if (mode === "diagnostic_first") return "compound";
      return "explore";
    };

    // Phase 3.5 note on completion: `emitShadowRecommendation` is `await`ed
    // BEFORE nextPairingImpl returns (see the two call sites below). On
    // Cloudflare Workers / workerd, promises awaited inside a request
    // handler complete synchronously with the response — no waitUntil()
    // needed. The fire-and-forget hazard the earlier review flagged would
    // only apply if we removed the await. If a future change makes this
    // truly fire-and-forget, switch to `event.waitUntil(promise)` from the
    // server route's ctx instead of dropping the await.
    const routingMode: RoutingMode = readRoutingMode();
    const emitShadowRecommendation = async (
      pairingId: string | null,
      ctx: {
        selected_mode: string;
        selection_reason: Record<string, unknown> | null;
        is_bootstrap: boolean;
        // Phase 4: shadow-pick diff. Optional so bootstrap callers (which
        // don't run selectPairing) can omit it.
        shadow?: {
          pick_id: string | null;
          agrees: boolean;
          knobs: Record<string, unknown>;
          selection_reason: Record<string, unknown> | null;
          knobs_differ?: boolean;
          pick_differs?: boolean;
        } | null;
        // Cursor #1 fix: caller may pass a cached router recommendation so
        // we don't run recommendForSession twice per pick. Bootstrap
        // callers omit it and we fall back to computing here.
        cachedRec?: Awaited<ReturnType<typeof recommendForSession>> | null;
      },
    ): Promise<void> => {
      try {
        const rec = ctx.cachedRec !== undefined
          ? ctx.cachedRec
          : await recommendForSession(supabase, data.sessionId, {
              laneConfidence,
              vectorConfidence,
              round,
              maxRounds: 6,
            });
        if (!rec) return;
        const legacyRegime = legacyToRegime(ctx.selected_mode, ctx.is_bootstrap);
        const props = {
          ...rec,
          selected_mode: ctx.selected_mode,
          legacy_regime: legacyRegime,
          scoring_agrees: rec.regime === legacyRegime,
          selection_reason: ctx.selection_reason,
          routing_mode: routingMode,
          shadow_pick: ctx.shadow ?? null,
        };
        await supabase.from("event_log").insert({
          user_id: sessionRes.data?.user_id ?? null,
          session_id: data.sessionId,
          pairing_id: pairingId,
          event_type: "regime_recommended",
          client: "server",
          props: props as never,
        } as never);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[musicdna] regime_recommended emit failed:", e instanceof Error ? e.message : e);
      }
    };


    // Cross-lane probes intentionally disabled — see mem://product/within-lane-only.md.
    void probeCandidates; void PROBE_ROUNDS;
    if (Object.keys(probeState.pending).length > 0) {
      throw new Error(
        `within-lane invariant violated: probe_state.pending is non-empty (${JSON.stringify(probeState.pending)}). ` +
          `Cross-lane probes are disabled — see mem://product/within-lane-only.md.`,
      );
    }

    // -------- Bootstrap phase --------
    // If the session opened as `general` (opener didn't produce a confident
    // lane call) and we haven't yet shown 2 bootstrap pairings, prefer a
    // marked bootstrap pairing so we can promote the session to a real lane
    // from the first 2 winners.
    //
    // Constraint: the bootstrap pairing must sit inside the lanes the user's
    // opener songs actually landed in (openerLanes). We won't cold-serve an
    // R&B / country / hip-hop probe to someone who named three rock/pop
    // songs — that reads as "the app isn't listening". Fall through to the
    // normal general-pool selection (recognition-first) when no bootstrap
    // pairing matches the opener territory; a future "skip" affordance can
    // opt the user into wider probes.
    if (sessionLane === "general" && bootstrapChoices.length < 2) {
      const bootRes = await supabase
        .from("pairings")
        .select(pairingSelect)
        .eq("active", true)
        .eq("is_bootstrap", true);
      const rawBootPool = ((bootRes.data ?? []) as unknown as Array<PairingCandidate & { is_bootstrap?: boolean; song_a?: { primary_lane?: string | null } | null; song_b?: { primary_lane?: string | null } | null }>)
        .filter((p) => !usedIds.has(p.id));
      // Keep only pairings that intersect the user's opener lanes. If the
      // opener produced no usable lanes (should be rare — total scatter),
      // fall back to the full bootstrap pool so we still probe.
      // Keep only pairings that intersect the user's opener lanes. If the
      // opener produced no usable lanes, OR the user has already hit "skip"
      // (wants_wider_probe), fall back to the full bootstrap pool so we can
      // reach adjacent territory (rap/R&B/country/etc).
      const widenProbe = probeState.wants_wider_probe === true;
      const bootPool = openerLanes.size > 0 && !widenProbe
        ? rawBootPool.filter((p) => {
            const pairingLane = (p.lane ?? null) as string | null;
            const aLane = p.song_a?.primary_lane ?? null;
            const bLane = p.song_b?.primary_lane ?? null;
            return (pairingLane && openerLanes.has(pairingLane))
              || (aLane && openerLanes.has(aLane))
              || (bLane && openerLanes.has(bLane));
          })
        : rawBootPool;
      if (bootPool.length > 0) {
        // Prefer pairings whose two songs have different primary_lane so the
        // winner is diagnostic. Fall back to any lane-scoped bootstrap.
        const differing = bootPool.filter((p) => {
          const a = p.song_a?.primary_lane ?? null;
          const b = p.song_b?.primary_lane ?? null;
          return a && b && a !== b;
        });
        const finalPool = differing.length > 0 ? differing : bootPool;
        const pickIdx = Math.floor(Math.random() * finalPool.length);
        const bootPicked = finalPool[pickIdx];
        const bootReason = {
          leaning_axes: [],
          fork_matched: false,
          tests: (bootPicked.tests ?? []) as string[],
          axes_needed: [],
          axis_need_score: 0,
          challenge_boost: false,
          diagnostic_weight: bootPicked.diagnostic_weight ?? 50,
          pool_size: finalPool.length,
          weight: 0,
          bootstrap: true,
          opener_lanes: Array.from(openerLanes),
        } as Record<string, unknown>;
        await emitShadowRecommendation(bootPicked.id, {
          selected_mode: "bootstrap",
          selection_reason: bootReason,
          is_bootstrap: true,
        });
        return {
          pairing: bootPicked,
          round: round + 1,
          confidence: stop.confidence,
          done: false as const,
          selection_reason: {
            leaning_axes: [],
            fork_matched: false,
            tests: (bootPicked.tests ?? []) as string[],
            axes_needed: [],
            axis_need_score: 0,
            challenge_boost: false,
            diagnostic_weight: bootPicked.diagnostic_weight ?? 50,
            pool_size: finalPool.length,
            weight: 0,
            bootstrap: true,
            opener_lanes: Array.from(openerLanes),
          } as never,
        };
      }
      // No opener-lane bootstrap available → fall through to normal general
      // selection below (recognition-first, high canon).

    }

    // -------- Fetch lane-scoped pool, fall back to general when empty --------
    let pairingsRes = sessionLane === "general"
      ? await supabase.from("pairings").select(pairingSelect).eq("active", true)
      : await supabase.from("pairings").select(pairingSelect).eq("active", true).eq("lane", sessionLane);
    if (pairingsRes.error) throw new Error(pairingsRes.error.message);

    // -------- Hydrate recognition data for the current pool --------
    // View mirrors pairings visibility; a failed read isn't fatal — selector
    // gracefully degrades to diagnostic-weight-only scoring.
    const poolIds = (pairingsRes.data ?? []).map((p: { id: string }) => p.id);
    const recognition = new Map<string, { min_canon: number; avg_canon: number; recognition_score: number }>();
    if (poolIds.length > 0) {
      const recRes = await supabase
        .from("pairing_recognition")
        .select("pairing_id, min_canon, avg_canon, recognition_score")
        .in("pairing_id", poolIds);
      for (const row of (recRes.data ?? []) as Array<{ pairing_id: string; min_canon: number | null; avg_canon: number | null; recognition_score: number | null }>) {
        recognition.set(row.pairing_id, {
          min_canon: Number(row.min_canon ?? 0),
          avg_canon: Number(row.avg_canon ?? 0),
          recognition_score: Number(row.recognition_score ?? 0),
        });
      }
    }

    // Pick mode from lane_confidence. General/low-confidence sessions after
    // the bootstrap phase get recognition-forward selection so users see
    // pairings they can actually engage with.
    const mode: "diagnostic_first" | "recognition_boost" | "recognition_first" =
      sessionLane === "general"
        ? "recognition_first"
        : laneConfidence < 0.6
          ? "recognition_boost"
          : "diagnostic_first";

    const finalPool = (pairingsRes.data ?? []) as unknown as PairingCandidate[];

    // Phase 4 (cursor #1 fix): consult the shadow router ONCE per pick and
    // reuse the result for both knob derivation and the event emitter.
    // Previously we called recommendForSession twice, doubling router work
    // and letting the two calls disagree if any input drifted.
    let regimeKnobs: ReturnType<typeof regimeToKnobs> | null = null;
    let regimeForShadow: Regime | null = null;
    let cachedRec: Awaited<ReturnType<typeof recommendForSession>> | null = null;
    if (routingMode !== "legacy") {
      try {
        cachedRec = await recommendForSession(supabase, data.sessionId, {
          laneConfidence,
          vectorConfidence,
          round,
          maxRounds: 6,
        });
        if (cachedRec) {
          regimeForShadow = cachedRec.regime;
          regimeKnobs = regimeToKnobs(cachedRec.regime);
        }
      } catch { /* shadow only — never fail the user */ }
    }

    // Cursor #1 blocker fix: share a seeded RNG between the live and shadow
    // picks so both consume the same draw sequence. Divergence between the
    // two picks then reflects knob differences only, not Math.random() luck.
    const rngSeed = seedFrom(data.sessionId, round);
    const rng = mulberry32(rngSeed);
    const liveKnobs = routingMode === "live" && regimeKnobs ? regimeKnobs : undefined;
    let picked = selectPairing({
      pool: finalPool,
      vector,
      used_ids: usedIds,
      session_lane: sessionLane,
      dims: DIMS as readonly string[],
      rng,
      mode,
      recognition,
      knobs: liveKnobs,
    });

    // Track the actual pool + mode the live selector used (post-fallback) so
    // the shadow pick scores the same universe. Cursor: "General-lane
    // fallback under-counts real diverge cases" — fixed here.
    let livePool = finalPool;
    let liveMode = mode;
    if (picked.kind === "empty" && sessionLane !== "general") {
      pairingsRes = await supabase.from("pairings").select(pairingSelect).eq("active", true).eq("lane", "general");
      if (pairingsRes.error) throw new Error(pairingsRes.error.message);
      livePool = (pairingsRes.data ?? []) as unknown as PairingCandidate[];
      liveMode = "recognition_first";
      // Reseed for the fallback attempt so shadow can reproduce it exactly.
      const fbRng = mulberry32(rngSeed ^ 0x9e3779b9);
      picked = selectPairing({
        pool: livePool,
        vector,
        used_ids: usedIds,
        session_lane: sessionLane,
        dims: DIMS as readonly string[],
        rng: fbRng,
        mode: liveMode,
        recognition,
        knobs: liveKnobs,
      });
    }
    if (picked.kind === "empty") {
      return { pairing: null, round, confidence: stop.confidence, done: true as const };
    }
    assertWithinLane((picked.pairing as { lane?: string | null }).lane ?? null, sessionLane);

    // Shadow-only: run a parallel pick with regime knobs against the SAME
    // pool + mode + seed the live selector actually used. Any divergence is
    // now attributable to knob differences.
    let shadowInfo: {
      pick_id: string | null;
      agrees: boolean;
      knobs: Record<string, unknown>;
      selection_reason: Record<string, unknown> | null;
      knobs_differ: boolean;
      pick_differs: boolean;
    } | null = null;
    if (routingMode === "shadow" && regimeKnobs) {
      try {
        // Reseed to the exact seed used for the live pick that produced
        // `picked` (fallback path used a xor'd seed).
        const shadowSeed = livePool === finalPool ? rngSeed : (rngSeed ^ 0x9e3779b9);
        const shadowRng = mulberry32(shadowSeed);
        const shadowPick = selectPairing({
          pool: livePool,
          vector,
          used_ids: usedIds,
          session_lane: sessionLane,
          dims: DIMS as readonly string[],
          rng: shadowRng,
          mode: liveMode,
          recognition,
          knobs: regimeKnobs,
        });
        if (shadowPick.kind === "picked") {
          const shadowId = (shadowPick.pairing as { id: string }).id;
          const liveId = (picked.pairing as { id: string }).id;
          // knobs_differ: legacy runs with knobs=undefined (defaults).
          // Any regimeKnobs value at all counts as a knob difference for
          // shadow-mode diagnostics.
          const knobsDiffer = liveKnobs === undefined
            ? true
            : JSON.stringify(liveKnobs) !== JSON.stringify(regimeKnobs);
          shadowInfo = {
            pick_id: shadowId,
            agrees: shadowId === liveId,
            knobs: regimeKnobs as Record<string, unknown>,
            selection_reason: shadowPick.selection_reason as unknown as Record<string, unknown>,
            knobs_differ: knobsDiffer,
            pick_differs: shadowId !== liveId,
          };
        }
      } catch { /* shadow only */ }
    }

    await emitShadowRecommendation((picked.pairing as { id: string }).id, {
      selected_mode: routingMode === "live" && regimeForShadow ? `live:${regimeForShadow}` : liveMode,
      selection_reason: (picked.selection_reason ?? null) as Record<string, unknown> | null,
      is_bootstrap: false,
      shadow: shadowInfo,
      cachedRec,
    });
    return {
      pairing: picked.pairing,
      round: round + 1,
      confidence: stop.confidence,
      done: false as const,
      // Instrumentation: client echoes this back in the `pairing_shown` event so
      // downstream analysis can join "why we picked it" to "what the user did".
      selection_reason: picked.selection_reason,
    };
}



// ============ Record choice ============
// Two-layer copy system:
//   axis_label — the canonical "X over Y" line, spoken ONCE per session per pole.
//   observations — 8–12 different-flavored observations of the same tradeoff.
// The reveal builder picks by hash so no line repeats inside a session, and
// gates identity claims behind round ≥ 3 (with real support required for the
// stronger reads). Voice: Rolling Stone in its mean years — punchy, specific,
// no therapy-speak, no restated axis. Every line should make the user nod.
type BeatVariant = { thesis: string; hook: string };
type Pole = { axis_label: string; observations: string[] };

const POLES: Record<string, { hi: Pole; lo: Pole }> = {
  movement: {
    hi: {
      axis_label: "songs that move over songs that sit still",
      observations: [
        "You want the song going somewhere.",
        "Stillness bores you, at least so far.",
        "Motion is the point, not decoration.",
        "You reward a song with somewhere to be.",
        "The one that leans forward keeps winning.",
        "Standing still is for other people, apparently.",
        "You'd rather be pulled than sat down.",
        "The forward pick, again. Not an accident.",
      ],
    },
    lo: {
      axis_label: "songs that sit still over songs that move",
      observations: [
        "You'd rather the song wait with you.",
        "Not in a hurry. Ever, or just today?",
        "Patience reads as taste, not laziness.",
        "The still ones keep pulling you in.",
        "You reward a song that refuses to rush.",
        "You want the room, not the road.",
        "The one that plants itself keeps winning.",
        "You'd take the pause over the push.",
      ],
    },
  },
  atmosphere: {
    hi: {
      axis_label: "atmosphere over statement",
      observations: [
        "The room around the song is doing the work.",
        "You trust mood more than the lyric.",
        "The blurrier one keeps winning your vote.",
        "You want to be surrounded, not addressed.",
        "Reverb reads as meaning, at least so far.",
        "You reward the song that hides its edges.",
        "The one that soaks the room keeps landing.",
        "You'd rather feel it than be told.",
      ],
    },
    lo: {
      axis_label: "statement over atmosphere",
      observations: [
        "You want the words to land.",
        "Not much patience for fog so far.",
        "You reward a song that says the thing.",
        "The direct one keeps winning.",
        "Clarity beats haze on your card.",
        "You'd rather be addressed than surrounded.",
        "The song that means it out loud keeps landing.",
        "You want the lyric doing real work.",
      ],
    },
  },
  immersion: {
    hi: {
      axis_label: "the slow burn over the quick hit",
      observations: [
        "You don't need the hook on contact.",
        "You're patient with a slow fuse.",
        "The payoff matters more than the opening.",
        "You reward ambition over efficiency.",
        "You don't mind waiting for the song to arrive.",
        "The third-listen songs keep winning.",
        "The ending changes how you hear the beginning.",
        "You trust a song to earn it.",
      ],
    },
    lo: {
      axis_label: "the quick hit over the slow burn",
      observations: [
        "If it doesn't grab you fast, it doesn't grab you.",
        "You vote on first impression and stick.",
        "Eight bars or out.",
        "The opener has to do real work.",
        "You reward the song that lands immediately.",
        "The hook better arrive on time.",
        "First bar is the audition.",
        "The slow reveal loses, at least so far.",
      ],
    },
  },
  scale: {
    hi: {
      axis_label: "vast over intimate",
      observations: [
        "You want the song bigger than the room.",
        "The one with more air keeps winning.",
        "Panorama beats close-up on your card.",
        "You reward a song that opens up.",
        "You want space to move around in the song.",
        "The wider one keeps landing.",
        "You'd rather the song stretch than lean in.",
        "Big rooms, apparently.",
      ],
    },
    lo: {
      axis_label: "intimate over vast",
      observations: [
        "You want the song one inch away.",
        "No stadiums, no fog machines.",
        "The close pick keeps winning.",
        "You reward a song breathing on your neck.",
        "You'd take the whisper over the wall.",
        "Private over public, so far.",
        "The small room keeps landing.",
        "You want it in the ear, not in the sky.",
      ],
    },
  },
  community: {
    hi: {
      axis_label: "songs built to be shared over songs built for headphones",
      observations: [
        "You're drawn to songs that invite people in.",
        "The one built for a crowd keeps winning.",
        "You reward a song that wants company.",
        "You'd rather hear it together than alone.",
        "The singalong is doing something for you.",
        "You keep picking the one with room for more voices.",
        "The shared pick keeps landing.",
        "Music as gathering, apparently.",
      ],
    },
    lo: {
      axis_label: "songs built for headphones over songs built to be shared",
      observations: [
        "Headphones. Alone. On purpose.",
        "You want the signal undiluted.",
        "The song is between you and it.",
        "You reward a song that doesn't need a crowd.",
        "The private pick keeps winning.",
        "Group hugs need not apply.",
        "You'd rather listen than participate.",
        "Solo listener, so far.",
      ],
    },
  },
  perspective: {
    hi: {
      axis_label: "the narrator over the confessor",
      observations: [
        "You want the song to show you something.",
        "You reward a song that tells you about it.",
        "Distance is doing something for you.",
        "The camera keeps beating the mirror.",
        "You'd rather watch than bleed.",
        "The storyteller keeps winning.",
        "You want the frame around the feeling.",
        "You're here for the report, not the ride.",
      ],
    },
    lo: {
      axis_label: "the confessor over the narrator",
      observations: [
        "You want to be inside the song.",
        "No glass between you and the feeling.",
        "The first-person pick keeps winning.",
        "You reward a song that admits something.",
        "You'd rather feel it than hear about it.",
        "No distance, on purpose.",
        "You want the singer in the same room as the feeling.",
        "The mirror beats the camera, at least so far.",
      ],
    },
  },
  confidence: {
    hi: {
      axis_label: "swagger over vulnerability",
      observations: [
        "You reward a song that walks in like it owns the place.",
        "The certain one keeps winning.",
        "You want the singer sure of it.",
        "You'd take the assertion over the apology.",
        "No apology takes on your card, so far.",
        "You keep rewarding conviction.",
        "The one that plants a flag keeps landing.",
        "You want the song to mean it out loud.",
      ],
    },
    lo: {
      axis_label: "vulnerability over swagger",
      observations: [
        "You reward the cracked admission.",
        "You'd take the flinch over the flex.",
        "Honesty beats heat on your card.",
        "You want the singer risking something.",
        "The one that admits it keeps winning.",
        "You're allergic to posing, so far.",
        "The one with a lump in the throat keeps landing.",
        "You want the song exposed, not armored.",
      ],
    },
  },
  tension: {
    hi: {
      axis_label: "pressure over release",
      observations: [
        "You don't want the song to let you off.",
        "You reward a song that won't resolve.",
        "You trust the squeeze.",
        "The held breath keeps beating the exhale.",
        "You want the song to keep you tight.",
        "The unsettled one keeps winning.",
        "You'd rather be pinned than freed.",
        "Resolution can wait, apparently.",
      ],
    },
    lo: {
      axis_label: "release over pressure",
      observations: [
        "You want the song to let you breathe.",
        "The exhale is the payoff.",
        "You reward a song that opens the door.",
        "The one that lets go keeps winning.",
        "You'd take the resolution over the standoff.",
        "You want air, not anxiety.",
        "The one that finds daylight keeps landing.",
        "You want the song to give something back.",
      ],
    },
  },
  texture: {
    hi: {
      axis_label: "the clean take over the cracked one",
      observations: [
        "You reward a song that hides its seams.",
        "You hear the work and vote for it.",
        "The polished one keeps winning.",
        "You don't romanticize the mess.",
        "Craft is doing the delivering.",
        "The invisible-seam song keeps landing.",
        "You want the production doing real work.",
        "You'd take the fixed one over the flawed one.",
      ],
    },
    lo: {
      axis_label: "the cracked take over the clean one",
      observations: [
        "You'd take the cracked voice over the perfect one.",
        "You want it human, not fixed.",
        "The one with dirt on it keeps winning.",
        "You trust the mess.",
        "Polish reads suspicious, apparently.",
        "The imperfect take keeps landing.",
        "You want to hear the hands on the instrument.",
        "Sincerity has a sound and you hear it.",
      ],
    },
  },
  transformation: {
    hi: {
      axis_label: "songs that go somewhere over songs that hold their shape",
      observations: [
        "You like songs that reveal themselves.",
        "You reward ambition over efficiency.",
        "The payoff matters more than the hook.",
        "You don't need the chorus in the first minute.",
        "The song that keeps renegotiating itself keeps winning.",
        "You're listening for evolution, not impact.",
        "The one that travels somewhere keeps landing.",
        "You want the ending to change how you hear the start.",
        "You reward motion inside the song itself.",
      ],
    },
    lo: {
      axis_label: "songs that hold their shape over songs that wander",
      observations: [
        "You want the song to know what it is from bar one.",
        "No identity crisis on your card.",
        "The formed one keeps winning.",
        "You reward a song that arrives whole.",
        "You'd take the statement over the sketch.",
        "The one that commits keeps landing.",
        "You want conviction, not exploration.",
        "The song doesn't need to change to mean something.",
      ],
    },
  },
};

// Voice helpers — hedge ladder, hesitation copy, hash-stable variant picking
// live in the engine so both web and any future client render the same beat.
import {
  FORBIDDEN_TOKENS,
  HEDGES,
  HESITATION_BUCKETS,
  hedgeForRound,
  hesitationFor,
  pickByHash,
} from "@/musicdna/engine/voice";


// Fragmented beats for the running thesis — short lines plus a hook
// question/half-promise that pulls the next pick. Hedged on purpose.
const BEAT: Record<string, { hi: BeatVariant[]; lo: BeatVariant[] }> = {
  movement: {
    hi: [
      { thesis: "You keep choosing songs that move.\nNot fast.\nJust forward.", hook: "What happens if I throw you something that stands still?" },
      { thesis: "Forward motion, again.\nThat's a pattern, not an accident.\nProbably.", hook: "Want to test it with a song that refuses to move?" },
    ],
    lo: [
      { thesis: "Stillness keeps winning.\nThe ones that sit you down.\nNo rush.", hook: "Curious if a propulsive one breaks that." },
      { thesis: "You're drawn to the songs that wait.\nNot lazy — patient.\nDifferent thing.", hook: "What if I throw you one with somewhere to be?" },
    ],
  },
  atmosphere: {
    hi: [
      { thesis: "You trust the room more than the lyric.\nThe air around the song is the song.\nReverb as meaning.", hook: "Wonder if a flat-out statement song changes your mind." },
      { thesis: "Mood keeps beating message.\nYou'd rather feel it than be told.\nMostly.", hook: "Let me try one that says it out loud." },
    ],
    lo: [
      { thesis: "You want the song to say it.\nOut loud.\nNo hiding behind reverb.", hook: "Let's see if a haze-bomb still gets through." },
      { thesis: "Clarity keeps winning.\nDirect over dreamy.\nNoted.", hook: "What does a real atmosphere piece do to that?" },
    ],
  },
  immersion: {
    hi: [
      { thesis: "You don't need the hook on contact.\nThird listen, real estate opens up.\nYou wait the song out.", hook: "What does a song that grabs you in eight bars do for you?" },
      { thesis: "Slow burns keep winning.\nYou give songs the benefit of the doubt.\nThat's rarer than you think.", hook: "Curious if a fast-hooker still pulls you." },
    ],
    lo: [
      { thesis: "If it doesn't hook you fast, it doesn't hook you.\nEight bars or out.\nNo slow reveals.", hook: "Wonder if a sleeper still wins you over." },
      { thesis: "You vote on first impression.\nAnd you're not changing your mind.\nProbably.", hook: "Let me try a real grower on you." },
    ],
  },
  scale: {
    hi: [
      { thesis: "You want the song bigger than the room.\nCathedral over kitchen.\nMore air.", hook: "What about a song built for one set of headphones?" },
      { thesis: "Wide keeps winning.\nYou want space in the song.\nNot crowding.", hook: "Curious how a close-up one lands." },
    ],
    lo: [
      { thesis: "Up close.\nIn your ear.\nNo stadiums.", hook: "Let's see if a wall-of-sound moment still pulls you." },
      { thesis: "You want the song one inch away.\nNot one mile.\nIntimate by design.", hook: "What does a vast one do to that?" },
    ],
  },
  community: {
    hi: [
      { thesis: "Songs heard in rooms full of people.\nThe singalong is the meaning.\nMusic as gathering.", hook: "What about a song built for one set of headphones?" },
      { thesis: "Communal keeps winning.\nYou hear the crowd in the song.\nAnd you like it there.", hook: "Curious if a solo-listener piece still gets you." },
    ],
    lo: [
      { thesis: "Headphones. Alone. On purpose.\nCrowds dilute the signal.\nThe song is between you and it.", hook: "Curious if a singalong still moves you." },
      { thesis: "You keep it private.\nNo group hugs in the music.\nJust you.", hook: "Let me try one built for the room." },
    ],
  },
  perspective: {
    hi: [
      { thesis: "You want the song to show you something.\nNot become you.\nNarrator over screamer.", hook: "What happens with a song that wants you inside it?" },
      { thesis: "Distance keeps winning.\nYou like the camera, not the mirror.\nStorytellers over bleeders.", hook: "Wonder if a first-person one cracks that." },
    ],
    lo: [
      { thesis: "You don't want a report from the scene.\nYou want to be in it.\nFirst person, no distance.", hook: "Let's see if a great storyteller still gets through." },
      { thesis: "Inside the song, every time.\nNo glass.\nYou want the heat.", hook: "What does a great narrator do to that?" },
    ],
  },
  confidence: {
    hi: [
      { thesis: "You like a singer who isn't asking.\nPosture as music.\nNo flinching.", hook: "Wonder what a vulnerable one does to you." },
      { thesis: "Swagger keeps winning.\nYou want the song sure of itself.\nNo apologies.", hook: "Curious if a cracked voice still gets through." },
    ],
    lo: [
      { thesis: "The cracked admission over the swagger.\nThe flinch is the point.\nNo armor.", hook: "Curious if a power move still pulls you in." },
      { thesis: "You want the singer admitting something.\nNot performing.\nMostly.", hook: "Let me throw a confident one at you." },
    ],
  },
  tension: {
    hi: [
      { thesis: "You don't want the song to let you off.\nPressure all the way.\nNo exhale.", hook: "What does a real release do for you?" },
      { thesis: "Tension keeps winning.\nYou trust the squeeze.\nResolution can wait.", hook: "Curious if a real exhale changes that." },
    ],
    lo: [
      { thesis: "You want the song to let you breathe.\nExhale is the payoff.\nRoom to move.", hook: "Let's see if a real squeeze still gets through." },
      { thesis: "Release over pressure.\nYou want the door open.\nNot locked.", hook: "What does a song that won't resolve do to that?" },
    ],
  },
  texture: {
    hi: [
      { thesis: "Craft, not mess.\nPolish is the delivery system.\nThe seams should be invisible.", hook: "Wonder if a raw nerve still gets through." },
      { thesis: "Refinement keeps winning.\nYou hear the work.\nAnd you reward it.", hook: "Curious how a cracked take lands on you." },
    ],
    lo: [
      { thesis: "Cracked voice over the perfect take.\nEvery time.\nYou want it bleeding, not fixed.", hook: "What does a flawlessly produced one do for you?" },
      { thesis: "Grit keeps winning.\nYou trust the mess.\nPolish reads suspicious.", hook: "Let me try a clean one and see." },
    ],
  },
  transformation: {
    hi: [
      { thesis: "You want the song to become something.\nNot be something.\nBecoming is the whole bet.", hook: "What about a song that arrives fully formed?" },
      { thesis: "Evolution keeps winning.\nYou want the surprise inside the song.\nNot just at the start.", hook: "Curious if a song that holds its shape still pulls you." },
    ],
    lo: [
      { thesis: "You want the song to know what it is.\nFrom the first bar.\nNo identity crisis.", hook: "Let's try one that morphs on you." },
      { thesis: "Conviction keeps winning.\nThe song doesn't need to change to mean something.\nIt already does.", hook: "What does a real shape-shifter do to that?" },
    ],
  },
};

// dimSeed lives in engine/voice; pickVariant is the same shape as pickByHash.
import { dimSeed } from "@/musicdna/engine/voice";
const pickVariant = pickByHash;

// Derived descriptors — pure read off the 10 axes, kept in the engine so the
// synthesis prompt and any future client share one set of thresholds.
import { deriveDescriptors } from "@/musicdna/engine/descriptors";
export { deriveDescriptors };





export const recordChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
      pairingId: z.string().uuid(),
      chosenSongId: z.string().uuid(),
      msToDecide: z.number().int().nonnegative().max(600000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => recordChoiceImpl(context.supabase, context.userId, data));

export async function recordChoiceImpl(supabase: AuthedSupabase, userId: string, data: { sessionId: string; pairingId: string; chosenSongId: string; msToDecide?: number }) {
    const songCols = "id,title,artist,primary_lane,movement,atmosphere,immersion,scale,community,perspective,confidence,tension,texture,transformation";
    const [pairingRes, sessionRes] = await Promise.all([
      supabase
        .from("pairings")
        .select(`tests, diagnostic_weight, song_a_id, song_b_id, is_bootstrap, song_a:songs!pairings_song_a_id_fkey(${songCols}), song_b:songs!pairings_song_b_id_fkey(${songCols})`)
        .eq("id", data.pairingId).single(),
      supabase.from("sessions").select("vector,user_id,lane,probe_state,bootstrap_choices_json").eq("id", data.sessionId).single(),
    ]);
    const pairing = pairingRes.data as unknown as {
      tests: string[] | null; diagnostic_weight: number; song_a_id: string; song_b_id: string;
      is_bootstrap: boolean | null;
      song_a: Record<string, number> & { id: string; title: string; artist: string; primary_lane: string | null };
      song_b: Record<string, number> & { id: string; title: string; artist: string; primary_lane: string | null };
    } | null;
    const session = sessionRes.data as {
      vector: Record<string, number>; user_id: string; lane: Lane; probe_state: ProbeState | null;
      bootstrap_choices_json: BootstrapChoiceEntry[] | null;
    } | null;
    if (pairingRes.error || !pairing) throw new Error(pairingRes.error?.message ?? "pairing not found");
    if (sessionRes.error || !session) throw new Error(sessionRes.error?.message ?? "session not found");
    if (session.user_id !== userId) throw new Error("forbidden");


    // Reject choices that don't actually correspond to one of this pairing's songs.
    if (data.chosenSongId !== pairing.song_a_id && data.chosenSongId !== pairing.song_b_id) {
      throw new Error("invalid choice: chosenSongId is not part of this pairing");
    }
    const chosenIsA = data.chosenSongId === pairing.song_a_id;
    const winner = chosenIsA ? pairing.song_a : pairing.song_b;
    const loser = chosenIsA ? pairing.song_b : pairing.song_a;
    const rejectedSongId = chosenIsA ? pairing.song_b_id : pairing.song_a_id;
    const priorVec: Record<string, number> = { ...(session.vector as Record<string, number>) };
    const applied = applyChoice({
      prior_vector: priorVec,
      winner: winner as unknown as Record<string, number>,
      loser: loser as unknown as Record<string, number>,
      tests: (pairing.tests as string[] | null) ?? [],
      diagnostic_weight: pairing.diagnostic_weight,
      fallback_dims: DIMS as readonly string[],
    });
    const vec = applied.vector;
    const tests: string[] = pairing.tests?.length ? pairing.tests : (DIMS as readonly string[]).slice();
    const topDim = applied.top_dim;
    const topDelta = applied.top_delta;
    const deltaVec = applied.delta_vector;

    // Round-aware reveal builder.
    // Rounds 1–2 stay curious (no identity claims). Round 3+ adds a hedged
    // observation. Round 5+ with real support unlocks the confident reads.
    // Axis label is spoken ONCE per session per pole (tracked by whether the
    // running vector already carries meaningful weight on that dim).
    const { count: priorChoices } = await supabase
      .from("choices")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data.sessionId);
    const round = (priorChoices ?? 0) + 1;
    const direction: "hi" | "lo" = topDelta >= 0 ? "hi" : "lo";
    const pole = POLES[topDim]?.[direction];
    const priorSupport = Math.abs(priorVec[topDim] ?? 0);
    const axisMentioned = priorSupport > 4; // one prior contribution on this pole
    const pairingHash = data.pairingId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const seedA = (priorChoices ?? 0) * 7 + dimSeed(topDim) + (direction === "hi" ? 0 : 1) + pairingHash;
    const seedB = seedA * 31 + 13;
    const ms = data.msToDecide ?? null;
    const speedBeat = hesitationFor(ms, seedA);
    const hedge = hedgeForRound(round);

    // Line 1: reaction. Round 1 skips the hedge (avoid pretending pattern).
    // Hedge goes on its own line so the UI can render it as a small label
    // above the actual verdict — otherwise "Early read: Rehab over Blank
    // Space." reads flat and same-size as everything else.
    const reactionCore = `${winner.title} over ${loser.title}.`;
    const reaction = round === 1 ? reactionCore : `${hedge}\n${reactionCore}`;

    // Line 2: axis label (first mention) OR a fresh observation. Never both.
    let inference = "";
    if (pole) {
      if (!axisMentioned) {
        inference = `That's ${pole.axis_label}.`;
      } else if (round >= 3) {
        inference = pickByHash(pole.observations, seedA) ?? "";
      }
    }

    // `why` carries a second, different observation only once we've earned it:
    // round ≥ 5 AND at least ~3 supporting contributions on this pole.
    const strongEnough = round >= 5 && priorSupport >= 30;
    let why = "";
    if (pole && strongEnough) {
      // Pick a different observation than the inference line.
      const pool = pole.observations.filter((o) => o !== inference);
      why = pickByHash(pool, seedB) ?? "";
    }

    const verdict = [reaction, inference, speedBeat].filter(Boolean).join("\n");

    // Dev-only guard against leaking internal vocabulary into user copy.
    if (process.env.NODE_ENV !== "production") {
      const bag = `${inference} ${why}`.toLowerCase();
      for (const tok of FORBIDDEN_TOKENS) {
        if (bag.includes(tok)) {
          // eslint-disable-next-line no-console
          console.warn(`[musicdna] reveal copy contains forbidden token "${tok}" on dim=${topDim} dir=${direction}`);
        }
      }
    }

    // Kept for back-compat with older UI paths that read `hesitation`.
    const hesitation = speedBeat || null;

    const { error: cErr } = await supabase.from("choices").insert({
      session_id: data.sessionId,
      pairing_id: data.pairingId,
      chosen_song_id: data.chosenSongId,
      rejected_song_id: rejectedSongId,
      ms_to_decide: data.msToDecide ?? null,
    });
    if (cErr) {
      // 23505 = unique_violation — same pairing already recorded for this session.
      // Surface a clean error instead of letting a replay distort the vector.
      if ((cErr as { code?: string }).code === "23505") {
        throw new Error("this pairing has already been answered for this session");
      }
      throw new Error(cErr.message);
    }

    // Cross-lane probe flipping is quarantined. See
    // src/musicdna/engine/experiments/cross-lane-probes.ts and
    // mem://product/within-lane-only.md. The nextPairing invariant guarantees
    // probe_state.pending is empty, so there is nothing to score here — the
    // session's lane and probe_state pass through unchanged.
    let nextLane: Lane = session.lane;
    let nextLaneConfidence: number | null = null;
    const probeState = session.probe_state ?? { probes_shown: [], pending: {}, lane_alignment: {}, flips: [] };

    // -------- Bootstrap-phase bookkeeping + lane promotion --------
    // If this pairing was flagged is_bootstrap AND the session is still
    // general, append the winner's primary_lane to bootstrap_choices_json.
    // After the 2nd bootstrap choice, if both winners agree on a lane,
    // promote sessions.lane and confidence so the remaining pairings come
    // from that lane. Disagreement leaves the session in general.
    let bootstrapChoices = session.bootstrap_choices_json ?? [];
    let bootstrapEvent: null | { type: "lane_promoted" | "lane_promotion_failed"; props: Record<string, unknown> } = null;
    if (pairing.is_bootstrap && session.lane === "general" && bootstrapChoices.length < 2) {
      bootstrapChoices = [
        ...bootstrapChoices,
        {
          pairing_id: data.pairingId,
          winner_primary_lane: winner.primary_lane ?? null,
          loser_primary_lane: loser.primary_lane ?? null,
        },
      ];
      if (bootstrapChoices.length === 2) {
        const [a, b] = bootstrapChoices;
        const aLane = a.winner_primary_lane;
        const bLane = b.winner_primary_lane;
        if (aLane && bLane && aLane === bLane && (LANES as readonly string[]).includes(aLane) && aLane !== "general") {
          nextLane = aLane as Lane;
          nextLaneConfidence = 0.65;
          bootstrapEvent = {
            type: "lane_promoted",
            props: { from: "general", to: aLane, winners: bootstrapChoices, confidence: 0.65 },
          };
        } else {
          bootstrapEvent = {
            type: "lane_promotion_failed",
            props: { winners: bootstrapChoices, reason: aLane === bLane ? "invalid_lane" : "winners_disagree" },
          };
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      vector: vec,
      lane: nextLane,
      probe_state: probeState,
      bootstrap_choices_json: bootstrapChoices,
    };
    if (nextLaneConfidence !== null) updatePayload.lane_confidence = nextLaneConfidence;
    const { error: uErr } = await supabase
      .from("sessions")
      .update(updatePayload as never)
      .eq("id", data.sessionId);
    if (uErr) throw new Error(uErr.message);

    // Fire-and-forget promotion event. Diagnostics only.
    if (bootstrapEvent) {
      try {
        await supabase.from("event_log").insert({
          user_id: userId,
          session_id: data.sessionId,
          pairing_id: data.pairingId,
          event_type: bootstrapEvent.type,
          client: "server",
          props: bootstrapEvent.props,
        } as never);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[musicdna] bootstrap event log failed:", e instanceof Error ? e.message : e);
      }
    }


    // -------- Instrumentation: emit choice_scored + (milestone) archetype_ranking_snapshot --------
    // Fire-and-forget. Failures never break the choice flow — diagnostics are
    // an observability channel, not a product invariant. See
    // docs/musicdna/instrumentation.md for the field contract.
    try {
      await emitChoiceDiagnostics(supabase, userId, {
        sessionId: data.sessionId,
        pairingId: data.pairingId,
        chosenSongId: data.chosenSongId,
        rejectedSongId,
        round,
        tests,
        priorVec,
        deltaVec,
        weightedVec: vec,
        diagnosticWeight: pairing.diagnostic_weight ?? 50,
        chosenArtist: winner.artist ?? null,
        msToDecide: data.msToDecide ?? null,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[musicdna] emitChoiceDiagnostics failed:", e instanceof Error ? e.message : e);
    }

    return { vector: vec, verdict, why, hesitation, dim: topDim, delta: topDelta };
}

// ============ Skip pairing ============
// User signal: "I don't know either of these — show me something else."
// Never affects the vector, never counts as a bootstrap choice. We record
// the pairing_id in probe_state.skipped_pairing_ids so it can't be re-served
// this session, flip probe_state.wants_wider_probe so nextPairingImpl can
// reach outside the opener lanes on the next bootstrap draw, and log a
// pairing_skipped event for diagnostics.
export const skipPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
      pairingId: z.string().uuid(),
      msToDecide: z.number().int().nonnegative().max(600000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => skipPairingImpl(context.supabase, context.userId, data));

export async function skipPairingImpl(
  supabase: AuthedSupabase,
  userId: string,
  data: { sessionId: string; pairingId: string; msToDecide?: number },
) {
  const sessionRes = await supabase
    .from("sessions")
    .select("user_id, probe_state")
    .eq("id", data.sessionId)
    .single();
  if (sessionRes.error || !sessionRes.data) {
    throw new Error(sessionRes.error?.message ?? "session not found");
  }
  if (sessionRes.data.user_id !== userId) throw new Error("forbidden");
  const probeState = (sessionRes.data.probe_state ?? {}) as ProbeState;
  probeState.probes_shown = probeState.probes_shown ?? [];
  probeState.pending = probeState.pending ?? {};
  probeState.lane_alignment = probeState.lane_alignment ?? {};
  probeState.flips = probeState.flips ?? [];
  const skipped = new Set(probeState.skipped_pairing_ids ?? []);
  skipped.add(data.pairingId);
  probeState.skipped_pairing_ids = Array.from(skipped);
  probeState.wants_wider_probe = true;

  const { error: uErr } = await supabase
    .from("sessions")
    .update({ probe_state: probeState } as never)
    .eq("id", data.sessionId);
  if (uErr) throw new Error(uErr.message);

  try {
    await supabase.from("event_log").insert({
      user_id: userId,
      session_id: data.sessionId,
      pairing_id: data.pairingId,
      event_type: "pairing_skipped",
      client: "server",
      props: { ms_to_decide: data.msToDecide ?? null },
    } as never);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[musicdna] pairing_skipped event log failed:", e instanceof Error ? e.message : e);
  }

  return { ok: true as const };
}



// ============ Instrumentation helper (per-choice diagnostic snapshot) ============
// Loads the archetype catalog, recomputes rankings on the just-updated
// vector, and writes two events into event_log.props for offline analysis:
//   • choice_scored — always. Full snapshot of this pairing's contribution.
//   • archetype_ranking_snapshot — at rounds 8/10/12/14 (stability checkpoints)
//     AND when shouldStop says we're done (is_final=true). Cheap; makes the
//     "did the winner change late?" query one WHERE clause.
async function emitChoiceDiagnostics(
  supabase: AuthedSupabase,
  userId: string,
  args: {
    sessionId: string;
    pairingId: string;
    chosenSongId: string;
    rejectedSongId: string;
    round: number;
    tests: string[];
    priorVec: Record<string, number>;
    deltaVec: Record<string, number>;
    weightedVec: Record<string, number>;
    diagnosticWeight: number;
    chosenArtist: string | null;
    msToDecide: number | null;
  },
): Promise<void> {
  const archRes = await supabase
    .from("archetypes")
    .select("id,name,signature_axes");
  const catalog = ((archRes.data ?? []) as unknown as Array<{
    id: string; name: string; signature_axes: Record<string, number> | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    signature_axes: r.signature_axes,
  }));

  const { assignment, flagged, flag_reason } = assignArchetype(args.weightedVec, catalog);
  const winnerAxes = catalog.find((c) => c.id === assignment?.id)?.signature_axes ?? {};

  // Per-axis contribution of THIS choice to the current winner's cosine numerator.
  // contribution_i = (vec_after[i]/100) * winner_axes[i]  minus the same on vec_before —
  // i.e. how much this pairing shifted the raw dot product with the winner.
  const supports: Record<string, number> = {};
  const contradicts: Record<string, number> = {};
  let positive = 0;
  let negative = 0;
  for (const axis of args.tests) {
    const w = winnerAxes[axis] ?? 0;
    if (w === 0) continue;
    const before = (args.priorVec[axis] ?? 0) / 100 * w;
    const after = (args.weightedVec[axis] ?? 0) / 100 * w;
    const delta = after - before;
    if (delta >= 0) { supports[axis] = round3(delta); positive += delta; }
    else            { contradicts[axis] = round3(delta); negative += Math.abs(delta); }
  }

  const rankings = assignment
    ? [{ id: assignment.id, name: assignment.name, score: assignment.score },
       ...assignment.runners_up.map((r) => ({ id: r.id, name: r.name, score: r.score }))]
    : [];

  await supabase.from("event_log").insert({
    user_id: userId,
    session_id: args.sessionId,
    pairing_id: args.pairingId,
    event_type: "choice_scored",
    client: "server",
    props: {
      round: args.round,
      chosen_song_id: args.chosenSongId,
      rejected_song_id: args.rejectedSongId,
      chosen_artist: args.chosenArtist,
      ms_to_decide: args.msToDecide,
      axes_tested: args.tests,
      vector_before: args.priorVec,
      raw_delta: args.deltaVec,
      vector_after: args.weightedVec,
      diagnostic_weight: args.diagnosticWeight,
      winner_id: assignment?.id ?? null,
      winner_name: assignment?.name ?? null,
      winner_score: assignment?.score ?? null,
      margin: assignment?.margin ?? null,
      fit_tier: assignment?.fit_tier ?? null,
      supports,
      contradicts,
      positive_contribution: round3(positive),
      negative_contribution: round3(negative),
      flagged,
      flag_reason,
      archetype_rankings: rankings,
    } as never,
  });

  const STABILITY_CHECKPOINTS = new Set([8, 10, 12, 14]);
  const isCheckpoint = STABILITY_CHECKPOINTS.has(args.round);
  const stop = shouldStop({ round: args.round, vector: args.weightedVec, dims: DIMS as readonly string[] });
  const isFinal = stop.done;
  if (isCheckpoint || isFinal) {
    await supabase.from("event_log").insert({
      user_id: userId,
      session_id: args.sessionId,
      event_type: "archetype_ranking_snapshot",
      client: "server",
      props: {
        round: args.round,
        top3: rankings.slice(0, 3),
        margin: assignment?.margin ?? null,
        fit_tier: assignment?.fit_tier ?? null,
        flagged,
        flag_reason,
        is_final: isFinal,
      } as never,
    });
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}





// ============================================================
// ANALYST (deterministic) + CRITIC (AI) pipeline.
// The Analyst builds observations, patterns, and counter-hypotheses from
// stored choices and song vectors. Only claims clearing the evidence
// threshold are handed to the Critic, who is told — in no uncertain terms —
// that he is a music critic, not a therapist.
// ============================================================

const BANNED_WORDS = [
  "dreamer","seeker","old soul","empath","creative spirit","destiny",
  "wound","soul","trauma","secretly","you are the kind of person who",
  "energy","aura","journey of self","authentic self","true self",
];

const CRITIC_VOICE = `${PERSONA}
Mode: long-form critic write-up. You are not a therapist, astrologer, psychologist, or life coach — you are reading patterns in choices, not diagnosing a person.
Every claim must reference the evidence you were given. Acknowledge uncertainty where the evidence is thin. Do not invent claims that are not in the allowed_claims list.
Banned words: ${BANNED_WORDS.join(", ")}.
Prefer: "across these choices", "this suggests", "you repeatedly favored", "the strongest evidence is", "a weaker reading would be".`;

export const finalizeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => finalizeSessionImpl(context.supabase, context.userId, data));

export async function finalizeSessionImpl(supabase: AuthedSupabase, userId: string, data: { sessionId: string }) {
    const { data: session, error: sErr } = await supabase
      .from("sessions").select("vector,user_id").eq("id", data.sessionId).single();
    if (sErr || !session) throw new Error(sErr?.message ?? "session not found");
    if (session.user_id !== userId) throw new Error("forbidden");

    const songCols = "id,title,artist,year,lane,movement,atmosphere,immersion,scale,community,perspective,confidence,tension,texture,transformation";

    // -------- Pull raw evidence --------
    const [archRes, choicesRes] = await Promise.all([
      supabase.from("archetypes").select("id,name,tagline,signature_axes,core_question,commentary_keywords,confidence_thresholds"),
      supabase
        .from("choices")
        .select(`
          ms_to_decide,
          pairing:pairing_id(tests, diagnostic_weight),
          chosen:chosen_song_id(${songCols}),
          rejected:rejected_song_id(${songCols})
        `)
        .eq("session_id", data.sessionId),
    ]);
    const archetypes = archRes.data ?? [];
    type SongRow = Record<string, number | string | null> & { id: string; title: string; artist: string; year: number | null; lane: string };
    type ChoiceRow = {
      ms_to_decide: number | null;
      pairing: { tests: string[] | null; diagnostic_weight: number | null } | null;
      chosen: SongRow | null;
      rejected: SongRow | null;
    };
    const choices = ((choicesRes.data ?? []) as unknown as ChoiceRow[]).filter((c) => c.chosen && c.rejected);

    // -------- Layer 1: Observations --------
    const observations = choices.map((c) => ({
      chosen: c.chosen!.title,
      chosen_artist: c.chosen!.artist,
      rejected: c.rejected!.title,
      rejected_artist: c.rejected!.artist,
      tested_dimensions: c.pairing?.tests ?? [],
      ms_to_decide: c.ms_to_decide,
    }));

    // -------- Layer 2: Patterns (per axis) --------
    type PatternAcc = {
      chosen_dir: number;      // +1 each time chosen side > rejected on this axis
      rejected_dir: number;    // +1 each time rejected side > chosen
      magnitude: number;       // sum of |delta|, weighted by diagnostic_weight
      supporting: number;      // count of choices where this axis was tested
      examples: Array<{ chosen: string; rejected: string; delta: number }>;
    };
    const acc: Record<string, PatternAcc> = {};
    for (const c of choices) {
      const tests = c.pairing?.tests?.length ? c.pairing.tests : (DIMS as readonly string[]).slice();
      const w = ((c.pairing?.diagnostic_weight ?? 50) / 100);
      for (const dim of tests) {
        const a = Number(c.chosen![dim] ?? 50);
        const b = Number(c.rejected![dim] ?? 50);
        const delta = a - b;
        if (!acc[dim]) acc[dim] = { chosen_dir: 0, rejected_dir: 0, magnitude: 0, supporting: 0, examples: [] };
        acc[dim].supporting += 1;
        acc[dim].magnitude += Math.abs(delta) * w;
        if (delta > 5) acc[dim].chosen_dir += 1;
        else if (delta < -5) acc[dim].rejected_dir += 1;
        if (Math.abs(delta) > 15 && acc[dim].examples.length < 3) {
          acc[dim].examples.push({ chosen: c.chosen!.title, rejected: c.rejected!.title, delta });
        }
      }
    }

    const patterns = Object.entries(acc).map(([dim, p]) => {
      const direction: "hi" | "lo" = p.chosen_dir >= p.rejected_dir ? "hi" : "lo";
      const supporting_choices = direction === "hi" ? p.chosen_dir : p.rejected_dir;
      const label = DIM_LABEL[dim];
      // confidence = directional consistency * magnitude factor
      const consistency = p.supporting > 0 ? supporting_choices / p.supporting : 0;
      const magnitudeFactor = Math.min(1, p.magnitude / (p.supporting * 30 || 1));
      const confidence = Number((consistency * 0.7 + magnitudeFactor * 0.3).toFixed(3));
      return {
        dimension: dim,
        preferred: direction === "hi" ? label?.hi : label?.lo,
        opposed: direction === "hi" ? label?.lo : label?.hi,
        supporting_choices,
        tested_total: p.supporting,
        confidence,
        examples: p.examples,
        tradeoff: `${direction === "hi" ? label?.hi : label?.lo} over ${direction === "hi" ? label?.lo : label?.hi}`,
      };
    }).sort((x, y) => y.confidence - x.confidence);

    // -------- Layer 3: Counter-hypotheses --------
    const counterarguments: Array<{ claim: string; impact: "low" | "medium" | "high"; notes: string }> = [];
    const artistCount: Record<string, number> = {};
    const eraCount: Record<string, number> = {};
    const laneCount: Record<string, number> = {};
    let fastPicks = 0;
    for (const c of choices) {
      const artist = c.chosen!.artist;
      artistCount[artist] = (artistCount[artist] ?? 0) + 1;
      const year = Number(c.chosen!.year);
      if (year) {
        const decade = `${Math.floor(year / 10) * 10}s`;
        eraCount[decade] = (eraCount[decade] ?? 0) + 1;
      }
      const lane = String(c.chosen!.lane ?? "");
      if (lane) laneCount[lane] = (laneCount[lane] ?? 0) + 1;
      if ((c.ms_to_decide ?? 99999) < 2000) fastPicks += 1;
    }
    for (const [artist, n] of Object.entries(artistCount)) {
      if (n >= 3) counterarguments.push({
        claim: `User may simply prefer ${artist}.`,
        impact: n >= 5 ? "high" : "medium",
        notes: `${n} of ${choices.length} winning songs are by ${artist}.`,
      });
    }
    for (const [decade, n] of Object.entries(eraCount)) {
      if (n >= Math.max(4, Math.ceil(choices.length * 0.5))) counterarguments.push({
        claim: `User may be selecting on era (${decade}) rather than the tested dimensions.`,
        impact: "medium",
        notes: `${n} winning songs come from the ${decade}.`,
      });
    }
    for (const [lane, n] of Object.entries(laneCount)) {
      if (n >= Math.max(4, Math.ceil(choices.length * 0.6))) counterarguments.push({
        claim: `User may be selecting on lane (${lane}) rather than diagnostic tradeoffs.`,
        impact: "medium",
        notes: `${n} winning songs share the ${lane} lane.`,
      });
    }
    if (choices.length >= 8 && fastPicks / choices.length >= 0.6) counterarguments.push({
      claim: "Many picks were snap decisions. Familiarity may be driving choice as much as taste.",
      impact: "medium",
      notes: `${fastPicks} of ${choices.length} choices resolved in under 2 seconds.`,
    });

    // -------- Layer 4: Evidence threshold --------
    // Tuned for 6-round adaptive test: 2 supporting choices on an axis is
    // enough to call a tendency, as long as direction is consistent and the
    // magnitude is real. 0.55 keeps out pure noise without demanding 12 rounds.
    const MIN_SUPPORT = 2;
    const MIN_CONFIDENCE = 0.55;
    const allowed_claims = patterns
      .filter((p) => p.supporting_choices >= MIN_SUPPORT && p.confidence >= MIN_CONFIDENCE)
      .slice(0, 5);
    const blocked_claims = patterns
      .filter((p) => !(p.supporting_choices >= MIN_SUPPORT && p.confidence >= MIN_CONFIDENCE))
      .slice(0, 5);

    // -------- Archetype (via engine.assignArchetype — one implementation of
    //          scoring/margin/flagging shared with tests and REST) --------
    const vector = (session.vector ?? {}) as Record<string, number>;
    type ArchetypeRow = {
      id: string;
      name: string;
      signature_axes: Record<string, number> | null;
      core_question: string | null;
      commentary_keywords: string[] | null;
      confidence_thresholds: Record<string, string> | null;
    };
    const catalogRows = (archetypes as unknown as ArchetypeRow[]);
    const { assignment, winner_row, flagged: archetypeFlagged, flag_reason: archetypeFlagReason } =
      assignArchetype(vector, catalogRows);

    const top3 = assignment
      ? [
          { archetype_id: assignment.id, name: assignment.name, score: assignment.score },
          ...assignment.runners_up.map((r: { id: string | null; name: string; score: number }) => ({
            archetype_id: r.id,
            name: r.name,
            score: r.score,
          })),
        ]
      : [];
    const bestRow = winner_row as ArchetypeRow | null;
    const best = assignment
      ? { id: assignment.id, name: assignment.name, score: assignment.score }
      : { id: null as string | null, name: "", score: -Infinity };
    const margin = assignment?.margin ?? 0;


    // -------- Log Analyst (deterministic, no model call) --------
    await supabase.from("llm_calls").insert({
      user_id: userId,
      session_id: data.sessionId,
      role: "analyst",
      model: "deterministic",
      prompt_version: "analyst.v1",
      status: "ok",
      latency_ms: 0,
      input_summary: {
        choices: choices.length,
        archetypes: archetypes.length,
        archetype_top3: top3,
        archetype_margin: Math.round(margin * 1000) / 1000,
        archetype_flagged: archetypeFlagged,
        archetype_flag_reason: archetypeFlagReason,
      },
      output: { patterns, counterarguments, allowed_claims, blocked_claims } as never,
      confidence: assignment?.score ?? null,
    });

    // -------- Layer 5: Critic (AI narrative, constrained) --------
    const evidenceBlock = allowed_claims.length
      ? allowed_claims.map((c) =>
          `- ${c.tradeoff} (${c.supporting_choices}/${c.tested_total} relevant matchups, confidence ${c.confidence}). Examples: ${c.examples.map((e) => `${e.chosen} > ${e.rejected}`).join("; ") || "—"}`
        ).join("\n")
      : "- (no claims cleared the evidence threshold)";
    const counterBlock = counterarguments.length
      ? counterarguments.map((c) => `- ${c.claim} (${c.impact} impact — ${c.notes})`).join("\n")
      : "- (none)";

    // Pick the confidence tier from the winning cosine score. Each archetype
    // ships its own phrasings for 20/50/80/95, so the critic's opening hedge
    // tracks the actual evidence instead of always sounding equally sure.
    const bestScore = assignment?.score ?? 0;
    const tier = bestScore >= 0.95 ? "95"
               : bestScore >= 0.80 ? "80"
               : bestScore >= 0.50 ? "50"
               : "20";
    const thresholds = (bestRow?.confidence_thresholds ?? {}) as Record<string, string>;
    const openingHedge = thresholds[tier] ?? null;
    const keywords = (bestRow?.commentary_keywords ?? []) as string[];
    const coreQuestion = bestRow?.core_question ?? null;

    const archetypeVoiceBlock = bestRow
      ? `\nARCHETYPE (aesthetic, not personality): ${bestRow.name}${coreQuestion ? ` — core question: "${coreQuestion}"` : ""}. Cosine confidence: ${Math.round(bestScore * 100)}%.
Opening hedge for this confidence tier (use as your first move; do not quote verbatim if it doesn't fit the flow): "${openingHedge ?? ""}"
Draw from this archetype's vocabulary where natural (do not list, do not overuse, no more than 3-4 of these across the write-up): ${keywords.slice(0, 24).join(", ") || "(none)"}.`
      : "";

    const criticPrompt = `Write 3-4 sentences about this listener. Use ONLY the allowed claims below. \
Cite the evidence inline (e.g. "across 7 of 12 matchups"). If a strong counter-hypothesis exists, name it. \
If no claims cleared the threshold, say so plainly — do not invent. \
Frame the archetype as what this listener SEEKS from music, not who they are as a person.
${archetypeVoiceBlock}

ALLOWED CLAIMS:
${evidenceBlock}

COUNTER-HYPOTHESES TO ACKNOWLEDGE:
${counterBlock}

Archetype assigned by cosine match: ${best.name || "Unassigned"}.`;

    const criticStart = Date.now();
    let narrative = "";
    let criticStatus: "ok" | "error" = "ok";
    let criticError: string | null = null;
    try {
      narrative = await ai([
        { role: "system", content: CRITIC_VOICE },
        { role: "user", content: criticPrompt },
      ]);
    } catch (e) {
      criticStatus = "error";
      criticError = e instanceof Error ? e.message : String(e);
    }
    const criticLatency = Date.now() - criticStart;

    await supabase.from("llm_calls").insert({
      user_id: userId,
      session_id: data.sessionId,
      role: "critic",
      model: MODEL,
      prompt_version: "critic.v1",
      status: criticStatus,
      latency_ms: criticLatency,
      error_message: criticError,
      input_summary: {
        allowed_claims: allowed_claims.length,
        counterarguments: counterarguments.length,
        archetype: best.name,
        fit_tier: tier,
        cosine_score: Math.round(bestScore * 1000) / 1000,
      },
      output: { length: narrative.length } as never,
      narrative: narrative || null,
    });

    // If the critic AI failed, don't strand the user — fall back to a
    // deterministic narrative built from the allowed claims. The error is
    // already logged to llm_calls above.
    if (criticStatus === "error" || !narrative.trim()) {
      narrative = allowed_claims.length
        ? `Across these matchups you kept choosing ${allowed_claims[0].tradeoff} (${allowed_claims[0].supporting_choices} of ${allowed_claims[0].tested_total} relevant picks). The shape's there — consistent, if not loud.`
        : `Nothing cleared the evidence threshold this round. Either you're harder to read than most, or the matchups didn't catch you. Worth another pass.`;
    }

    // -------- Persist --------
    const reasoningRow = {
      session_id: data.sessionId,
      user_id: userId,
      observations,
      patterns,
      counterarguments,
      allowed_claims,
      blocked_claims,
      evidence_thresholds: { supporting_choices: MIN_SUPPORT, confidence_threshold: MIN_CONFIDENCE },
      narrative,
    };
    await supabase.from("session_reasoning").upsert(reasoningRow, { onConflict: "session_id" });
    await supabase.from("sessions").update({
      archetype_id: best.id,
      archetype_top3: top3,
      archetype_score: assignment ? assignment.score : null,
      archetype_margin: assignment ? assignment.margin : null,
      archetype_flagged: archetypeFlagged,
      archetype_flag_reason: archetypeFlagReason,
      interpretation: narrative,
      completed_at: new Date().toISOString(),
    }).eq("id", data.sessionId);

    return {
      archetypeId: best.id,
      archetypeName: best.name,
      interpretation: narrative,
      vector,
      allowed_claims,
      counterarguments,
    };
}


// ============ Get latest profile + session for /profile page ============
export const getMyResult = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getMyResultImpl(context.supabase, context.userId));

export async function getMyResultImpl(supabase: AuthedSupabase, userId: string) {
    const [{ data: profile }, { data: sessions }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("sessions")
        .select("id,share_token,started_at,completed_at,interpretation,vector,archetype:archetype_id(id,name,tagline,description)")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);
    const latest = sessions?.[0];
    let definingChoices: Array<{ chosen: string; chosenArtist: string; rejected: string; rejectedArtist: string }> = [];
    type Claim = {
      dimension: string;
      preferred?: string;
      opposed?: string;
      supporting_choices: number;
      tested_total: number;
      confidence: number;
      examples: Array<{ chosen: string; rejected: string; delta: number }>;
      tradeoff: string;
    };
    type Counter = { claim: string; impact: "low" | "medium" | "high"; notes: string };
    let reasoning: {
      allowed_claims: Claim[];
      blocked_claims: Claim[];
      counterarguments: Counter[];
      patterns: Claim[];
    } | null = null;

    if (latest) {
      const [choicesRes, reasoningRes] = await Promise.all([
        supabase
          .from("choices")
          .select("created_at, ms_to_decide, chosen:chosen_song_id(title,artist), rejected:rejected_song_id(title,artist)")
          .eq("session_id", latest.id)
          .order("ms_to_decide", { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from("session_reasoning")
          .select("allowed_claims, blocked_claims, counterarguments, patterns")
          .eq("session_id", latest.id)
          .maybeSingle(),
      ]);
      definingChoices = ((choicesRes.data ?? []) as unknown as Array<{
        chosen: { title: string; artist: string } | null;
        rejected: { title: string; artist: string } | null;
      }>)
        .filter((c) => c.chosen && c.rejected)
        .map((c) => ({
          chosen: c.chosen!.title, chosenArtist: c.chosen!.artist,
          rejected: c.rejected!.title, rejectedArtist: c.rejected!.artist,
        }));
      reasoning = (reasoningRes.data as unknown as typeof reasoning) ?? null;
    }
    return { profile, sessions: sessions ?? [], definingChoices, reasoning };
}


// ============ Instrumentation: events + feedback ============

const EVENT_TYPES = [
  "onboarding_viewed",
  "onboarding_three_submitted",
  "onboarding_slot_submitted",
  "onboarding_classified",
  "pairing_shown",
  "choice_made",
  "pairing_skipped",
  "reveal_shown",
  "reveal_continued",
  "session_completed",
  "result_viewed",
  "result_shared",
  "session_quit",
  "lane_probed",
  "lane_flipped",
  // Instrumentation (server-emitted, see emitChoiceDiagnostics):
  "choice_scored",
  "archetype_ranking_snapshot",
] as const;


export const recordEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      event_type: z.enum(EVENT_TYPES),
      session_id: z.string().uuid().nullable().optional(),
      pairing_id: z.string().uuid().nullable().optional(),
      choice_id: z.string().uuid().nullable().optional(),
      response_time_ms: z.number().int().nonnegative().max(600000).nullable().optional(),
      variant: z.string().max(80).nullable().optional(),
      experiment_key: z.string().max(80).nullable().optional(),
      props: z.record(z.unknown()).optional(),
      client: z.string().max(40).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("event_log").insert({
      user_id: userId,
      event_type: data.event_type,
      session_id: data.session_id ?? null,
      pairing_id: data.pairing_id ?? null,
      choice_id: data.choice_id ?? null,
      response_time_ms: data.response_time_ms ?? null,
      variant: data.variant ?? null,
      experiment_key: data.experiment_key ?? null,
      props: (data.props ?? {}) as never,
      client: data.client ?? "web",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      session_id: z.string().uuid(),
      // "partly" is the plan's three-way accuracy label; kept alongside
      // the pre-existing "mixed" alias so older UI paths still submit.
      accuracy: z.enum(["accurate", "not_accurate", "mixed", "partly", "wrong"]).nullable().optional(),
      rating: z.number().int().min(-1).max(1).nullable().optional(),
      comment: z.string().max(2000).nullable().optional(),
      target: z.string().max(120).nullable().optional(),
      // Reveal-sentence-level feedback (see docs/musicdna/instrumentation.md).
      most_accurate_sentence: z.string().max(1000).nullable().optional(),
      least_accurate_sentence: z.string().max(1000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Normalize accuracy aliases so downstream analysis has a single vocabulary.
    const accuracy = data.accuracy === "partly" ? "mixed"
                   : data.accuracy === "wrong" ? "not_accurate"
                   : data.accuracy ?? null;
    // Only include the new sentence columns when the client actually sent
    // them — keeps the write payload valid against pre-migration schemas.
    const sentenceCols: Record<string, string | null> = {};
    if (data.most_accurate_sentence !== undefined) sentenceCols.most_accurate_sentence = data.most_accurate_sentence;
    if (data.least_accurate_sentence !== undefined) sentenceCols.least_accurate_sentence = data.least_accurate_sentence;
    const row = {
      user_id: userId,
      session_id: data.session_id,
      accuracy,
      rating: data.rating ?? null,
      comment: data.comment ?? null,
      target: data.target ?? null,
      ...sentenceCols,
    };
    // One feedback row per (user, session, target)
    const q = supabase
      .from("result_feedback")
      .select("id")
      .eq("user_id", userId)
      .eq("session_id", data.session_id);
    const { data: existing } = await (data.target
      ? q.eq("target", data.target)
      : q.is("target", null)
    ).maybeSingle();
    if (existing?.id) {
      const { error } = await supabase.from("result_feedback").update(row).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, updated: true as const };
    }
    const { data: inserted, error } = await supabase
      .from("result_feedback").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    // Nudge the per-user critic profile from explicit feedback.
    // Defined later in this file; safe to call via hoisted function declarations.
    try { await nudgeCriticFromFeedback(supabase as never, userId, { ...data, accuracy }); } catch { /* best-effort */ }
    return { id: inserted.id, updated: false as const };
  });

// Apply explicit thumb/accuracy/comment to the per-user critic_profile.
async function nudgeCriticFromFeedback(
  supabase: { from: (t: string) => any },
  userId: string,
  fb: { accuracy?: string | null; rating?: number | null; comment?: string | null; target?: string | null },
): Promise<void> {
  const { data: existing } = await supabase
    .from("critic_profile")
    .select("bluntness, playfulness, patience, provocation_appetite, move_tally, forbidden_moves, turns_observed")
    .eq("user_id", userId)
    .maybeSingle();
  const p = {
    bluntness: existing?.bluntness ?? 0,
    playfulness: existing?.playfulness ?? 0,
    patience: existing?.patience ?? 0,
    provocation_appetite: existing?.provocation_appetite ?? 0,
    move_tally: (existing?.move_tally ?? {}) as Record<string, { landed?: number; ignored?: number; pushed_back?: number }>,
    forbidden_moves: (existing?.forbidden_moves ?? []) as string[],
    turns_observed: existing?.turns_observed ?? 0,
  };
  const clamp = (n: number) => Math.max(-3, Math.min(3, Math.round(n)));
  // Thumb / accuracy nudges:
  //   thumb-down or "not_accurate" → push back signal: ease provocation, add patience.
  //   thumb-up or "accurate"        → reinforce: tiny bluntness bump, the user can take it.
  if (fb.rating === -1 || fb.accuracy === "not_accurate") {
    p.provocation_appetite = clamp(p.provocation_appetite - 1);
    p.patience = clamp(p.patience + 1);
  } else if (fb.rating === 1 || fb.accuracy === "accurate") {
    p.bluntness = clamp(p.bluntness + 1);
  }
  // Tally the synthesis move outcome so we know how often the final read landed.
  const move = "counter_hypothesis"; // synthesis is a counter-hypothesis-class move
  const outcome: "landed" | "pushed_back" | "ignored" =
    fb.rating === 1 || fb.accuracy === "accurate" ? "landed" :
    fb.rating === -1 || fb.accuracy === "not_accurate" ? "pushed_back" : "ignored";
  const bucket = { ...(p.move_tally[move] ?? {}) };
  bucket[outcome] = (bucket[outcome] ?? 0) + 1;
  p.move_tally[move] = bucket;
  // Comments can contain explicit "stop doing X" — extract conservatively via LLM.
  if (fb.comment && fb.comment.trim().length > 4) {
    try {
      const sys = `Extract explicit instructions the listener is telling a music critic to stop doing. Return STRICT JSON, no fences: {"forbid": ["short phrase", ...]}. Empty array if none. Only include things the user EXPLICITLY asks to stop. Be conservative.`;
      const raw = await ai([
        { role: "system", content: sys },
        { role: "user", content: `Listener comment:\n"${fb.comment}"\n\nReturn the JSON.` },
      ]);
      const cleaned = raw.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { forbid?: string[] };
      for (const phrase of parsed.forbid ?? []) {
        const trimmed = String(phrase ?? "").trim().slice(0, 120);
        if (!trimmed) continue;
        if (!p.forbidden_moves.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
          p.forbidden_moves.push(trimmed);
        }
      }
    } catch { /* best-effort */ }
  }
  await supabase.from("critic_profile").upsert({
    user_id: userId,
    bluntness: p.bluntness,
    playfulness: p.playfulness,
    patience: p.patience,
    provocation_appetite: p.provocation_appetite,
    move_tally: p.move_tally,
    forbidden_moves: p.forbidden_moves.slice(0, 8),
    // Count an explicit feedback event as one "observed" tick so the voice
    // modulation gate (turns_observed >= 2) can trip from feedback alone.
    turns_observed: p.turns_observed + 1,
  }, { onConflict: "user_id" });
}


export const getMyFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("result_feedback")
      .select("accuracy, rating, comment, target")
      .eq("user_id", userId)
      .eq("session_id", data.session_id);
    return { feedback: rows ?? [] };
  });


// ============================================================
// CONVERSATIONAL ONBOARDING — react / refine / insight / synthesis
// Two-step taste read: 3 songs → reaction + hypothesis_v1
// then 2 more songs → refinement, lane lock, write to profile.
// ============================================================

const ONBOARDING_RULES = `HARD RULES — no exceptions:
- You are an attentive interviewer talking TO the listener. Speak to them, not about your model. They never see scoring axes, lanes, or "forks." Ever.
- Reference the actual songs and artists from their picks. Show that you were paying attention.
- One short conversational observation. Present tense. ~25–40 words max. Hard cap.
- NEVER name axes, dimensions, lanes, scoring categories, or "tests." NEVER say "fork", "axis", "stakes", "pole", "if #N leans…", "I had you wrong", "the next matchup will tell us."
- Don't preview what the next pick is testing. The next question is the next question. Get out of the way.
- BANNED APHORISM OPENERS (case-insensitive): "the moment when", "the performer who", "survives their own", "refuses to blink", "becomes a spectacle", "secret becomes", "singular presence", "their own spotlight", "you reward …", "you trust …". Those are verdicts dressed as observations.
- BANNED VOCAB: horoscope language, therapist talk ("I'm noticing…"), wine-review words ("oscillate", "ache", "texture-forward", "restless lineage").
- ALLOWED MOVES: "Two of three…", "So far you seem…", "You keep choosing…", "Surprisingly…", "Closer to X than Y…" (X/Y must be songs or artists, never axis names).
- Plain conversational English. Short sentences. No emojis. No JSON unless explicitly asked for.
- Never hallucinate facts. If you don't know a year/producer/scene, lean on what the songs share instead.`;

// Lookup helper: pull what we know about a single song from the catalog.
// Used to give micro-reactions specific facts instead of vibes.
async function lookupSongContext(
  supabase: { from: (t: string) => { select: (c: string) => { ilike: (col: string, v: string) => { limit: (n: number) => Promise<{ data: Array<{ title: string; artist: string; year: number | null; primary_lane: string | null; lane: string | null }> | null }> } } } },
  raw: string,
): Promise<{ title: string; artist: string; year: number | null; primary_lane: string | null } | null> {
  const [titlePart, artistPart] = raw.split(/—|–|-/).map((s) => s.trim());
  const title = titlePart || raw;
  if (!title) return null;
  try {
    const { data } = await supabase.from("songs").select("title,artist,year,primary_lane,lane").ilike("title", title).limit(5);
    if (!data?.length) return null;
    const best = artistPart
      ? data.find((r) => r.artist?.toLowerCase().includes(artistPart.toLowerCase())) ?? data[0]
      : data[0];
    return { title: best.title, artist: best.artist, year: best.year, primary_lane: best.primary_lane ?? best.lane };
  } catch {
    return null;
  }
}

const REACT_VOICE = `${PERSONA}
Mode: first read after three songs. You're a sharp, curious friend who knows music — figure the listener out by NAMING what's actually in their picks.
${ONBOARDING_RULES}
${LANE_RULES}
Output STRICT JSON:
{
  "observation": "ONE short observation, 8–22 words. Notice a pattern across the three picks — softer is better. Good: 'Three big swings in a row. You seem more interested in impact than subtlety.' Good: 'So far you're gravitating toward scale. Nothing quiet has survived the cut.' Good: 'You haven't picked a wallflower yet.' Bad: long sentences, psychoanalytic certainty, 'suggests you want', naming no songs at all.",
  "fork": "Leave empty.",
  "stakes": "Leave empty.",
  "reaction": "Legacy field. Copy the observation verbatim.",
  "hypothesis_v1": "Legacy field. Copy the observation verbatim.",
  "lane_guess": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "metal" | "country" | "r_and_b" | "general",
  "confidence": 0.0-1.0,
  "suspected_dimensions": ["movement","atmosphere","immersion","scale","community","perspective","confidence","tension","texture","transformation"]
}
No prose, no markdown fences.`;

type ReactToThreeResult = {
  reaction: string;
  hypothesis_v1: string;
  observation: string;
  fork: string;
  stakes: string;
  lane_guess: Lane;
  confidence: number;
  suspected_dimensions: string[];
};

export const reactToThree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ songs: z.array(z.string().trim().min(1).max(200)).length(3) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ReactToThreeResult> => {
    const { supabase } = context;
    const fallback: ReactToThreeResult = {
      reaction: "Three songs is barely a sketch — but a sketch already says something.",
      hypothesis_v1: "Three picks is a sketch. Give me two more and I'll commit.",
      observation: "Three songs is barely a sketch — but a sketch already says something.",
      fork: "sketch ↔ portrait",
      stakes: "Two more picks and I commit. Surprise me.",
      lane_guess: "general",
      confidence: 0,
      suspected_dimensions: [],
    };
    try {
      const ctx = await Promise.all(data.songs.map((s) => lookupSongContext(supabase as never, s)));
      const ctxBlock = ctx
        .map((c, i) => c ? `${i + 1}. ${c.title} — ${c.artist}${c.year ? ` (${c.year})` : ""}${c.primary_lane ? ` · ${c.primary_lane}` : ""}` : `${i + 1}. (no catalog match)`)
        .join("\n");
      const txt = await ai([
        { role: "system", content: REACT_VOICE },
        { role: "user", content: `Three songs they love (raw input):\n${data.songs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nWhat the catalog knows (use only if it matches; don't invent):\n${ctxBlock}\n\nReturn the JSON now.` },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const p = JSON.parse(cleaned) as Partial<ReactToThreeResult>;
      const lane = (LANES as readonly string[]).includes(p.lane_guess as string) ? (p.lane_guess as Lane) : "general";
      const observation = typeof p.observation === "string" && p.observation.trim() ? p.observation.trim() : (typeof p.reaction === "string" ? p.reaction.trim() : "");
      const fork = typeof p.fork === "string" && p.fork.trim() ? p.fork.trim() : fallback.fork;
      const stakes = typeof p.stakes === "string" && p.stakes.trim() ? p.stakes.trim() : fallback.stakes;
      return {
        reaction: observation || fallback.reaction,
        hypothesis_v1: `${fork}. ${stakes}`,
        observation: observation || fallback.observation,
        fork,
        stakes,
        lane_guess: lane,
        confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0))),
        suspected_dimensions: Array.isArray(p.suspected_dimensions)
          ? p.suspected_dimensions.filter((s): s is string => typeof s === "string" && (DIMS as readonly string[]).includes(s)).slice(0, 4)
          : [],
      };
    } catch {
      return fallback;
    }
  });


// Per-song micro-reaction. LADDERED by index — the PERSONA itself escalates:
// song 1–2 = casual friend, song 3 = music-loving friend, song 4 = sharper
// critic-friend, song 5+ = niche expert. Heavy critic flourishes are saved
// for the final synthesis (refineWithTwoMore).
// PRINCIPLE (see docs/musicdna/intelligence_layer.md): confidence tracks evidence.
// One song is not enough to claim a trait. Three is barely enough to name one, and
// only if the alternative is stated out loud. The AI's job is not to sound clever;
// it is to become progressively less wrong.
const MICRO_REACT_BASE = `Mode: micro-reaction. The listener just named ONE song. React in ONE sentence — curious, not clever. A friend at a record store who just clocked something and is still listening.

VOICE RULES (HARD):
- Punch WITH the listener, never AT them. Never imply the pick was safe, obvious, lazy, shallow, predictable, a gateway, a starter pack, basic, or that some other song would've been better.
- BANNED WORDS (case-insensitive): gateway, shallow, deep cut, obvious, predictable, safe, basic, surface, starter, expected, instead, rather than, should've, could've, lazy.
- BANNED APHORISM OPENERS: "the moment when", "the performer who", "secret becomes", "survives their own", "refuses to blink".
- If you name a real fact (year, producer, scene), be certain of it. Otherwise riff on the mood. Never invent chart history, producers, or labels.
- One sentence, 10–18 words. Sentence case. No emojis, no hashtags, no quotes around the reaction.`;

function microReactVoice(index: number): string {
  if (index === 0) {
    return `${MICRO_REACT_BASE}
Tier: SONG 1 — first move. DO NOT name a trait about the listener yet. You have one data point. Note the pick, hint you're paying attention, stop. Good: "Interesting place to start." / "Ceremony out the gate — noted." / "Okay. Still listening." Bad: "You like your melancholy with a backbeat." (that's a trait claim — forbidden after one song)`;
  }
  if (index === 1) {
    return `${MICRO_REACT_BASE}
Tier: SONG 2 — still watching. DO NOT name a trait yet. Two points don't make a line. Notice what the two picks share OR don't share, and keep listening. Good: "Two very different rooms. Interesting." / "Those two share less than people think." / "Still listening." Bad: "You like attitude over polish." (still a trait claim — forbidden)`;
  }
  if (index === 2) {
    return `${MICRO_REACT_BASE}
Tier: SONG 3 — first working theory allowed. If (and only if) the three picks share a real thread, name it TENTATIVELY and END WITH A COMPETING EXPLANATION so the theory is falsifiable. Good: "Working theory: you keep picking songs that ask for patience. Or you just really like The Cure. Let's see." Bad: "You trust slow reveal." (no alternative — pretends certainty)`;
  }
  if (index === 3) {
    return `${MICRO_REACT_BASE}
Tier: SONG 4 — pressure test. Say whether the new pick strengthens the theory, breaks it, or leaves it unchanged. If it strengthens, still hedge. Good: "That fits — patience again. Getting more confident." / "Okay, that breaks my read. Back to listening." / "Doesn't tell me much either way."`;
  }
  return `${MICRO_REACT_BASE}
Tier: SONG 5+ — landed read. One short, specific observation. Still falsifiable. If evidence is thin, say so.`;
}



export const ReactToOneInput = z.object({
  song: z.string().trim().min(1).max(200),
  index: z.number().int().min(0).max(20),
  priorSongs: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
});

function deterministicMicroReaction(
  data: { song: string; index: number; priorSongs: string[] },
  ctx: { title: string; artist: string; year: number | null; primary_lane: string | null } | null,
): string {
  if (!ctx) {
    return ["Interesting.", "Noted.", "Okay. Still listening."][data.index % 3];
  }
  if (data.index === 0) {
    return `${ctx.artist} as the opener — specific enough to keep me listening.`;
  }
  if (data.index === 1) {
    return `${ctx.title}${ctx.year ? ` (${ctx.year})` : ""} gives this a second clear reference point.`;
  }
  return `${ctx.title} makes three; now there is enough shape to test.`;
}

export async function reactToOneImpl(
  supabase: AuthedSupabase,
  data: { song: string; index: number; priorSongs: string[] },
): Promise<{ text: string; nextLabel: string | null }> {
  const fallbacks = ["Interesting.", "Noted.", "Mm.", "Okay.", "Now we're talking."];
  let fallbackText = fallbacks[data.index % fallbacks.length];
  const nextRank = data.index + 2;
  try {
    const prior = data.priorSongs.length
      ? `Already named: ${data.priorSongs.map((s, i) => `${i + 1}. ${s}`).join("; ")}.\n`
      : "";

    const ctx = await lookupSongContext(supabase as never, data.song);
    fallbackText = deterministicMicroReaction(data, ctx);
    const ctxBlock = ctx
      ? `Catalog knows: ${ctx.title} — ${ctx.artist}${ctx.year ? ` (${ctx.year})` : ""}${ctx.primary_lane ? ` · ${ctx.primary_lane}` : ""}. You may use this. Do not invent anything beyond it.`
      : `Catalog has no match for this song. Don't invent facts — riff on instinct or mood.`;

    const nextPromptRules = `
Also write a SHORT, CONVERSATIONAL prompt for the next slot (#${nextRank}). This is the critic talking to a friend across a table — NOT a quiz question. Show you were listening to what they just said.

Riff on ONE distinctive angle of what's been named so far — pick whichever fits best:
- the ARTIST by name (e.g. "who's second best to Echo?", "your #2 after Nirvana?")
- the DECADE/ERA (e.g. "80s kid, huh? Give me #2", "still in the 90s — what's next?")
- the GENRE/SCENE (e.g. "okay grunge head, now #2", "another from the boom-bap shelf?")
- the MOOD or time-of-day (e.g. "cool... now another 4am one", "stay sad — what's next?")

Rules for nextLabel:
- 4 to 10 words. Conversational. Lowercase fragments and ellipses are fine.
- Reference EXACTLY ONE angle (artist OR era OR scene OR mood). Don't stack them.
- Voice: warm — punching WITH them, never at them. Never grade the pick.
- If you can't pin a distinctive angle, return nextLabel as "" (empty string).`;

    const txt = await ai([
      { role: "system", content: `${microReactVoice(data.index)}\n${nextPromptRules}\n\nReturn STRICT JSON: {"reaction": "...", "nextLabel": "..."}. No markdown fences.` },
      { role: "user", content: `${prior}Just named (#${data.index + 1}): ${data.song}\n${ctxBlock}\n\nReturn the JSON now.` },
    ]);
    const cleaned = txt.replace(/```json\s*|```/g, "").trim();
    let reaction = "";
    let nextLabel: string | null = null;
    try {
      const parsed = JSON.parse(cleaned) as { reaction?: unknown; nextLabel?: unknown };
      if (typeof parsed.reaction === "string") reaction = parsed.reaction.trim();
      if (typeof parsed.nextLabel === "string") {
        const nl = parsed.nextLabel.replace(/^["'`\s]+|["'`\s]+$/g, "").trim();
        if (nl && nl.length <= 120 && nl.split(/\s+/).length <= 14) nextLabel = nl;
      }
    } catch {
      reaction = cleaned.split("\n")[0].replace(/^["'`\s]+|["'`\s]+$/g, "").trim();
    }
    if (!reaction) reaction = fallbackText;
    const capped = reaction.length > 200 ? reaction.slice(0, 197) + "…" : reaction;
    return { text: capped, nextLabel };
  } catch {
    return { text: fallbackText, nextLabel: null };
  }
}

export const reactToOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReactToOneInput.parse(d))
  .handler(async ({ data, context }) => reactToOneImpl(context.supabase, data));


// Step B: 5 songs total + the prior hypothesis. The AI produces an EVIDENCE
// LEDGER, not a verdict. The threshold rule (≥3 supporting picks AND 0 strong
// contradictions) is enforced HERE in code — the model does not get to decide
// what ships. Max one claim. If nothing clears, we say "still learning."
const REFINE_VOICE = `${PERSONA}
Mode: evidence ledger. Five songs. Do NOT deliver a personality verdict. Produce an evidence sketch that the app will filter.

You may propose UP TO TWO candidate claims about the LISTENER. For each, list which specific picks support it, which contradict it, and at least one competing explanation ("or they just really like The Cure", "or they came up on 4AD", "or three picks isn't enough yet"). Also give ONE short, curious reaction line — the equivalent of "That's enough. I've got a working theory. Or two, and one alternative."

HARD RULES:
- Never claim more than the picks support. A claim needs at least 3 of the 5 songs behind it.
- Every claim carries an alternative explanation. Not optional.
- No horoscope language. No axis names. No "you reward…" openers.
- reaction: 6–18 words, curious not diagnostic.
- claim.text: 8–20 words. Plain English. No genre labels, no scoring language.
- competing_explanations: short phrases, 3–12 words each.

Return STRICT JSON, no fences:
{
  "reaction": "short curious line, 6–18 words",
  "lane": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "metal" | "country" | "r_and_b" | "general",
  "candidate_claims": [
    {
      "text": "one plain-English observation about the listener's pattern",
      "supporting_songs": ["song 1 title as given", "song 3 title as given", "..."],
      "contradicting_songs": ["song 4 title as given", "..."],
      "competing_explanations": ["or they just really like The Cure", "or three picks isn't enough"]
    }
  ],
  "per_song": [{"input": "...", "lane": "alternative|pop|hip_hop|electronic|classic_rock|metal|country|r_and_b|unknown"}]
}`;

type EvidenceClaim = {
  text: string;
  supporting_songs: string[];
  contradicting_songs: string[];
  competing_explanations: string[];
};

type ShippedClaim = {
  text: string;
  status: "tentative" | "strengthening" | "stable";
  competing_explanation: string;
  supporting_count: number;
};

export const refineWithTwoMore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      firstThree: z.array(z.string().trim().min(1).max(200)).length(3),
      twoMore: z.array(z.string().trim().min(1).max(200)).length(2),
      hypothesis_v1: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const allFive = [...data.firstThree, ...data.twoMore];

    // Defaults: still-learning state. Nothing shipped unless evidence clears.
    let reaction = "That's enough for now. Still forming a read.";
    let lane: Lane = "general";
    let candidateClaims: EvidenceClaim[] = [];
    let perSong: Array<{ input: string; lane: Lane | "unknown"; source: "llm" | "catalog"; canon_id?: string }> =
      allFive.map((s) => ({ input: s, lane: "unknown", source: "llm" }));

    try {
      const txt = await ai([
        { role: "system", content: REFINE_VOICE },
        { role: "user", content: `Working note after three picks:\n"${data.hypothesis_v1 ?? "(none)"}"\n\nFirst three:\n${data.firstThree.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nNew two:\n${data.twoMore.map((s, i) => `${i + 4}. ${s}`).join("\n")}\n\nReturn the JSON now.` },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as {
        reaction?: unknown;
        lane?: unknown;
        candidate_claims?: unknown;
        per_song?: unknown;
      };
      if (typeof parsed.reaction === "string" && parsed.reaction.trim()) reaction = parsed.reaction.trim();
      if (typeof parsed.lane === "string" && (LANES as readonly string[]).includes(parsed.lane)) lane = parsed.lane as Lane;
      if (Array.isArray(parsed.candidate_claims)) {
        candidateClaims = parsed.candidate_claims
          .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
          .slice(0, 2)
          .map((c) => ({
            text: typeof c.text === "string" ? c.text.trim() : "",
            supporting_songs: Array.isArray(c.supporting_songs) ? c.supporting_songs.filter((s): s is string => typeof s === "string") : [],
            contradicting_songs: Array.isArray(c.contradicting_songs) ? c.contradicting_songs.filter((s): s is string => typeof s === "string") : [],
            competing_explanations: Array.isArray(c.competing_explanations) ? c.competing_explanations.filter((s): s is string => typeof s === "string").slice(0, 3) : [],
          }))
          .filter((c) => c.text.length > 0);
      }
      if (Array.isArray(parsed.per_song)) {
        perSong = allFive.map((input) => {
          const match = (parsed.per_song as Array<{ input?: unknown; lane?: unknown }>).find((p) => p?.input === input);
          const l = match && typeof match.lane === "string" && (LANES as readonly string[]).includes(match.lane)
            ? (match.lane as Lane)
            : "unknown" as const;
          return { input, lane: l, source: "llm" as const };
        });
      }
    } catch { /* keep still-learning defaults */ }

    // Threshold rule (enforced in code, not by the model):
    //   ship a claim only if ≥3 supporting picks AND 0 contradictions.
    //   ship at most one.
    const shipped: ShippedClaim[] = [];
    for (const c of candidateClaims) {
      if (shipped.length >= 1) break;
      const supports = c.supporting_songs.length;
      const contradicts = c.contradicting_songs.length;
      if (supports < 3 || contradicts !== 0) continue;
      const status: ShippedClaim["status"] =
        supports >= 5 ? "stable" : supports === 4 ? "strengthening" : "tentative";
      shipped.push({
        text: c.text,
        status,
        competing_explanation: c.competing_explanations[0] ?? "Or the sample is still too small.",
        supporting_count: supports,
      });
    }

    const stillLearning = shipped.length === 0;
    // For back-compat with older consumers of this function.
    const hypothesis = shipped[0]?.text ?? "Not enough evidence yet — still listening.";
    const confidence = shipped[0] ? (shipped[0].status === "stable" ? 0.8 : shipped[0].status === "strengthening" ? 0.6 : 0.4) : 0.2;

    // Fallback lane from per_song majority if the model went "general" but the picks agree.
    if (lane === "general") {
      const dominant = dominantPerSongLane(perSong);
      if (dominant) lane = dominant;
    }

    // Hidden canon enrichment — silent, best-effort.
    const canonMatches: Array<{ input: string; song_id: string; title: string; artist: string; primary_lane: string }> = [];
    for (let i = 0; i < allFive.length; i++) {
      const raw = allFive[i];
      const [titlePart, artistPart] = raw.split(/—|–|-/).map((s) => s.trim());
      const title = titlePart || raw;
      if (!title) continue;
      try {
        const { data: rows } = await supabase
          .from("songs")
          .select("id,primary_lane,lane,title,artist")
          .ilike("title", title)
          .limit(5);
        if (!rows?.length) continue;
        const best = artistPart
          ? rows.find((r: { artist?: string | null }) => r.artist?.toLowerCase().includes(artistPart.toLowerCase())) ?? rows[0]
          : rows[0];
        const topLane = catalogLaneToTopLane(best.primary_lane ?? best.lane);
        canonMatches.push({
          input: raw, song_id: best.id, title: best.title, artist: best.artist,
          primary_lane: best.primary_lane ?? best.lane,
        });
        if (perSong[i]) perSong[i] = { ...perSong[i], source: "catalog", canon_id: best.id, lane: topLane ?? perSong[i].lane };
      } catch { /* swallow */ }
    }

    const artifact = {
      reaction, lane, confidence, hypothesis,
      claims: shipped,
      stillLearning,
      candidate_claims: candidateClaims,
      per_song: perSong,
      canon_matches: canonMatches,
      // legacy shape retained so older callers don't blow up
      secondary_lanes: [] as Lane[],
      reasoning: shipped.map((c) => c.text),
      candidate_dimensions: {} as LlmDimensions,
    };

    await supabase
      .from("profiles")
      .update({
        opening_songs: allFive,
        opening_hypothesis: hypothesis,
        opening_lane: lane,
        opening_lane_confidence: confidence,
        opening_analysis_json: JSON.parse(JSON.stringify(artifact)),
      })
      .eq("user_id", userId);

    return artifact;
  });


// ============================================================
// commitOpeningThree — lock-in read after the 3rd ranked song.
// 3-song one-at-a-time variant of refineWithTwoMore.
// ============================================================

const COMMIT_THREE_VOICE = `${PERSONA}
Mode: lock in the read after three ranked songs. You're an attentive interviewer. Drop ONE short conversational observation about what you've noticed — speak TO the listener, reference their actual picks, then stop. The next matchup is coming; don't preview it.
${ONBOARDING_RULES}
${LANE_RULES}
Return STRICT JSON:
{
  "observation": "ONE short paragraph, ~25–40 words, MAX 45. Conversational, present tense, speaks to the listener. Reference at least ONE song or artist from their picks. Good: 'Two dramatic choices in a row. You seem to like emotional honesty delivered through a strong artistic lens — not raw confession.' Good: 'So far you seem more interested in perspective than pure emotion.' Bad: anything that names a fork/axis/lane/pole, previews the next matchup, or opens with 'You reward…' or 'You trust…'.",
  "lane": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "metal" | "country" | "r_and_b" | "general",
  "confidence": 0.0-1.0,
  "secondary_lanes": [lane, ...],
  "candidate_dimensions": { "movement": -100..100, "atmosphere": -100..100, "immersion": -100..100, "scale": -100..100, "community": -100..100, "perspective": -100..100, "confidence": -100..100, "tension": -100..100, "texture": -100..100, "transformation": -100..100 },
  "per_song": [{"input": "...", "lane": "alternative|pop|hip_hop|electronic|classic_rock|metal|country|r_and_b|unknown"}],
  "reasoning": ["one short observation about the LISTENER (not the song)", "..."]
}
No prose, no markdown fences. Three songs is not enough for certainty — keep confidence honest (0.3–0.6). The candidate_dimensions, lane, and secondary_lanes are for the engine; the LISTENER never sees them, so do not reference them in the observation.`;

export const commitOpeningThree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      songs: z.array(z.string().trim().min(1).max(200)).length(3),
    }).parse(d),
  )
  .handler(async ({ data, context }) => commitOpeningThreeImpl(context.supabase, context.userId, data));

export async function commitOpeningThreeImpl(supabase: AuthedSupabase, userId: string, data: { songs: string[] }) {
    const allThree = data.songs;
    const fallbackObservation = "Three songs in. Already a shape, not a portrait — let's keep going.";
    let llm: OpeningAnalysis & { reaction: string; observation?: string; fork?: string; stakes?: string } = {
      ...FALLBACK,
      reaction: fallbackObservation,
      observation: fallbackObservation,
      fork: "",
      stakes: "",
      per_song: allThree.map((s) => ({ input: s, lane: "unknown", source: "llm" })),
    };
    try {
      // Catalog context for all three. Lets the critic reference real facts.
      const ctx = await Promise.all(allThree.map((s) => lookupSongContext(supabase as never, s)));
      const ctxBlock = ctx
        .map((c, i) => c ? `${i + 1}. ${c.title} — ${c.artist}${c.year ? ` (${c.year})` : ""}${c.primary_lane ? ` · ${c.primary_lane}` : ""}` : `${i + 1}. (no catalog match — don't invent facts for this one)`)
        .join("\n");
      const txt = await ai([
        { role: "system", content: COMMIT_THREE_VOICE },
        { role: "user", content: `Three songs, ranked top to bottom (raw input):\n${allThree.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nWhat the catalog knows (use only if matched; don't invent):\n${ctxBlock}\n\nReturn the JSON now.` },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as Partial<OpeningAnalysis & {
        observation?: string; reaction?: string;
      }>;
      const lane = (LANES as readonly string[]).includes(parsed.lane as string) ? (parsed.lane as Lane) : "general";
      const rawConfidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
      const confidence = Math.min(0.65, rawConfidence);
      const secondary = Array.isArray(parsed.secondary_lanes)
        ? parsed.secondary_lanes.filter((l): l is Lane => (LANES as readonly string[]).includes(l as string) && l !== lane && l !== "general")
        : [];
      const dims: LlmDimensions = {};
      if (parsed.candidate_dimensions && typeof parsed.candidate_dimensions === "object") {
        for (const d of DIMS) {
          const v = (parsed.candidate_dimensions as Record<string, unknown>)[d];
          if (typeof v === "number" && Number.isFinite(v)) dims[d] = Math.max(-100, Math.min(100, Math.round(v)));
        }
      }
      const perSong = allThree.map((input) => {
        const match = Array.isArray(parsed.per_song) ? parsed.per_song.find((p) => p?.input === input) : null;
        const songLane = match && (LANES as readonly string[]).includes(match.lane as string) ? (match.lane as Lane) : "unknown";
        return { input, lane: songLane as Lane | "unknown", source: "llm" as const };
      });
      const observation = typeof parsed.observation === "string" && parsed.observation.trim()
        ? parsed.observation.trim()
        : (typeof parsed.reaction === "string" ? parsed.reaction.trim() : fallbackObservation);
      // `reaction` (shown next to song #3) and `hypothesis` are both the single
      // conversational observation. The model talks to the user, not about itself.
      llm = {
        lane: confidence < 0.4 ? (dominantPerSongLane(perSong) ?? "general") : lane,
        confidence,
        secondary_lanes: secondary,
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 4).map(String) : [],
        hypothesis: observation,
        candidate_dimensions: dims,
        per_song: perSong,
        canon_matches: [],
        reaction: observation,
        observation,
        fork: "",
        stakes: "",
      };
    } catch { /* keep fallback */ }


    // Hidden canon enrichment.
    for (let i = 0; i < allThree.length; i++) {
      const raw = allThree[i];
      const [titlePart, artistPart] = raw.split(/—|–|-/).map((s) => s.trim());
      const title = titlePart || raw;
      if (!title) continue;
      try {
        const { data: rows } = await supabase
          .from("songs")
          .select("id,primary_lane,lane,title,artist")
          .ilike("title", title)
          .limit(5);
        if (!rows?.length) continue;
        const best = artistPart
          ? rows.find((r: { artist?: string | null }) => r.artist?.toLowerCase().includes(artistPart.toLowerCase())) ?? rows[0]
          : rows[0];
        const topLane = catalogLaneToTopLane(best.primary_lane ?? best.lane);
        llm.canon_matches.push({
          input: raw,
          song_id: best.id,
          title: best.title,
          artist: best.artist,
          primary_lane: best.primary_lane ?? best.lane,
        });
        if (llm.per_song[i]) {
          llm.per_song[i] = { ...llm.per_song[i], source: "catalog", canon_id: best.id, lane: topLane ?? llm.per_song[i].lane };
        }
      } catch { /* swallow */ }
    }

    await supabase
      .from("profiles")
      .update({
        opening_songs: allThree,
        opening_hypothesis: llm.hypothesis,
        opening_lane: llm.lane,
        opening_lane_confidence: llm.confidence,
        opening_analysis_json: JSON.parse(JSON.stringify(llm)),
      })
      .eq("user_id", userId);

    return llm;
}





// ============================================================
// Round insights — interleaved observations during pairings.
// Called by the client after rounds 3, 6, 9. Reads current vector
// + recent choices and returns a short Rolling Stone–voice line.
// ============================================================

const INSIGHT_KINDS = ["observation", "challenge", "refinement"] as const;
type InsightKind = (typeof INSIGHT_KINDS)[number];

const INSIGHT_VOICE = `${PERSONA}
Mode: between-matchup aside. Drop ONE sharp observation, challenge, or counter-hypothesis. This is where the product earns its keep — the listener should feel seen, then slightly called out.
You are given the listener's running axis vector (positive = high pole, negative = low pole) and their most recent choices. Pick the SHARPEST thing you can defend from this evidence. If a clear pattern is there, NAME it. If not, challenge or refine.

Return STRICT JSON:
{
  "kind": "observation" | "challenge" | "refinement",
  "text": "ONE or TWO sentences, max 32 words total. Specific. Defendable from the evidence. Examples: 'You keep choosing the song that takes longer to arrive.' 'Not patience exactly. Patience that pays off.' 'Let's test that — this next one's the opposite.'"
}
No prose, no markdown fences.`;

export const roundInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), round: z.number().int().min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ kind: InsightKind; text: string } | null> => {
    // Only fire after rounds 3, 6, 9.
    if (![3, 6, 9].includes(data.round)) return null;
    const { supabase, userId } = context;
    const sessionRes = await supabase
      .from("sessions")
      .select("vector,user_id")
      .eq("id", data.sessionId)
      .single();
    const session = sessionRes.data as { vector: Record<string, number>; user_id: string } | null;
    if (!session || session.user_id !== userId) return null;

    const vector = session.vector ?? {};
    // Top 3 strongest axes so far.
    const ranked = (DIMS as readonly string[])
      .map((d) => ({ d, v: vector[d] ?? 0 }))
      .filter((x) => Math.abs(x.v) >= 8)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 3);

    if (!ranked.length) {
      return {
        kind: data.round === 6 ? "challenge" : "observation",
        text: "Nothing's locked in yet. Keep choosing — the pattern will out itself.",
      };
    }

    // Pull the last 4 choices for grounding.
    const choicesRes = await supabase
      .from("choices")
      .select("ms_to_decide,chosen:chosen_song_id(title,artist),rejected:rejected_song_id(title,artist)")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false })
      .limit(4);
    type Row = { ms_to_decide: number | null; chosen: { title: string; artist: string } | null; rejected: { title: string; artist: string } | null };
    const recent = ((choicesRes.data ?? []) as unknown as Row[])
      .filter((r) => r.chosen && r.rejected)
      .map((r) => `${r.chosen!.title} > ${r.rejected!.title}${r.ms_to_decide != null ? ` (${r.ms_to_decide}ms)` : ""}`);

    const axisBlock = ranked
      .map(({ d, v }) => {
        const label = DIM_LABEL[d];
        const pole = v >= 0 ? label?.hi : label?.lo;
        return `- ${d}: ${v >= 0 ? "+" : ""}${Math.round(v)} (${pole})`;
      })
      .join("\n");

    const kindHint = data.round === 3 ? "observation" : data.round === 6 ? "challenge" : "refinement";
    const prompt = `Round ${data.round}. Vector so far:\n${axisBlock}\n\nRecent picks:\n${recent.join("\n") || "(none)"}\n\nPreferred kind for this round: ${kindHint}. But override if the evidence demands the other.\n\nReturn the JSON now.`;

    try {
      const txt = await ai([
        { role: "system", content: INSIGHT_VOICE },
        { role: "user", content: prompt },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { kind?: string; text?: string };
      const kind = (INSIGHT_KINDS as readonly string[]).includes(parsed.kind ?? "") ? (parsed.kind as InsightKind) : (kindHint as InsightKind);
      const text = typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim() : "";
      if (!text) return null;
      return { kind, text };
    } catch {
      return null;
    }
  });


// ============================================================
// Final synthesis — the big reveal after the last pairing.
// One specific, slightly uncomfortable observation built from
// the full session vector.
// ============================================================

const SYNTH_VOICE = `${PERSONA}
Mode: final synthesis. You are a music critic, not a therapist. You name songs. You quote choices back. You write like a smart friend who's been listening over their shoulder.

You are given:
- a list of tradeoff patterns the listener actually displayed (each with named song examples)
- counter-explanations that might be doing the work instead (e.g. "they just like Stone Roses")

Your job: write 2–4 sentences that connect 2–3 of the strongest patterns into ONE specific reading. NAME at least two of the songs from the evidence in the prose. Use contrast moves: "It's not X. It's Y." Be defensible.

If NO patterns are provided, that is itself the finding. Write the "refused to collapse" read: this listener picked across too many directions for one thesis to hold, and that's a real signal — broad ear, not random. Reference the songs they chose.

Return STRICT JSON:
{
  "synthesis": "2-4 sentences. Names at least one specific song. Ends on the thesis."
}
No prose, no markdown fences.`;

type SynthEvidence = { tradeoff: string; examples: string[]; supporting: number; tested: number };
type SynthCounter = { claim: string; impact: string; notes: string };
type SynthPayload = {
  synthesis: string;
  kept_choosing: SynthEvidence[];
  counter_reads: SynthCounter[];
};

export const finalSynthesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SynthPayload> => finalSynthesisImpl(context.supabase, context.userId, data));

export async function finalSynthesisImpl(supabase: AuthedSupabase, userId: string, data: { sessionId: string }): Promise<SynthPayload> {
    const sessionRes = await supabase
      .from("sessions")
      .select("user_id, vector")
      .eq("id", data.sessionId)
      .single();
    const session = sessionRes.data as { user_id: string; vector: Record<string, number> | null } | null;
    const empty: SynthPayload = { synthesis: "", kept_choosing: [], counter_reads: [] };
    if (!session || session.user_id !== userId) return empty;
    const derivedMoods = deriveDescriptors(session.vector ?? {});

    // Pull the Analyst's stored reasoning — that's the evidence. Don't re-derive.
    const reasoningRes = await supabase
      .from("session_reasoning")
      .select("allowed_claims, counterarguments, observations")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    const reasoning = reasoningRes.data as {
      allowed_claims?: Array<{ tradeoff?: string; supporting_choices?: number; tested_total?: number; examples?: Array<{ chosen: string; rejected: string }> }>;
      counterarguments?: Array<{ claim: string; impact: string; notes: string }>;
      observations?: Array<{ chosen: string; rejected: string }>;
    } | null;

    const allowed = reasoning?.allowed_claims ?? [];
    const counters = reasoning?.counterarguments ?? [];
    const observations = reasoning?.observations ?? [];

    const kept_choosing: SynthEvidence[] = allowed.slice(0, 4).map((c) => ({
      tradeoff: String(c.tradeoff ?? ""),
      examples: (c.examples ?? []).map((e) => `${e.chosen} over ${e.rejected}`),
      supporting: Number(c.supporting_choices ?? 0),
      tested: Number(c.tested_total ?? 0),
    })).filter((e) => e.tradeoff);

    const counter_reads: SynthCounter[] = counters.slice(0, 4).map((c) => ({
      claim: String(c.claim ?? ""),
      impact: String(c.impact ?? "medium"),
      notes: String(c.notes ?? ""),
    })).filter((c) => c.claim);

    // Build the prompt — evidence-first, songs named explicitly.
    const evidenceBlock = kept_choosing.length
      ? kept_choosing.map((e) =>
          `- ${e.tradeoff} (${e.supporting}/${e.tested} matchups). Songs: ${e.examples.join("; ") || "—"}`
        ).join("\n")
      : "(none cleared the threshold)";
    const counterBlock = counter_reads.length
      ? counter_reads.map((c) => `- ${c.claim} — ${c.notes}`).join("\n")
      : "(none)";
    const songsPicked = observations.slice(0, 12).map((o) => o.chosen).join(", ") || "—";

    let synthesis = "";
    try {
      const txt = await ai([
        { role: "system", content: SYNTH_VOICE },
      { role: "user", content:
`SONGS THEY PICKED (in order):
${songsPicked}

PATTERNS WITH EVIDENCE:
${evidenceBlock}

COUNTER-EXPLANATIONS YOU MAY ACKNOWLEDGE:
${counterBlock}

DERIVED MOODS (read off their tradeoffs — you MAY call them this if the evidence supports it, never as a label, only as flavor):
${derivedMoods.length ? derivedMoods.join(", ") : "(none earned)"}

Return the JSON now.` },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { synthesis?: string };
      synthesis = typeof parsed.synthesis === "string" ? parsed.synthesis.trim() : "";
    } catch {
      // fall through to deterministic fallback below
    }

    if (!synthesis) {
      synthesis = kept_choosing.length
        ? `Across these matchups you kept choosing ${kept_choosing[0].tradeoff}. The shape's there — it's not loud yet, but it's consistent.`
        : `You refused to collapse into a single pattern. Every time a clear read started to form — ${songsPicked.split(",").slice(0, 3).join(",")} — another choice complicated it. That's either inconsistency or unusually broad taste. Probably the second.`;
    }

    await supabase
      .from("profiles")
      .update({ opening_hypothesis: synthesis })
      .eq("user_id", userId);

    return { synthesis, kept_choosing, counter_reads };
}


// ============================================================
// Chat — free-form conversation that continues the interview.
// Persists to chat_messages. Auto-creates a session anchored to
// the user's opener songs/hypothesis if none exists yet.
// ============================================================

const CHAT_VOICE = `${PERSONA}
Mode: ongoing critic-interview. You already know this listener: their opener songs, your working hypothesis, and the dimensions they've leaned into. Your job now is to keep digging — observations, challenges, counter-hypotheses, the occasional pointed question. Never play DJ. Never recommend songs unless they ask. Stay in critic-of-the-listener mode.

Hard rules: 1–4 sentences per turn. No bullet lists. No headers. No emoji. No therapy-speak. No "great question". When you ask something, ask ONE thing and make it sharp. Reference their actual choices by name when relevant. If they push back, take it seriously — refine or break your own read out loud.`;

// ---------- Per-user critic profile (tone + tactic memory) ----------
type CriticProfileRow = {
  bluntness: number;
  playfulness: number;
  patience: number;
  provocation_appetite: number;
  move_tally: Record<string, { landed?: number; ignored?: number; pushed_back?: number }>;
  forbidden_moves: string[];
  turns_observed: number;
};

const DIAL_BOUND = 3;
const MOVE_KEYS = ["observation", "challenge", "counter_hypothesis", "question"] as const;
type MoveKey = (typeof MOVE_KEYS)[number];
type Outcome = "landed" | "ignored" | "pushed_back";

const clampDial = (n: number) => Math.max(-DIAL_BOUND, Math.min(DIAL_BOUND, Math.round(n)));

async function loadCriticProfile(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<CriticProfileRow> {
  const { data } = await supabase
    .from("critic_profile")
    .select("bluntness, playfulness, patience, provocation_appetite, move_tally, forbidden_moves, turns_observed")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    bluntness: data?.bluntness ?? 0,
    playfulness: data?.playfulness ?? 0,
    patience: data?.patience ?? 0,
    provocation_appetite: data?.provocation_appetite ?? 0,
    move_tally: (data?.move_tally ?? {}) as CriticProfileRow["move_tally"],
    forbidden_moves: (data?.forbidden_moves ?? []) as string[],
    turns_observed: data?.turns_observed ?? 0,
  };
}

function buildVoiceModulation(p: CriticProfileRow): string | null {
  // Only emit modulation after at least 2 turns of evidence — otherwise we're
  // just biasing the critic on noise.
  if (p.turns_observed < 2) return null;
  const lines: string[] = [];
  const dial = (name: string, v: number, hi: string, lo: string) => {
    if (v >= 2) lines.push(`- ${hi} (strong).`);
    else if (v === 1) lines.push(`- ${hi}.`);
    else if (v <= -2) lines.push(`- ${lo} (strong).`);
    else if (v === -1) lines.push(`- ${lo}.`);
  };
  dial("bluntness", p.bluntness, "Lean blunter, less hedging", "Soften delivery, drop snarl");
  dial("playfulness", p.playfulness, "More wit and wordplay", "Keep it dry, fewer jokes");
  dial("patience", p.patience, "Slow down, let them finish", "Move faster, cut filler");
  dial("provocation_appetite", p.provocation_appetite, "Push harder, provoke a reaction", "Ease off on provocation");
  // Surface top-landing move so the critic favors what's been working.
  let bestMove: MoveKey | null = null;
  let bestScore = 0;
  for (const m of MOVE_KEYS) {
    const t = p.move_tally[m] ?? {};
    const landed = t.landed ?? 0;
    const total = landed + (t.ignored ?? 0) + (t.pushed_back ?? 0);
    if (total < 2) continue;
    const score = landed / total;
    if (score > bestScore) { bestScore = score; bestMove = m; }
  }
  if (bestMove && bestScore >= 0.6) {
    lines.push(`- Your ${bestMove.replace("_", "-")} moves land best with this listener — favor them.`);
  }
  if (p.forbidden_moves.length) {
    lines.push(`- Do not: ${p.forbidden_moves.slice(0, 5).join("; ")}.`);
  }
  if (!lines.length) return null;
  return `Per-listener voice calibration (apply quietly, don't break the persona):\n${lines.join("\n")}`;
}

async function persistCriticProfile(
  supabase: { from: (t: string) => any },
  userId: string,
  next: CriticProfileRow,
): Promise<void> {
  await supabase
    .from("critic_profile")
    .upsert({
      user_id: userId,
      bluntness: clampDial(next.bluntness),
      playfulness: clampDial(next.playfulness),
      patience: clampDial(next.patience),
      provocation_appetite: clampDial(next.provocation_appetite),
      move_tally: next.move_tally,
      forbidden_moves: next.forbidden_moves.slice(0, 8),
      turns_observed: next.turns_observed,
    }, { onConflict: "user_id" });
}

type ToneSignals = {
  tone: Partial<Record<"bluntness" | "playfulness" | "patience" | "provocation_appetite", number>>;
  last_move: MoveKey | "none";
  outcome: Outcome | "none";
  forbid: string[];
};

async function extractToneSignals(
  priorAssistant: string | null,
  userReply: string,
): Promise<ToneSignals | null> {
  if (!priorAssistant) return null;
  const sys = `You evaluate one exchange between a music critic and a listener. Return STRICT JSON, no prose, no fences:
{
  "tone": {"bluntness": -1..1, "playfulness": -1..1, "patience": -1..1, "provocation_appetite": -1..1},
  "last_move": "observation"|"challenge"|"counter_hypothesis"|"question"|"none",
  "outcome": "landed"|"ignored"|"pushed_back"|"none",
  "forbid": ["short phrase user told the critic to stop doing", ...]
}
Tone deltas are NUDGES (integers -1, 0, or 1) to apply to the critic for this user:
- bluntness: +1 if user wants more direct/sharp; -1 if user wants softer.
- playfulness: +1 if user enjoys wit; -1 if user finds jokes annoying.
- patience: +1 if user wants more space/time; -1 if user wants critic to move faster.
- provocation_appetite: +1 if user engaged with pushback; -1 if user shut down or asked to be gentler.
Outcome: did the user accept the critic's last move (landed), brush past it (ignored), or push back / refine it (pushed_back)?
forbid: only when user EXPLICITLY tells the critic to stop something. Empty array otherwise.
Most fields should be 0 / "none" / []. Be conservative.`;
  try {
    const raw = await ai([
      { role: "system", content: sys },
      { role: "user", content: `Critic last said:\n"${priorAssistant}"\n\nListener replied:\n"${userReply}"\n\nReturn the JSON.` },
    ]);
    const cleaned = raw.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as ToneSignals;
    return parsed;
  } catch {
    return null;
  }
}

function applyToneSignals(p: CriticProfileRow, s: ToneSignals): CriticProfileRow {
  const next: CriticProfileRow = {
    bluntness: clampDial(p.bluntness + (s.tone?.bluntness ?? 0)),
    playfulness: clampDial(p.playfulness + (s.tone?.playfulness ?? 0)),
    patience: clampDial(p.patience + (s.tone?.patience ?? 0)),
    provocation_appetite: clampDial(p.provocation_appetite + (s.tone?.provocation_appetite ?? 0)),
    move_tally: { ...p.move_tally },
    forbidden_moves: [...p.forbidden_moves],
    turns_observed: p.turns_observed + 1,
  };
  if (s.last_move && s.last_move !== "none" && s.outcome && s.outcome !== "none") {
    const bucket = { ...(next.move_tally[s.last_move] ?? {}) };
    bucket[s.outcome] = (bucket[s.outcome] ?? 0) + 1;
    next.move_tally[s.last_move] = bucket;
  }
  if (Array.isArray(s.forbid)) {
    for (const phrase of s.forbid) {
      const trimmed = String(phrase ?? "").trim().slice(0, 120);
      if (!trimmed) continue;
      if (!next.forbidden_moves.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
        next.forbidden_moves.push(trimmed);
      }
    }
  }
  return next;
}

type ChatRole = "user" | "assistant" | "system";

async function ensureChatSessionForUser(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<{ sessionId: string; profile: any } | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("opening_songs, opening_hypothesis, opening_lane, opening_lane_confidence, opening_analysis_json")
    .eq("user_id", userId)
    .maybeSingle();

  // Reuse the most recent session if one exists.
  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1);
  if (existing && existing.length) return { sessionId: existing[0].id, profile };

  // Create a session from the opener so chat has somewhere to live.
  if (!profile?.opening_songs) return null;
  const lane = (profile.opening_lane as string | null) ?? "general";
  const conf = Number(profile.opening_lane_confidence ?? 0);
  const dims = (profile.opening_analysis_json?.candidate_dimensions ?? {}) as Record<string, number>;
  const vector = seedVectorFromPriors(dims);
  const { data: created, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      vector,
      lane,
      lane_confidence: conf,
      probe_candidate_lanes: [],
      probe_state: { probes_shown: [], pending: {}, lane_alignment: {}, flips: [] },
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return { sessionId: created.id, profile };
}

export const chatTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      message: z.string().trim().min(1).max(2000),
      sessionId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ reply: string; sessionId: string }> => {
    const { supabase, userId } = context;

    let sessionId = data.sessionId ?? null;
    let profile: any = null;
    if (!sessionId) {
      const anchor = await ensureChatSessionForUser(supabase as never, userId);
      if (!anchor) {
        return {
          reply: "Name three songs first — I need somewhere to start.",
          sessionId: "",
        };
      }
      sessionId = anchor.sessionId;
      profile = anchor.profile;
    } else {
      // Caller-supplied sessionId — verify it actually belongs to this user
      // before we write any chat rows against it.
      const { data: owned, error: ownErr } = await supabase
        .from("sessions")
        .select("user_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (ownErr) throw new Error(ownErr.message);
      if (!owned || owned.user_id !== userId) throw new Error("forbidden");
      const { data: p } = await supabase
        .from("profiles")
        .select("opening_songs, opening_hypothesis, opening_lane, opening_analysis_json")
        .eq("user_id", userId)
        .maybeSingle();
      profile = p;
    }

    // Save the user turn first so it shows up even if AI fails.
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "user",
      content: data.message,
    });

    // Pull recent history (last 20 messages) for context.
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(40);

    // Pull session vector for current lean.
    const { data: sessionRow } = await supabase
      .from("sessions")
      .select("vector, lane")
      .eq("id", sessionId)
      .maybeSingle();
    let vector = (sessionRow?.vector ?? {}) as Record<string, number>;

    // -------- Chat-driven dimension extraction --------
    // The user's reply is evidence too. Run a tight LLM pass to pull signed
    // deltas per dimension from the latest user turn (with brief recent
    // history for context). Cap per-turn movement so pairings stay primary.
    const PER_TURN_CAP = 10;          // max |delta| applied to any one axis per turn
    const VECTOR_BOUND = 200;         // overall clamp on |vector[axis]|
    // Skip the extractor pass on short / trivial replies ("ok", "yeah", "lol").
    // Saves an LLM call and avoids feeding noise into the vector.
    const EXTRACTOR_MIN_CHARS = 12;
    const trimmedMsg = data.message.trim();
    const recentTurns = (history ?? [])
      .slice(-8)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const extractorVoice = `You read a listener's chat reply and score it along 10 taste dimensions: ${(DIMS as readonly string[]).join(", ")}.
Return STRICT JSON: {"deltas": {"<dimension>": <integer between -10 and 10>, ...}}.
Only include dimensions the message clearly speaks to. Positive = high pole, negative = low pole, using these poles:
${(DIMS as readonly string[]).map((d) => `- ${d}: +${DIM_LABEL[d]?.hi} / -${DIM_LABEL[d]?.lo}`).join("\n")}
Rules: at most 5 dimensions per reply. Skip dimensions the reply doesn't actually address. If the reply is empty, hostile filler, or off-topic, return {"deltas": {}}.
No prose, no markdown fences.`;
    if (trimmedMsg.length >= EXTRACTOR_MIN_CHARS) try {
      const extractTxt = await ai([
        { role: "system", content: extractorVoice },
        { role: "user", content: `Recent turns:\n${recentTurns || "(none)"}\n\nLatest user reply:\n${data.message}\n\nReturn the JSON now.` },
      ]);
      const cleaned = extractTxt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { deltas?: Record<string, unknown> };
      const deltas = parsed?.deltas ?? {};
      const applied: Record<string, number> = {};
      for (const dim of DIMS as readonly string[]) {
        const raw = deltas[dim];
        if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
        const capped = Math.max(-PER_TURN_CAP, Math.min(PER_TURN_CAP, Math.round(raw)));
        if (capped === 0) continue;
        const next = Math.max(-VECTOR_BOUND, Math.min(VECTOR_BOUND, (vector[dim] ?? 0) + capped));
        if (next !== (vector[dim] ?? 0)) applied[dim] = capped;
        vector[dim] = next;
      }
      if (Object.keys(applied).length) {
        await supabase.from("sessions").update({ vector }).eq("id", sessionId);
        // Fire-and-forget event log; never block the reply.
        supabase.from("event_log").insert({
          user_id: userId,
          session_id: sessionId,
          event_type: "chat_vector_update",
          props: { deltas: applied } as never,
          client: "server",
        }).then(() => undefined, () => undefined);
      }
    } catch {
      // Extraction is best-effort; chat continues with the prior vector.
    }

    const topAxes = (DIMS as readonly string[])
      .map((d) => ({ d, v: vector[d] ?? 0 }))
      .filter((x) => Math.abs(x.v) >= 8)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 5);


    const ctxLines: string[] = [];
    if (profile?.opening_songs?.length) {
      ctxLines.push(`Opener songs (ranked):\n${(profile.opening_songs as string[]).map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
    }
    if (profile?.opening_hypothesis) {
      ctxLines.push(`Working hypothesis: "${profile.opening_hypothesis}"`);
    }
    if (profile?.opening_lane) {
      ctxLines.push(`Lane: ${profile.opening_lane}`);
    }
    if (topAxes.length) {
      ctxLines.push(
        `Strongest leans so far:\n${topAxes
          .map(({ d, v }) => {
            const lbl = DIM_LABEL[d];
            return `- ${d}: ${v >= 0 ? "+" : ""}${Math.round(v)} (${v >= 0 ? lbl?.hi : lbl?.lo})`;
          })
          .join("\n")}`,
      );
    }
    const contextBlock = ctxLines.length ? `Listener context:\n${ctxLines.join("\n\n")}` : "No prior context yet.";

    const criticProfile = await loadCriticProfile(supabase as never, userId);
    const voiceMod = buildVoiceModulation(criticProfile);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: CHAT_VOICE },
      ...(voiceMod ? [{ role: "system" as const, content: voiceMod }] : []),
      { role: "system", content: contextBlock },
    ];
    for (const m of history ?? []) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: m.content });
      }
    }

    let reply = "";
    try {
      reply = await ai(messages);
    } catch {
      reply = "I lost the thread for a second. Say that again?";
    }
    reply = (reply || "").trim() || "Mm. Keep going.";
    if (reply.length > 1200) reply = reply.slice(0, 1197) + "…";

    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    // -------- Update critic profile from this exchange --------
    // The user's reply is feedback on the critic's PRIOR assistant turn (the
    // one before this new reply). Note: `history` was fetched AFTER we inserted
    // the new user message but BEFORE the new assistant reply, so the last
    // assistant entry in it is correctly the one the user just reacted to —
    // don't reorder those statements.
    // Skip on short / trivial replies — no real signal, just LLM spend.
    if (trimmedMsg.length >= EXTRACTOR_MIN_CHARS) try {
      const priorAssistant = [...(history ?? [])]
        .reverse()
        .find((m) => m.role === "assistant")?.content as string | undefined;
      const signals = await extractToneSignals(priorAssistant ?? null, data.message);
      if (signals) {
        const next = applyToneSignals(criticProfile, signals);
        await persistCriticProfile(supabase as never, userId, next);
      }
    } catch {
      // Profile update is best-effort.
    }

    return { reply, sessionId };
  });

export const listChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let sessionId = data.sessionId ?? null;
    if (!sessionId) {
      const { data: existing } = await supabase
        .from("sessions")
        .select("id")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(1);
      sessionId = existing?.[0]?.id ?? null;
    }
    if (!sessionId) return { sessionId: null, messages: [] as Array<{ role: ChatRole; content: string; created_at: string }> };
    const { data: rows } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(200);
    return {
      sessionId,
      messages: ((rows ?? []) as Array<{ role: string; content: string; created_at: string }>).map((r) => ({
        role: r.role as ChatRole,
        content: r.content,
        created_at: r.created_at,
      })),
    };
  });


// ============================================================
// Per-round running hypothesis — the "detective board" line.
// Templated (no LLM): reads the session vector, returns the
// strongest axis as a one-liner. Client compares topDim across
// rounds to render forming / holding / revising.
// ============================================================
export const currentRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ thesis: string; hook: string; topDim: string | null; strength: number }> => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("sessions")
      .select("vector,user_id")
      .eq("id", data.sessionId)
      .single();
    const s = session as { vector: Record<string, number>; user_id: string } | null;
    if (!s || s.user_id !== userId) return { thesis: "Still listening.", hook: "", topDim: null, strength: 0 };
    const vector = s.vector ?? {};
    const ranked = (DIMS as readonly string[])
      .map((d) => ({ d, v: vector[d] ?? 0 }))
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const top = ranked[0];
    // Rotate variants by current choice count so the running thesis evolves
    // round to round instead of repeating the same line on the same axis.
    const { count: choiceCount } = await supabase
      .from("choices")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data.sessionId);
    const round = choiceCount ?? 0;
    // Gate identity claims: need real support AND enough rounds to make it
    // sound like observation rather than assumption.
    if (!top || Math.abs(top.v) < 12 || round < 5) {
      return {
        thesis: "Still listening.\nToo early to call.\nKeep picking.",
        hook: "Throw me another one.",
        topDim: top?.d ?? null,
        strength: top ? Math.abs(top.v) : 0,
      };
    }
    const variantSeed = round + dimSeed(top.d) + (top.v >= 0 ? 0 : 1);
    const beat = BEAT[top.d];
    const pole = pickVariant(top.v >= 0 ? beat?.hi : beat?.lo, variantSeed);
    if (!pole) {
      const p = POLES[top.d]?.[top.v >= 0 ? "hi" : "lo"];
      const line = pickByHash(p?.observations, variantSeed);
      return {
        thesis: line ?? `Leaning ${top.d}.`,
        hook: "Let's see if that holds.",
        topDim: top.d,
        strength: Math.abs(top.v),
      };
    }
    return { thesis: pole.thesis, hook: pole.hook, topDim: top.d, strength: Math.abs(top.v) };
  });
