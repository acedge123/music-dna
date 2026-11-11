import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DIMS } from "@/musicdna/engine/axes";
import {
  DECADES,
  compareToOriginal,
  decadeCoverage,
  isDecade,
  PLAYABLE_PAIRING_LIMIT,
  PLAYABLE_PAIRING_SELECT,
  type DecadeCoverage,
  type DecadeShift,
} from "@/musicdna/engine/decades";
import { loadChoiceEvidence } from "@/musicdna/adapters/choice-evidence";

type Authed = Parameters<typeof loadChoiceEvidence>[0];

async function loadCoverage(client: Authed): Promise<DecadeCoverage[]> {
  const { data, error } = await client
    .from("pairings")
    .select(PLAYABLE_PAIRING_SELECT)
    .eq("active", true)
    .eq("is_bootstrap", false)
    .range(0, PLAYABLE_PAIRING_LIMIT - 1);
  if (error) throw new Error(error.message);
  return decadeCoverage((data ?? []) as never, DIMS);
}

/** Root discover reading for any session (explore runs point back to it). */
async function rootReading(client: Authed, userId: string, sessionId: string) {
  const { data, error } = await client
    .from("sessions")
    .select("id, user_id, mode, parent_session_id, completed_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Reading not found");
  const row = data as { id: string; mode: string; parent_session_id: string | null; completed_at: string | null };
  return row.mode === "explore" && row.parent_session_id ? row.parent_session_id : row.id;
}

export const getExploreOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => exploreOptionsImpl(context.supabase, context.userId, data));

/** Shared by web and REST (`GET /api/v1/session/:id/explore`). */
export async function exploreOptionsImpl(client: Authed, userId: string, data: { sessionId: string }) {
    const context = { supabase: client, userId };
    const rootId = await rootReading(context.supabase, context.userId, data.sessionId);
    const [coverage, runsRes] = await Promise.all([
      loadCoverage(context.supabase),
      context.supabase
        .from("sessions")
        .select("id, decade, completed_at, started_at")
        .eq("parent_session_id", rootId)
        .eq("user_id", context.userId)
        .order("started_at", { ascending: false }),
    ]);
    return {
      rootSessionId: rootId,
      decades: coverage.map((c) => ({ decade: c.decade, ready: c.ready, pairings: c.pairings })),
      runs: ((runsRes.data ?? []) as Array<{ id: string; decade: number; completed_at: string | null; started_at: string }>).map(
        (r) => ({ id: r.id, decade: r.decade, completed: Boolean(r.completed_at), startedAt: r.started_at }),
      ),
    };
}

export class ExploreError extends Error {}

export const startExplore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), decade: z.number().int(), startKey: z.string().min(8).max(80).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => startExploreImpl(context.supabase, context.userId, data));

/** Shared by web and REST (`POST /api/v1/session/:id/explore`). */
export async function startExploreImpl(client: Authed, userId: string, data: { sessionId: string; decade: number; startKey?: string | null }) {
    const context = { supabase: client, userId };
    if (!isDecade(data.decade)) throw new ExploreError("Unknown decade");
    const rootId = await rootReading(context.supabase, context.userId, data.sessionId);
    const { data: parent } = await context.supabase
      .from("sessions")
      .select("lane, completed_at")
      .eq("id", rootId)
      .maybeSingle();
    if (!parent?.completed_at) throw new ExploreError("Finish your reading before exploring decades");
    // Retry-safe: same listener + start key returns the run it already created.
    const key = data.startKey ? `${rootId}:${data.decade}:${data.startKey}` : null;
    const existing = async () => {
      if (!key) return null;
      const { data: hit } = await context.supabase
        .from("sessions")
        .select("id")
        .eq("user_id", context.userId)
        .eq("explore_start_key" as never, key)
        .maybeSingle();
      return hit ? { sessionId: (hit as { id: string }).id, replayed: true } : null;
    };
    const prior = await existing();
    if (prior) return prior;
    const cov = (await loadCoverage(context.supabase)).find((c) => c.decade === data.decade);
    if (!cov?.ready) throw new ExploreError("That decade isn't ready yet");
    const lane = parent.lane && parent.lane !== "general" ? parent.lane : "pop";
    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert({
        user_id: context.userId,
        vector: {},
        lane,
        lane_confidence: 1,
        probe_candidate_lanes: [],
        probe_state: { probes_shown: [], pending: {}, lane_alignment: {}, flips: [] },
        mode: "explore",
        decade: data.decade,
        parent_session_id: rootId,
        explore_start_key: key,
      } as never)
      .select("id")
      .single();
    if (error) {
      // Concurrent double tap: the unique key lost the race — return the winner.
      if ((error as { code?: string }).code === "23505") {
        const winner = await existing();
        if (winner) return winner;
      }
      throw new Error(error.message);
    }
    return { sessionId: (row as { id: string }).id, replayed: false };
}

export type ExploreComparison = {
  decade: number;
  rootSessionId: string;
  shifts: DecadeShift[];
};

export const getExploreComparison = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => exploreComparisonImpl(context.supabase, context.userId, data));

/** Shared by web and REST (`GET /api/v1/session/:id/comparison`). */
export async function exploreComparisonImpl(
  client: Authed,
  userId: string,
  data: { sessionId: string },
): Promise<ExploreComparison | null> {
    const context = { supabase: client, userId };
    const { data: s } = await context.supabase
      .from("sessions")
      .select("mode, decade, parent_session_id")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const row = s as { mode?: string; decade?: number; parent_session_id?: string | null } | null;
    if (!row || row.mode !== "explore" || !row.parent_session_id || !isDecade(row.decade)) return null;
    const [orig, dec] = await Promise.all([
      loadChoiceEvidence(context.supabase, row.parent_session_id),
      loadChoiceEvidence(context.supabase, data.sessionId),
    ]);
    return {
      decade: row.decade,
      rootSessionId: row.parent_session_id,
      shifts: compareToOriginal(orig.ledger.axes, dec.ledger.axes),
    };
}

export const getDecadeCoverage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden: admin only");
    return { dims: [...DIMS] as string[], decades: [...DECADES] as number[], coverage: await loadCoverage(context.supabase) };
  });
