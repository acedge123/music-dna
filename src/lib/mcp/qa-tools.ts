import { hasMoreRows } from "./pagination";
import { resolveObservedQuips, pacingMetrics } from "./quip-observations";
import { z } from "zod";
import { tool } from "./tools";
import { type Actor, assertDb, McpError } from "./access";
import { pageSchema, pageCursor, nextCursor, boundedRows } from "./pagination";
import {
  allRows,
  pairingPool,
  pagePairs,
  pairSummary,
  proximity,
  openingYears,
  simulate,
} from "./diagnostics";
import { DIMS } from "../../musicdna/engine/axes";
import { buildLedger } from "../../musicdna/engine/evidence";
import { snapshotChoice, type EvidenceRow } from "../../musicdna/engine/evidence-snapshot";
import { loadReadingEvidence } from "../../musicdna/adapters/choice-evidence";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../integrations/supabase/types";
import { buildReportEnvelope } from "../../musicdna/adapters/report-envelope";
import {
  hasDiagnosticIntegrity,
  validTests,
  sayingProblem,
} from "../../musicdna/engine/pairing-eligibility";
import { openerEra } from "../../musicdna/engine/opener-era";
const id = z.string().uuid(),
  date = z.string().datetime(),
  label = z.string().trim().min(1).max(120);
