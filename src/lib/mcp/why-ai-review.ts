import { z } from "zod";
import type { Actor } from "./access";
import { assertDb, McpError, rpc } from "./access";
import { boundedRows, hasMoreRows, pageCursor, nextCursor } from "./pagination";
import type { WhyRecord } from "./song-whys";
import {
  WHY_AI_POLICY_VERSION,
  WHY_AI_POLICY_VERSIONS,
  WHY_AI_VERDICTS,
} from "./why-ai-review-policy";

export const whyAiRequestSchema = z
  .object({
    explanation_id: z.string().uuid(),
    expected_version: z.string().regex(/^why-v1:[a-f0-9]{64}$/),
    expected_context_version: z.string().regex(/^why-v1:[a-f0-9]{64}$/),
    mutation_id: z.string().uuid(),
    confirm_paid_review: z.literal(true),
    expected_policy_version: z.literal(WHY_AI_POLICY_VERSION).default(WHY_AI_POLICY_VERSION),
  })
  .strict();
export type WhyAiRequest = z.input<typeof whyAiRequestSchema>;
export type WhyAiReview = {
  id: string;
  explanation_id: string;
  explanation_version: string;
  context_version: string;
  snapshot: {
    explanation: Pick<
      WhyRecord["explanation"],
      | "id"
      | "song_id"
      | "axis"
      | "score_at_write"
      | "audible_evidence"
      | "interpretation"
      | "review_note"
      | "scoring_version"
      | "status"
    >;
    version: string;
    song: WhyRecord["song"];
    attribute: {
      key: string | null;
      current_score: number | null;
      score_at_write: number;
      low_pole: string | null;
      high_pole: string | null;
      definition: string | null;
    };
    stale_explanation: boolean;
    recording_identity: Record<string, string | number | null>;
  };
  state: string;
  display_state: string;
  stale_result: boolean;
  stale_explanation: boolean;
  result: {
    axis: string;
    verdict: "pass" | "fail" | "uncertain";
    note: string;
    score_disputed: boolean;
    suggested_score: number | null;
    reason: string;
  } | null;
  policy_version: string;
  configured_routing: Record<string, string | number | boolean | null> | null;
  measurement: Record<string, string | number | boolean | null> | null;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
};
const reviewColumns =
  "id,explanation_id,explanation_version,context_version,snapshot,state,display_state,stale_result,stale_explanation,result,policy_version,configured_routing,measurement,error_code,created_at,completed_at";
export async function readWhyAiReview(actor: Actor, id: string): Promise<WhyAiReview> {
  const { data, error } = await actor.db
    .from("musicdna_mcp_why_ai_reviews")
    .select(reviewColumns)
    .eq("id", id)
    .maybeSingle();
  assertDb(error);
  if (!data) throw new McpError("NOT_FOUND");
  return data as unknown as WhyAiReview;
}
export type WhyAiFilters = {
  explanation_id?: string;
  lane?: string;
  score_disputed?: boolean;
  suggestion_unavailable?: boolean;
  stale?: boolean;
  state?: string;
  policy_version?: string;
  verdict?: (typeof WHY_AI_VERDICTS)[number];
};
export async function listWhyAiReviews(
  actor: Actor,
  input: WhyAiFilters & { limit: number; cursor?: string },
) {
  const { limit, cursor, ...filters } = input;
  const state = pageCursor(cursor, actor.userId, { tool: "song_whys_list_ai_reviews", ...filters });
  let query = actor.db
    .from("musicdna_mcp_why_ai_reviews")
    .select(reviewColumns, { count: "exact" })
    .lte("created_at", state.snapshot)
    .order("id")
    .limit(limit + 1);
  if (state.last) query = query.gt("id", state.last);
  if (filters.explanation_id) query = query.eq("explanation_id", filters.explanation_id);
  if (filters.lane) query = query.eq("lane", filters.lane);
  if (filters.score_disputed !== undefined)
    query = query.eq("score_disputed", filters.score_disputed);
  if (filters.suggestion_unavailable !== undefined)
    query = query.eq("suggestion_unavailable", filters.suggestion_unavailable);
  if (filters.stale !== undefined) query = query.eq("stale_result", filters.stale);
  if (filters.state) query = query.eq("display_state", filters.state);
  if (filters.policy_version) query = query.eq("policy_version", filters.policy_version);
  if (filters.verdict) query = query.eq("result->>verdict", filters.verdict);
  const { data, error, count } = await query;
  assertDb(error);
  const rows = boundedRows((data ?? []) as unknown as WhyAiReview[], limit);
  return {
    reviews: rows,
    remaining_count: count,
    total_count: state.total ?? count,
    snapshot: state.snapshot,
    count_scope: "total at first page; freshness may change between pages",
    next_cursor: hasMoreRows(count, rows.length)
      ? nextCursor(actor.userId, { ...state, total: state.total ?? count }, rows.at(-1)!.id)
      : null,
  };
}
/** No caller can supply an AI verdict. Browser tokens cannot execute server completion RPCs. */
export async function requestWhyAiReview(actor: Actor, raw: WhyAiRequest) {
  const input = whyAiRequestSchema.parse(raw);
  if (!actor.capabilities.catalog_review) throw new McpError("FORBIDDEN");
  const reservation = await rpc<{ request_id: string; replayed: boolean }>(
    actor.db,
    "musicdna_mcp_request_why_ai_review_v2",
    {
      p_id: input.explanation_id,
      p_version: input.expected_version,
      p_context: input.expected_context_version,
      p_mutation: input.mutation_id,
      p_confirm_paid: input.confirm_paid_review,
    },
  );
  // A repeat NEVER invokes the provider, including interrupted/ambiguous submissions.
  if (!reservation.replayed) {
    const { runSavedWhyReview } = await import("./why-ai-review.server");
    await runSavedWhyReview(reservation.request_id, actor.userId);
  }
  return {
    replayed: reservation.replayed,
    review: await readWhyAiReview(actor, reservation.request_id),
    advisory_only: true,
    next_step:
      "Human review in Admin → Song Whys. No score, explanation, approval or saved reading changed.",
  };
}

