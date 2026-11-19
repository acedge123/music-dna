import type { Actor } from "./access";
import { assertDb, McpError } from "./access";
import { DIMS } from "../../musicdna/engine/axes";
import {
  hasDiagnosticIntegrity,
  validTests,
  sayingProblem,
} from "../../musicdna/engine/pairing-eligibility";
import {
  openerEra,
  preferEra,
  ERA_MIN_POOL,
  ERA_OPENING_ROUNDS,
} from "../../musicdna/engine/opener-era";
import {
  selectPairing,
  type PairingCandidate,
  type RecognitionRow,
} from "../../musicdna/engine/pairing";
import { applyChoice } from "../../musicdna/engine/choice";
import { queryHash, hasMoreRows, boundedRows, pageCursor, nextCursor } from "./pagination";
export type CatalogSong = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  primary_lane: string | null;
  [key: string]: unknown;
};
export type DiagnosticPair = PairingCandidate & {
  song_a: CatalogSong;
  song_b: CatalogSong;
  active: boolean;
  created_at: string;
  user_facing_tradeoff: string | null;
};
export async function allRows(
  a: Actor,
  table: string,
  select = "*",
  filters: Record<string, string> = {},
  window?: { created_after: string; created_before: string },
) {
  const rows: Record<string, unknown>[] = [];
  let last: string | undefined;
  const snapshot = new Date().toISOString();
  while (true) {
    let q = a.db
      .from(table)
      .select(select, { count: "exact" })
      .lte("created_at", snapshot)
      .order("id")
      .limit(500);
    if (last) q = q.gt("id", last);
    if (window)
      q = q.gte("created_at", window.created_after).lte("created_at", window.created_before);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error, count } = await q;
    assertDb(error);
    const more = hasMoreRows(count, data?.length ?? 0);
    if (!data?.length) break;
    const batch = data as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (rows.length > 10000) throw new McpError("ANALYSIS_LIMIT_REQUIRES_NARROWER_FILTER");
    last = String(batch.at(-1)!.id);
    if (!more) break;
  }
  return rows;
}
export async function pairingPool(a: Actor) {
  return allRows(
    a,
    "pairings",
    "id,lane,tests,diagnostic_weight,active,is_bootstrap,user_facing_tradeoff,created_at,updated_at,song_a:songs!pairings_song_a_id_fkey(*),song_b:songs!pairings_song_b_id_fkey(*)",
  ) as unknown as Promise<DiagnosticPair[]>;
}
export function proximity(
  years: number[],
  a: number | null,
  b: number | null,
  max = 10,
  requireBoth = true,
) {
  const distance = (year: number | null) => {
    if (year === null || !Number.isFinite(year) || !years.length)
      return { year, nearest_anchor: null, distance: null, within_range: null };
    const nearest = [...years].sort((x, y) => Math.abs(x - year) - Math.abs(y - year) || x - y)[0];
    return {
      year,
      nearest_anchor: nearest,
      distance: Math.abs(year - nearest),
      within_range: Math.abs(year - nearest) <= max,
    };
  };
  const left = distance(a),
    right = distance(b);
  return {
    song_a: left,
    song_b: right,
    eligible: requireBoth
      ? left.within_range === true && right.within_range === true
      : left.within_range === true || right.within_range === true,
    max_year_distance: max,
    require_both: requireBoth,
    reason:
      left.within_range === null || right.within_range === null
        ? "unknown_year"
        : (
              requireBoth
                ? left.within_range && right.within_range
                : left.within_range || right.within_range
            )
          ? null
          : "outside_nearest_anchor_window",
  };
}
export async function openingYears(
  a: Actor,
  ids: string[] | undefined,
  years: number[] | undefined,
) {
  if (ids?.length) {
    const { data, error } = await a.db.from("songs").select("id,year").in("id", ids);
    assertDb(error);
    if (data?.length !== new Set(ids).size) throw new McpError("NOT_FOUND");
    const byId = new Map(data.map((s) => [s.id, s.year]));
    const years = ids
      .map((id) => byId.get(id))
      .filter((y): y is number => typeof y === "number" && Number.isFinite(y));
    if (!years.length) throw new McpError("YEAR_UNAVAILABLE");
    return years;
  }
  if (!years?.length) throw new McpError("INVALID_INPUT");
  return years;
}
export async function pagePairs(
  a: Actor,
  i: { limit: number; cursor?: string; active?: boolean; lane?: string; song_id?: string },
) {
  const { limit, cursor, ...filters } = i,
    s = pageCursor(cursor, a.userId, { tool: "pairings_list", ...filters });
  let q = a.db
    .from("pairings")
    .select(
      "id,lane,tests,diagnostic_weight,active,is_bootstrap,user_facing_tradeoff,created_at,updated_at,song_a:songs!pairings_song_a_id_fkey(*),song_b:songs!pairings_song_b_id_fkey(*)",
      { count: "exact" },
    )
    .lte("created_at", s.snapshot)
    .order("id")
    .limit(limit + 1);
  if (s.last) q = q.gt("id", s.last);
  if (i.active !== undefined) q = q.eq("active", i.active);
  if (i.lane) q = q.eq("lane", i.lane);
  if (i.song_id) q = q.or(`song_a_id.eq.${i.song_id},song_b_id.eq.${i.song_id}`);
  const { data, error, count } = await q;
  assertDb(error);
  const rows = boundedRows(data ?? [], limit);
  return {
    pairings: rows,
    total_count: s.total ?? count,
    returned_count: rows.length,
    sort: "id ascending",
    snapshot: s.snapshot,
    next_cursor: hasMoreRows(count, rows.length)
      ? nextCursor(a.userId, { ...s, total: s.total ?? count }, rows.at(-1)!.id)
      : null,
    usage_statistics: "not included in catalog pages; authorized QA metadata only",
  };
}
export function seeded(seed: number) {
  let s = seed >>> 0;
  return {
    next: () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    },
  };
}
/** Offline shared-engine diagnostic; never calls server orchestration, writes, or an LLM. */
export function simulate(
  pool: DiagnosticPair[],
  i: {
    seed: number;
    years: number[];
    lane: string;
    vector?: Record<string, number>;
    votes: ("a" | "b")[];
  },
) {
  const used = new Set<string>(),
    rng = seeded(i.seed),
    rounds: Record<string, unknown>[] = [];
  let vector = { ...i.vector };
  const era = openerEra(i.years);
  for (let answered = 0; answered < 6; answered++) {
    const raw = pool.filter(
      (p) =>
        p.active &&
        !used.has(p.id) &&
        hasDiagnosticIntegrity(p) &&
        (i.lane === "general" || p.lane === i.lane),
    );
    let near = preferEra(raw, era, answered);
    let fallback: string | null =
      answered < ERA_OPENING_ROUNDS &&
      era &&
      near === raw &&
      raw.filter(
        (p) =>
          p.song_a.year !== null &&
          p.song_b.year !== null &&
          p.song_a.year >= era.from &&
          p.song_a.year <= era.to &&
          p.song_b.year >= era.from &&
          p.song_b.year <= era.to,
      ).length < ERA_MIN_POOL
        ? "soft_era_pool_below_minimum"
        : null;
    let picked = selectPairing({
      pool: near,
      vector,
      used_ids: used,
      session_lane: i.lane,
      dims: DIMS,
      rng,
      mode: "diagnostic_first",
    });
    if (picked.kind === "empty" && i.lane !== "general") {
      near = pool.filter((p) => p.active && p.lane === "general" && hasDiagnosticIntegrity(p));
      picked = selectPairing({
        pool: near,
        vector,
        used_ids: used,
        session_lane: i.lane,
        dims: DIMS,
        rng,
        mode: "recognition_first",
      });
      fallback = "general_lane_after_empty";
    }
    if (picked.kind === "empty") break;
    const p = picked.pairing,
      vote = i.votes[answered] ?? "a";
    used.add(p.id);
    rounds.push({
      round: answered + 1,
      pairing_id: p.id,
      song_a: {
        id: p.song_a.id,
        title: p.song_a.title,
        artist: p.song_a.artist,
        year: p.song_a.year,
      },
      song_b: {
        id: p.song_b.id,
        title: p.song_b.title,
        artist: p.song_b.artist,
        year: p.song_b.year,
      },
      proximity: proximity(i.years, p.song_a.year, p.song_b.year),
      selection_reason: picked.selection_reason,
      fallback_reason: fallback,
      simulated_vote: vote,
    });
    const values = (s: CatalogSong) =>
      Object.fromEntries(
        DIMS.filter((d) => typeof s[d] === "number").map((d) => [d, s[d] as number]),
      );
    vector = applyChoice({
      prior_vector: vector,
      winner: values(vote === "a" ? p.song_a : p.song_b),
      loser: values(vote === "a" ? p.song_b : p.song_a),
      tests: validTests(p.tests, p.song_a, p.song_b),
      diagnostic_weight: p.diagnostic_weight,
      fallback_dims: DIMS,
      strict_axes: true,
    }).vector;
  }
  return {
    synthetic: true,
    writes: 0,
    model_calls: 0,
    seed: i.seed,
    rounds,
    completed_six: rounds.length === 6,
    final_vector: vector,
    catalog_fingerprint: queryHash(pool),
    simulation_scope:
      "Shared selectPairing/applyChoice/preferEra engine, explicit supplied lane/vector. No opener LLM, bootstrap/random live router, recognition hydration, dynamic pilot assignment or live orchestration is simulated. This is not proof of an identical production interview or reading quality.",
    reading_quality: null,
    reviewer_acceptance: null,
    model_latency_ms: null,
  };
}
export function pairSummary(pool: DiagnosticPair[]) {
  const decades: Record<string, number> = {},
    lanes: Record<string, number> = {},
    axes: Record<string, number> = {};
  let gap = 0,
    known = 0,
    invalid = 0;
  for (const p of pool) {
    lanes[p.lane ?? "unknown"] = (lanes[p.lane ?? "unknown"] ?? 0) + 1;
    for (const d of p.tests ?? []) axes[d] = (axes[d] ?? 0) + 1;
    if (p.song_a.year !== null && p.song_b.year !== null) {
      gap += Math.abs(p.song_a.year - p.song_b.year);
      known++;
    }
    for (const y of [p.song_a.year, p.song_b.year])
      if (y === null) decades.unknown = (decades.unknown ?? 0) + 1;
      else {
        const d = String(Math.floor(y / 10) * 10);
        decades[d] = (decades[d] ?? 0) + 1;
      }
    if (!hasDiagnosticIntegrity(p) || sayingProblem(p.user_facing_tradeoff)) invalid++;
  }
  return {
    total: pool.length,
    active: pool.filter((p) => p.active).length,
    by_lane: lanes,
    by_attribute: axes,
    song_slots_by_decade: decades,
    average_year_difference: known ? gap / known : null,
    pairs_with_known_years: known,
    unvalidated_or_invalid: invalid,
    usage_and_skip_statistics:
      "Unavailable globally through catalog scope; use authorized interview metadata. No exposure denominator is inferred.",
  };
}
