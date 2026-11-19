import { z } from "zod";
import { tool } from "./tools";
import { McpError } from "./access";
import { allRows } from "./diagnostics";
import { qaPage } from "./qa-tools";
import { pageSchema } from "./pagination";
import { describeConfiguredModelRouting } from "../../musicdna/adapters/llm-gateway";
import {
  CRITIC_EXPRESSION_VERSION,
  CRITIC_REVIEW_VERSION,
} from "../../musicdna/adapters/critic-editorial";
import { QUALITY_RUBRIC_VERSION } from "../../musicdna/engine/critic-quality";
const measurement = z.object({
  phase: z.enum(["writer", "reviewer"]),
  status: z.enum(["ok", "failed"]),
  latency_ms: z.number().finite().nonnegative(),
  model: z.string().max(120).nullable(),
  provider: z.string().max(30).nullable(),
  input_tokens: z.number().finite().int().nonnegative().nullable(),
  output_tokens: z.number().finite().int().nonnegative().nullable(),
});
type Attempt = {
  status: unknown;
  calls: unknown;
  writer_version?: unknown;
  reviewer_version?: unknown;
  [key: string]: unknown;
};
export function qualityMetrics(attempts: Attempt[]) {
  const calls = attempts.flatMap((a) =>
    (Array.isArray(a.calls) ? a.calls : []).flatMap((c) => {
      const parsed = measurement.safeParse(c);
      return parsed.success ? [parsed.data] : [];
    }),
  );
  const measured = attempts.filter(
      (a) => Array.isArray(a.calls) && a.calls.some((c) => measurement.safeParse(c).success),
    ),
    accepted = measured.filter((a) => a.status === "ok");
  const writerCount = (a: Attempt) =>
    (Array.isArray(a.calls) ? a.calls : []).filter(
      (c) => measurement.safeParse(c).success && (c as { phase: string }).phase === "writer",
    ).length;
  const reviewerCount = (a: Attempt) =>
    (Array.isArray(a.calls) ? a.calls : []).filter(
      (c) => measurement.safeParse(c).success && (c as { phase: string }).phase === "reviewer",
    ).length;
  const firstPassEligible = measured.filter((a) => a.status !== "ok" || reviewerCount(a) > 0);
  const first = accepted.filter((a) => writerCount(a) === 1 && reviewerCount(a) === 1).length;
  const latency = calls.map((c) => c.latency_ms).sort((a, b) => a - b),
    q = (p: number) =>
      latency.length ? latency[Math.max(0, Math.ceil(p * latency.length) - 1)] : null;
  const sum = (key: "input_tokens" | "output_tokens") => {
    const known = calls.map((c) => c[key]).filter((n): n is number => typeof n === "number");
    return {
      known_total: known.length ? known.reduce((s, n) => s + n, 0) : null,
      measured_calls: known.length,
      missing_calls: calls.length - known.length,
    };
  };
  const byModel: Record<string, { calls: number; failed: number }> = {};
  for (const c of calls) {
    const key = c.model ?? "unrecorded";
    byModel[key] ??= { calls: 0, failed: 0 };
    byModel[key].calls++;
    if (c.status === "failed") byModel[key].failed++;
  }
  return {
    attempts: attempts.length,
    attempts_with_measured_calls: measured.length,
    accepted_attempts: accepted.length,
    accepted_rate: measured.length ? accepted.length / measured.length : null,
    first_pass_accepted: first,
    first_pass_acceptance_denominator: firstPassEligible.length,
    first_pass_measurement_unknown: measured.length - firstPassEligible.length,
    first_pass_acceptance_rate: firstPassEligible.length ? first / firstPassEligible.length : null,
    repeated_writer_attempts: measured.filter((a) => writerCount(a) > 1).length,
    call_count: calls.length,
    failed_calls: calls.filter((c) => c.status === "failed").length,
    call_failure_rate: calls.length
      ? calls.filter((c) => c.status === "failed").length / calls.length
      : null,
    median_call_latency_ms: q(0.5),
    p95_call_latency_ms: q(0.95),
    input_tokens: sum("input_tokens"),
    output_tokens: sum("output_tokens"),
    estimated_cost_usd: null,
    cost_status: "unavailable: no verified pricing snapshot or measured cost is stored",
    by_model: byModel,
    invalid_or_unmeasured_call_entries:
      attempts.reduce((n, a) => n + (Array.isArray(a.calls) ? a.calls.length : 0), 0) -
      calls.length,
    availability: measured.length
      ? "measured_scoped_attempts_only"
      : "no_measured_attempts_in_authorized_scope",
    causal_claim:
      "No randomized/cohort or subjective product-improvement conclusion follows from these engineering counters.",
  };
}
const period = { created_after: z.string().datetime(), created_before: z.string().datetime() };
async function attemptsInPeriod(
  a: Parameters<typeof allRows>[0],
  i: { created_after: string; created_before: string },
) {
  if (i.created_after > i.created_before) throw new McpError("INVALID_INPUT");
  return (await allRows(a, "musicdna_mcp_qa_attempts", "*", {}, i)).filter(
    (r) => String(r.created_at) >= i.created_after && String(r.created_at) <= i.created_before,
  ) as Attempt[];
}
export const modelTools = [
  tool(
    "models_get_routing_summary",
    "inspect actual configured provider/role defaults and existing policy versions without credentials or a model call. Saved per-call measurements override assumptions about effective routing.",
    {},
    async () => ({
      configuration: describeConfiguredModelRouting(),
      writer_version: CRITIC_EXPRESSION_VERSION,
      reviewer_version: CRITIC_REVIEW_VERSION,
      quality_rubric_version: QUALITY_RUBRIC_VERSION,
      stages: {
        opening: "general model unless explicit override",
        after_pick: "Critic writer/reviewer role defaults",
        saved_reading: "Critic defaults with final stage reasoning",
        chat: "Critic conversational defaults",
        song_why_drafting: "writer role defaults",
        song_why_review: "reviewer role defaults",
      },
      secrets: "never returned",
      actual_historical_routing:
        "models_get_quality_metrics reads stored measurements; process defaults do not prove a past call used them.",
    }),
    "qa_read",
  ),
  tool(
    "models_get_quality_metrics",
    "compute measured engineering counters for an explicit UTC window over authorized attempts. Missing tokens/cost/phase timings stay unavailable; denominators and sampling scope are explicit.",
    period,
    async (i, a) => ({
      window: i,
      scope: "owned/approved QA sessions only, not all product traffic",
      ...qualityMetrics(await attemptsInPeriod(a, i)),
    }),
    "qa_read",
  ),
  tool(
    "models_compare_versions",
    "compare two stored writer configurations in one explicit UTC window, with sample sizes and no invented statistical significance or causality.",
    {
      ...period,
      baseline_writer_version: z.string().min(1).max(120).optional(),
      baseline_model: z.string().min(1).max(120).optional(),
      candidate_writer_version: z.string().min(1).max(120).optional(),
      candidate_model: z.string().min(1).max(120).optional(),
    },
    async (i, a) => {
      if (
        (!i.baseline_writer_version && !i.baseline_model) ||
        (!i.candidate_writer_version && !i.candidate_model)
      )
        throw new McpError("INVALID_INPUT");
      const rows = await attemptsInPeriod(a, i);
      const matches = (r: Attempt, version: string | undefined, model: string | undefined) =>
        (!version || r.writer_version === version) &&
        (!model ||
          (Array.isArray(r.calls) &&
            r.calls.some((c) => c?.phase === "writer" && c?.model === model)));
      return {
        window: { from: i.created_after, to: i.created_before },
        baseline: {
          version: i.baseline_writer_version ?? null,
          model: i.baseline_model ?? null,
          ...qualityMetrics(
            rows.filter((r) => matches(r, i.baseline_writer_version, i.baseline_model)),
          ),
        },
        candidate: {
          version: i.candidate_writer_version ?? null,
          model: i.candidate_model ?? null,
          ...qualityMetrics(
            rows.filter((r) => matches(r, i.candidate_writer_version, i.candidate_model)),
          ),
        },
        comparison_status: "descriptive_uncontrolled",
        caution:
          "Version groups may differ in evidence, stage, model and listener/cohort; small samples or missing measurements cannot establish improvement. No significance test is claimed.",
      };
    },
    "qa_read",
  ),
  tool(
    "models_get_learning_signals",
    "page minimal local learning outbox/delivery receipts for authorized sessions. Dispatch/receipt acknowledgement is not EdgeBot model completion, Agent Brain learning or Echelon approval/application.",
    {
      ...pageSchema,
      session_id: z.string().uuid().optional(),
      created_after: z.string().datetime().optional(),
      created_before: z.string().datetime().optional(),
    },
    async (i, a) => ({
      ...(await qaPage(a, "learning", i)),
      acknowledgement_proves:
        "Only the local dispatcher receipt; inspect exact state/receipt_id. No raw learning payload is exported.",
      edge_bot_completion: "not independently queried",
      agent_brain_completion: "not independently queried",
      echelon_approval: "not independently queried",
      musicdna_application: "not independently queried",
    }),
    "qa_read",
  ),
];