export type WhyReviewRates = {
  policy_version: string;
  requested: number;
  completed: number;
  pass: number;
  fail: number;
  uncertain: number;
  unavailable: number;
  failure_rate: number | null;
  uncertainty_rate: number | null;
  scope: string;
  denominator: string;
};
const count = z.number().int().nonnegative();
const fraction = z.number().finite().min(0).max(1).nullable();
const ratesSchema = z.object({
  policy_version: z.enum(WHY_AI_POLICY_VERSIONS),
  requested: count,
  completed: count,
  pass: count,
  fail: count,
  uncertain: count,
  unavailable: count,
  failure_rate: fraction,
  uncertainty_rate: fraction,
  scope: z.string().min(1),
  denominator: z.string().min(1),
});
export function validateWhyReviewRates(
  value: unknown,
  policy: string,
  cohortSize?: number,
): WhyReviewRates {
  const parsed = ratesSchema.safeParse(value);
  if (!parsed.success) throw new McpError("REVIEW_RATES_UNAVAILABLE", true);
  const r = parsed.data;
  const sameRate = (actual: number | null, numerator: number) =>
    r.completed === 0
      ? actual === null
      : actual !== null && Math.abs(actual - numerator / r.completed) < 1e-9;
  if (
    r.policy_version !== policy ||
    r.requested !== r.completed + r.unavailable ||
    r.completed !== r.pass + r.fail + r.uncertain ||
    (cohortSize !== undefined && r.requested > cohortSize) ||
    (policy === "saved-song-why-review-v1" && r.uncertain !== 0) ||
    !sameRate(r.failure_rate, r.fail) ||
    !sameRate(r.uncertainty_rate, r.uncertain)
  ) {
    throw new McpError("REVIEW_RATES_UNAVAILABLE", true);
  }
  return r;
}
export async function whyReviewRates(actor: Actor, policy: string, ids?: string[]) {
  if (!actor.capabilities.catalog_read) throw new McpError("FORBIDDEN");
  const selectedPolicy = z.enum(WHY_AI_POLICY_VERSIONS).parse(policy);
  const cohort =
    ids === undefined ? undefined : z.array(z.string().uuid()).min(1).max(50).parse(ids);
  const value = await rpc<unknown>(actor.db, "musicdna_mcp_why_ai_review_rates", {
    p_policy: selectedPolicy,
    p_ids: cohort ?? null,
  });
  return validateWhyReviewRates(value, selectedPolicy, cohort ? new Set(cohort).size : undefined);
}