const windows = { created_after: date.optional(), created_before: date.optional() };
const anchors = {
  opening_song_ids: z.array(id).min(1).max(3).optional(),
  opening_years: z.array(z.number().int().min(1800).max(2200)).min(1).max(3).optional(),
};
const simulation = {
  ...anchors,
  seed: z.number().int().min(0).max(4294967295).default(1),
  lane: label.default("general"),
  vector: z.record(z.enum(DIMS), z.number().finite().min(-1000).max(1000)).optional(),
  votes: z
    .array(z.enum(["a", "b"]))
    .length(6)
    .default(["a", "a", "a", "a", "a", "a"]),
};
const tables = {
  sessions: "musicdna_mcp_qa_sessions",
  choices: "musicdna_mcp_qa_choices",
  events: "musicdna_mcp_qa_events",
  readings: "musicdna_mcp_qa_readings",
  attempts: "musicdna_mcp_qa_attempts",
  reviews: "musicdna_mcp_qa_reviews",
  calls: "musicdna_mcp_qa_calls",
  learning: "musicdna_mcp_learning_receipts",
  quips: "musicdna_mcp_qa_quips",
} as const;
export async function qaPage(
  a: Actor,
  kind: keyof typeof tables,
  input: {
    limit: number;
    cursor?: string;
    session_id?: string;
    created_after?: string;
    created_before?: string;
  },
  extra: Record<string, string | number | boolean> = {},
) {
  const { limit, cursor, ...filters } = input,
    s = pageCursor(cursor, a.userId, { kind, ...filters, ...extra });
  let q = a.db
    .from(tables[kind])
    .select("*", { count: "exact" })
    .lte("created_at", s.snapshot)
    .order("id")
    .limit(limit + 1);
  if (s.last) q = q.gt("id", s.last);
  if (input.session_id) q = q.eq("session_id", input.session_id);
  if (input.created_after) q = q.gte("created_at", input.created_after);
  if (input.created_before) q = q.lte("created_at", input.created_before);
  for (const [k, v] of Object.entries(extra))
    q = k === "non_ok_status" ? q.neq("status", "ok") : q.eq(k, v);
  const { data, error, count } = await q;
  assertDb(error);
  const rows = boundedRows(data ?? [], limit);
  return {
    records: rows,
    total_count: s.total ?? count,
    returned_count: rows.length,
    next_cursor: hasMoreRows(count, rows.length)
      ? nextCursor(a.userId, { ...s, total: s.total ?? count }, rows.at(-1)!.id)
      : null,
    scope:
      "Caller-owned sessions, caller-created owner-QA sessions, or explicitly approved unexpired session scopes. No global listener enumeration.",
    snapshot: s.snapshot,
    sort: "id ascending; timestamps/sequence describe observed chronology",
  };
}
async function session(a: Actor, sid: string) {
  const { data, error } = await a.db.from(tables.sessions).select("*").eq("id", sid).maybeSingle();
  assertDb(error);
  if (!data) throw new McpError("NOT_FOUND");
  return data;
}
async function evidence(a: Actor, sid: string) {
  return allRows(a, tables.choices, "*", { session_id: sid });
}
async function reading(a: Actor, sid: string, version?: number) {
  const s = await session(a, sid);
  let q = a.db.from(tables.readings).select("*").eq("session_id", sid);
  if (version !== undefined) q = q.eq("version", version);
  const { data, error } = await q.order("version", { ascending: false }).limit(1).maybeSingle();
  assertDb(error);
  if (!data) throw new McpError(version === undefined ? "NO_RESULT" : "VERSION_NOT_FOUND");
  // Reuse the normal frozen/cumulative evidence reader, through caller-scoped projections.
  const reader = {
    from: (table: string) => {
      if (table === "sessions") return a.db.from(tables.sessions);
      if (table === "choices") return a.db.from(tables.choices);
      throw new McpError("FORBIDDEN");
    },
  } as unknown as SupabaseClient<Database>;
  let ledger: Awaited<ReturnType<typeof loadReadingEvidence>>["ledger"] | null = null;
  let evidenceAvailability = "available";
  try {
    if (s.mode === "refine" && s.parent_session_id) await session(a, s.parent_session_id);
    ledger = (await loadReadingEvidence(reader, sid)).ledger;
  } catch {
    evidenceAvailability = "unavailable_or_parent_not_authorized";
  }
  const report = buildReportEnvelope(s, { ...data, content: data.frozen_content }, ledger);
  return {
    result_id: data.id,
    evidence_availability: evidenceAvailability,
    ledger,
    report: {
      ...report,
      frozen: { ...report.frozen, narration_status: data.frozen_content?.narration_status ?? null },
    },
    provenance: {
      ledger_version: data.ledger_version,
      policy_version: data.policy_version,
      engine_version: data.engine_version,
    },
    private_messages: "excluded",
    opening_snapshot:
      "Not stored per session in this schema; never reconstructed from a mutable profile",
  };
}
const page = { ...pageSchema, ...windows, session_id: id.optional() };
export const qaTools = [
  tool(
    "pairings_list",
    "browse canonical pairings and exact current song scores/years with deterministic cursor pagination.",
    {
      ...pageSchema,
      active: z.boolean().optional(),
      lane: label.optional(),
      song_id: id.optional(),
    },
    async (i, a) => pagePairs(a, i),
  ),
  tool(
    "pairings_get_summary",
    "measure catalog pairing coverage, validation gaps and year differences. No private exposure/skip denominator is inferred.",
    {},
    async (_, a) => pairSummary(await pairingPool(a)),
  ),
  tool(
    "pairings_get",
    "read one exact catalog pairing with current songs, declared tests and shared activation diagnostics; historical choices remain frozen separately.",
    { pairing_id: id },
    async (i, a) => {
      const pool = await pairingPool(a),
        p = pool.find((p) => p.id === i.pairing_id);
      if (!p) throw new McpError("NOT_FOUND");
      return {
        pairing: p,
        validation: {
          diagnostic_integrity: hasDiagnosticIntegrity(p),
          valid_tests: validTests(p.tests, p.song_a, p.song_b),
          saying_issue: sayingProblem(
            p.user_facing_tradeoff,
            pool.filter((x) => x.active && x.id !== p.id).map((x) => x.user_facing_tradeoff),
          ),
        },
        usage:
          "Use authorized session diagnostics; catalog visibility does not grant listener data.",
      };
    },
  ),
  tool(
    "pairings_validate_decade_proximity",
    "check exact nearest-opening-year distances against a configurable diagnostic window. The real selector uses a soft broader era preference, not this strict rule; this tool changes no production matching.",
    {
      ...anchors,
      ...pageSchema,
      max_year_distance: z.number().int().min(0).max(100).default(10),
      require_both: z.boolean().default(true),
      pairing_ids: z.array(id).max(100).optional(),
    },
    async (i, a) => {
      const years = await openingYears(a, i.opening_song_ids, i.opening_years),
        pool = (await pairingPool(a)).filter((p) => !i.pairing_ids || i.pairing_ids.includes(p.id));
      const s = pageCursor(i.cursor, a.userId, {
        tool: "proximity",
        years,
        max: i.max_year_distance,
        both: i.require_both,
        ids: i.pairing_ids,
      });
      const sorted = pool.sort((a, b) => a.id.localeCompare(b.id)),
        remaining = sorted.filter((p) => !s.last || p.id > s.last),
        rows = boundedRows(
          remaining.map((p) => ({
            id: p.id,
            ...proximity(years, p.song_a.year, p.song_b.year, i.max_year_distance, i.require_both),
          })),
          i.limit,
        );
      return {
        records: rows,
        total_count: pool.length,
        next_cursor:
          remaining.length > rows.length ? nextCursor(a.userId, s, rows.at(-1)!.id) : null,
        production_era_window: openerEra(years),
        production_policy:
          "Shared preferEra is soft, only first three answered picks, and widens if fewer than three in-era candidates. Strict diagnostic rejection does not prove production violated its configured policy.",
        production_fallback_used: null,
      };
    },
  ),
  tool(
    "pairings_find_for_song",
    "find diagnostic candidate matchups near one catalog opening song. Eligibility is a read-only year/integrity check, not a promise that live routing selects it.",
    { song_id: id, ...pageSchema, max_year_distance: z.number().int().min(0).max(100).default(10) },
    async (i, a) => {
      const years = await openingYears(a, [i.song_id], undefined);
      if (!years.length) throw new McpError("YEAR_UNAVAILABLE");
      const s = pageCursor(i.cursor, a.userId, {
        tool: "find_for_song",
        ...i,
        cursor: undefined,
        limit: undefined,
      });
      const pool = (await pairingPool(a))
          .filter((p) => p.active)
          .sort((a, b) => a.id.localeCompare(b.id)),
        remaining = pool.filter((p) => !s.last || p.id > s.last),
        rows = boundedRows(
          remaining.map((p) => ({
            id: p.id,
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
            proximity: proximity(years, p.song_a.year, p.song_b.year, i.max_year_distance),
            diagnostic_integrity: hasDiagnosticIntegrity(p),
            tested_axes: validTests(p.tests, p.song_a, p.song_b),
          })),
          i.limit,
        );
      return {
        records: rows,
        total_count: pool.length,
        next_cursor:
          remaining.length > rows.length ? nextCursor(a.userId, s, rows.at(-1)!.id) : null,
        ranking:
          "Stable ID order; live preference/ranking is not inferred from year distance alone.",
      };
    },
  ),
  tool(
    "pairings_simulate_interview",
    "run six deterministic offline picks using shared selectPairing/applyChoice/preferEra functions and supplied context. No database writes or model calls. Not full production bootstrap/router/LLM parity.",
    simulation,
    async (i, a) =>
      simulate(await pairingPool(a), {
        ...i,
        years: await openingYears(a, i.opening_song_ids, i.opening_years),
      }),
  ),
  tool(
    "pairings_analyze_quality",
    "analyze complete current catalog coverage, diagnostic integrity and year gaps without claiming unmeasured live skip/mismatch rates.",
    {},
    async (_, a) => {
      const pool = await pairingPool(a);
      return {
        ...pairSummary(pool),
        recommendations: pool.some((p) => !hasDiagnosticIntegrity(p))
          ? ["Review pairings without a valid declared contrast before activation."]
          : [],
        historical_decade_mismatch_rate: null,
        high_skip_pairings: null,
        usage_limitation:
          "No globally authorized frozen opener/exposure cohort is available through this catalog tool.",
      };
    },
  ),
  tool(
    "qa_list_interviews",
    "page ONLY authorized interview metadata. owner_qa is an operator tag, never proof of independent synthetic evidence.",
    {
      ...pageSchema,
      ...windows,
      is_guest: z.boolean().optional(),
      owner_qa: z.boolean().optional(),
    },
    async (i, a) =>
      qaPage(a, "sessions", i, {
        ...(i.is_guest !== undefined ? { is_guest: i.is_guest } : {}),
        ...(i.owner_qa !== undefined ? { owner_qa: i.owner_qa } : {}),
      }),
    "qa_read",
  ),
  tool(
    "qa_get_interview_trace",
    "read an authorized session and one cursor page of its frozen choices or trusted metadata events. No private chat, profiles, prompts or local-only raw critic traces.",
    {
      session_id: id,
      section: z.enum(["choices", "events", "attempts", "readings", "calls"]).default("events"),
      ...pageSchema,
    },
    async (i, a) => ({
      session: await session(a, i.session_id),
      section: i.section,
      ...(await qaPage(a, i.section, i)),
      opening_snapshot:
        "unavailable: no per-session frozen opener snapshot is recorded; current profiles are not used as history",
      raw_critic_trace: "withheld: existing local-only diagnostic policy",
    }),
    "qa_read",
  ),
  tool(
    "qa_get_critic_response",
    "inspect exact attempt metadata and any linked immutable accepted saved reading. Local-only raw writer/reviewer prose, rejected drafts and private messages are never exported.",
    { attempt_id: id },
    async (i, a) => {
      const { data, error } = await a.db
        .from(tables.attempts)
        .select("*")
        .eq("id", i.attempt_id)
        .maybeSingle();
      assertDb(error);
      if (!data) throw new McpError("NOT_FOUND");
      let saved = null;
      if (data.result_version !== null) {
        try {
          saved = await reading(a, data.session_id, data.result_version);
        } catch {
          saved = null;
        }
      }
      let historyRead = null;
      if (data.status === "ok" && data.output_fingerprint) {
        const found = await a.db
          .from(tables.events)
          .select("id,approved_read,created_at")
          .eq("session_id", data.session_id)
          .eq("approved_read_hash", data.output_fingerprint)
          .order("created_at")
          .limit(1)
          .maybeSingle();
        assertDb(found.error);
        historyRead = found.data;
      }
      return {
        attempt: data,
        exact_content_history_match: historyRead,
        history_source:
          "Trusted saved read event; exact content hash match does not identify which concurrent model call produced it or prove client display",
        accepted_saved_reading: saved?.report ?? null,
        raw_output: "unavailable_to_mcp: local-only private critic diagnostic text",
        raw_review_feedback: "withheld; numeric review checks and saved reason codes are supplied",
      };
    },
    "qa_read",
  ),
  tool(
    "qa_get_reviewer_results",
    "page exact human rubric reviews for authorized sessions. Do not equate these with model review acceptance or independent randomized results.",
    { ...page, rubric_version: label.optional(), stage: label.optional() },
    async (i, a) =>
      qaPage(a, "reviews", i, {
        ...(i.rubric_version ? { rubric_version: i.rubric_version } : {}),
        ...(i.stage ? { stage: i.stage } : {}),
      }),
    "qa_read",
  ),
  tool(
    "qa_get_reading",
    "replay an exact saved reading (or latest) with deterministic ledger annotations from frozen choices only. Never regenerates, changes an archetype or exposes self-report/chat text.",
    { session_id: id, version: z.number().int().positive().optional() },
    async (i, a) => reading(a, i.session_id, i.version),
    "qa_read",
  ),
  tool(
    "qa_validate_reading",
    "independently recompute existing ledger/claim-policy evidence from frozen choices for a saved result. Prose accuracy still needs the assistant/listener; no model verification is fabricated.",
    { session_id: id, version: z.number().int().positive().optional() },
    async (i, a) => {
      const r = await reading(a, i.session_id, i.version);
      return {
        ...r,
        validation_scope:
          "Shared buildLedger/evaluateClaim and frozen evidence only. Does not listen, verify recording facts or prove prose has no unsupported inference.",
        recording_verification_required: true,
        unavailable_frozen_choices: r.ledger?.unavailable ?? null,
        recommendation:
          !r.ledger || r.ledger.unavailable
            ? "Needs evidence review"
            : "Inspect returned claim eligibility and exact receipts before judging the prose.",
      };
    },
    "qa_read",
  ),
  tool(
    "qa_get_processing_timeline",
    "page measured model-attempt durations for an authorized session. Call duration sums are not wall-clock latency; missing phase timestamps/context/save timings remain unavailable.",
    { session_id: id, ...pageSchema },
    async (i, a) => {
      await session(a, i.session_id);
      return {
        ...(await qaPage(a, "attempts", i)),
        request_received_at: null,
        context_assembled_at: null,
        save_attempt_at: null,
        phase_start_end: "not_recorded; created_at is attempt persistence time, not model start",
        total_wall_clock_ms: null,
      };
    },
    "qa_read",
  ),
  tool(
    "qa_get_quip_timeline",
    "inspect stored client-reported display metadata only. No display events means unavailable, not zero quips; static pools/server-generated lines are never reconstructed as actual display history.",
    { session_id: id, ...pageSchema },
    async (i, a) => {
      await session(a, i.session_id);
      const page = await qaPage(a, "quips", i);
      return {
        ...page,
        records: await resolveObservedQuips(page.records),
        availability: page.total_count
          ? "client_reported_paint_receipts"
          : "unavailable_no_display_receipts",
        actual_visual_verification: false,
        coverage:
          "Prospective owner-QA web waits only; unknown historical/mobile displays are not reconstructed.",
      };
    },
    "qa_read",
  ),
  tool(
    "qa_analyze_quip_pacing",
    "analyze only recorded authorized quip display events, never source-code timers. Current historical telemetry may be absent; return unavailable metrics rather than inventing a timeline.",
    { session_id: id },
    async (i, a) => {
      await session(a, i.session_id);
      return {
        session_id: i.session_id,
        ...pacingMetrics(await allRows(a, tables.quips, "*", { session_id: i.session_id })),
      };
    },
    "qa_read",
  ),
  tool(
    "qa_get_errors",
    "page sanitized attempt status/reason codes for authorized sessions; raw provider errors/prompts are withheld and a failed diagnostic read is never a healthy empty check.",
    page,
    async (i, a) => qaPage(a, "attempts", i, { non_ok_status: true }),
    "qa_read",
  ),
  tool(
    "qa_run_synthetic_interview",
    "run an OFFLINE shared-engine synthetic diagnostic with six supplied choices, no persisted sessions/votes, no learning and no model spend. Full model quality/latency tests need a separately approved isolated provider harness.",
    { ...simulation, mode: z.literal("offline").default("offline") },
    async (i, a) => ({
      ...simulate(await pairingPool(a), {
        ...i,
        years: await openingYears(a, i.opening_song_ids, i.opening_years),
      }),
      isolation: "In-memory only; no production learning rows or test users",
      full_model_test: "unavailable_without_separately_approved_isolated_harness",
    }),
    "qa_read",
  ),
];
