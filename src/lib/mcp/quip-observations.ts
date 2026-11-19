import { z } from "zod";
import {
  FILLER_NEUTRAL,
  FILLER_PERSON,
  FILLER_REACTION,
  FILLER_OVERTIME,
} from "../../musicdna/engine/critic-fillers";
export const PACING_VERSION = "six-pick-overtime-v1";
export const QuipObservation = z
  .object({
    id: z.string().uuid(),
    session_id: z.string().uuid(),
    wait_id: z.string().uuid(),
    line: z.string().min(1).max(250),
    sequence: z.number().int().min(0).max(1000),
    answered: z.number().int().min(0).max(6),
    phase: z.enum(["post_pick_wait", "final_writing"]),
    shown_at: z.string().datetime(),
    duration_ms: z.number().int().min(0).max(3600000),
    since_wait_ms: z.number().int().min(0).max(3600000),
    ended_reason: z.enum(["changed_or_unmounted", "document_hidden"]),
  })
  .strict();
const lineEntries: [string, string][] = [
  ...FILLER_NEUTRAL.map((s) => [s, "neutral"] as [string, string]),
  ...Object.values(FILLER_REACTION)
    .flat()
    .map((s) => [s, "reaction"] as [string, string]),
  ...FILLER_PERSON.flat().map((s) => [s, "person"] as [string, string]),
  ...FILLER_OVERTIME.map((s) => [s, "overtime"] as [string, string]),
];
export const approvedLines = new Map<string, string[]>();
for (const [line, category] of lineEntries)
  approvedLines.set(line, [...new Set([...(approvedLines.get(line) ?? []), category])]);
export async function lineHash(text: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function resolveObservedQuips(rows: Record<string, unknown>[]) {
  const byHash = new Map(
    await Promise.all(
      [...approvedLines].map(
        async ([text, categories]) =>
          [
            await lineHash(text),
            {
              text,
              category: categories.length === 1 ? categories[0] : null,
              possible_categories: categories,
            },
          ] as const,
      ),
    ),
  );
  return rows.map((r) => ({
    ...r,
    ...(r.pacing_version === PACING_VERSION ? byHash.get(String(r.line_hash)) : undefined),
    text_availability:
      r.pacing_version === PACING_VERSION && byHash.has(String(r.line_hash))
        ? "exact_hash_match_to_approved_copy"
        : "unavailable_unknown_copy_or_hash",
    observation_source: "client_paint_report",
    independent_visual_verification: false,
  }));
}
export function pacingMetrics(rows: Record<string, unknown>[]) {
  // A phase transition can split one painted line into segments; preserve time but count once.
  const unique = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const key = `${r.wait_id}:${r.sequence}:${r.line_hash}`;
    if (!unique.has(key) || String(r.shown_at) < String(unique.get(key)!.shown_at))
      unique.set(key, r);
  }
  const sorted = [...unique.values()].sort((a, b) =>
      String(a.shown_at).localeCompare(String(b.shown_at)),
    ),
    waits = new Map<string, Record<string, unknown>[]>();
  for (const r of sorted) {
    const key = String(r.wait_id);
    waits.set(key, [...(waits.get(key) ?? []), r]);
  }
  const gaps: number[] = [],
    first: number[] = [];
  for (const events of waits.values()) {
    if (typeof events[0]?.since_wait_ms === "number") first.push(events[0].since_wait_ms);
    for (let n = 1; n < events.length; n++) {
      const gap =
        Date.parse(String(events[n].shown_at)) - Date.parse(String(events[n - 1].shown_at));
      if (Number.isFinite(gap) && gap >= 0 && gap < 3600000) gaps.push(gap);
    }
  }
  const avg = (values: number[]) =>
    values.length ? values.reduce((s, n) => s + n, 0) / values.length : null;
  const hashes = new Set(sorted.map((r) => r.line_hash));
  return {
    availability: rows.length
      ? "client_reported_paint_segments"
      : "unavailable_no_display_receipts",
    observed_segments: rows.length,
    unique_painted_lines: sorted.length,
    observed_waits: waits.size,
    average_quips_per_observed_wait: waits.size ? sorted.length / waits.size : null,
    average_time_to_first_observed_quip_ms: avg(first),
    average_within_wait_display_gap_ms: avg(gaps),
    repeated_line_id_count: sorted.length - hashes.size,
    repetition_scope:
      "Stable line hashes; repeated visibility/phase segments count once per wait/sequence",
    last_before_timeout: null,
    model_tier_comparison: null,
    coverage:
      "Only prospective owner-QA web paint receipts successfully delivered. Missing/closed-tab/background intervals and older clients are not reconstructed; no claim of complete session coverage.",
  };
}
