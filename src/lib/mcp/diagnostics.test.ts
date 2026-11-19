import { pacingMetrics } from "./quip-observations";
import { it, expect } from "vitest";
import { proximity, simulate, allRows, type DiagnosticPair } from "./diagnostics";
import { qualityMetrics } from "./model-tools";
import { DIMS } from "../../musicdna/engine/axes";
import { describeConfiguredModelRouting } from "../../musicdna/adapters/llm-gateway";
it("flags the supplied November 18 nearest-anchor regression without confusing it with the soft production era window", () => {
  const r = proximity([1972, 1988, 1999], 2014, 2012);
  expect(r.eligible).toBe(false);
  expect(r.song_a).toMatchObject({ nearest_anchor: 1999, distance: 15 });
  expect(r.song_b).toMatchObject({ nearest_anchor: 1999, distance: 13 });
  expect(proximity([1999], null, 2002).eligible).toBe(false);
});
it("uses the existing selector/scorer deterministically for six in-memory choices with no source mutation", () => {
  const song = (n: number, score: number) => ({
    id: `s${n}`,
    title: `Song ${n}`,
    artist: `Artist ${n}`,
    year: 1990,
    primary_lane: "alternative",
    ...Object.fromEntries(DIMS.map((d) => [d, score])),
  });
  const pairs = Array.from({ length: 8 }, (_, n) => ({
    id: `p${n}`,
    song_a: song(n * 2, 90),
    song_b: song(n * 2 + 1, 10),
    active: true,
    lane: "alternative",
    tests: ["texture"],
    diagnostic_weight: 60,
    created_at: "2026-01-01",
    user_facing_tradeoff: "A specific contrast between two arrangements.",
  })) as DiagnosticPair[];
  const before = JSON.stringify(pairs),
    input = {
      seed: 42,
      years: [1990, 1991, 1992],
      lane: "alternative",
      votes: ["a", "b", "a", "b", "a", "b"] as ("a" | "b")[],
    };
  const run = simulate(pairs, input);
  expect(run).toEqual(simulate(pairs, input));
  expect(run.completed_six).toBe(true);
  expect(run.writes).toBe(0);
  expect(run.model_calls).toBe(0);
  expect(new Set(run.rounds.map((r) => r.pairing_id)).size).toBe(6);
  expect(JSON.stringify(pairs)).toBe(before);
  expect(run.reading_quality).toBeNull();
});
it("keeps unmeasured counters unavailable and exposes denominators for real measurements", () => {
  expect(qualityMetrics([])).toMatchObject({
    accepted_rate: null,
    median_call_latency_ms: null,
    estimated_cost_usd: null,
    input_tokens: { known_total: null },
  });
  const call = {
    phase: "writer",
    status: "ok",
    latency_ms: 100,
    model: "m1",
    provider: "openai",
    input_tokens: 10,
    output_tokens: null,
  };
  expect(qualityMetrics([{ status: "ok", calls: [call] }])).toMatchObject({
    first_pass_acceptance_rate: null,
    first_pass_measurement_unknown: 1,
  });
  const metrics = qualityMetrics([
    { status: "ok", calls: [call, { ...call, phase: "reviewer" }] },
    { status: "rejected", calls: [call, { ...call, status: "failed", latency_ms: 300 }] },
    { status: "ok", calls: [] },
  ]);
  expect(metrics).toMatchObject({
    attempts: 3,
    attempts_with_measured_calls: 2,
    accepted_rate: 0.5,
    first_pass_acceptance_rate: 0.5,
    failed_calls: 1,
    median_call_latency_ms: 100,
    p95_call_latency_ms: 300,
    input_tokens: { known_total: 40 },
    output_tokens: { known_total: null, missing_calls: 4 },
  });
});
it("describes the same real gateway resolver without exporting a provider credential", () => {
  const prior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "SECRET_TEST_KEY";
  try {
    const r = describeConfiguredModelRouting();
    expect(r.provider).toBe("openai");
    expect(r.critic_writer).toBeTruthy();
    expect(JSON.stringify(r)).not.toContain("SECRET_TEST_KEY");
  } finally {
    if (prior === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prior;
  }
});

it("reports real observed pacing without inventing missing historical data or double-counting split paint segments", () => {
  expect(pacingMetrics([])).toMatchObject({
    availability: "unavailable_no_display_receipts",
    average_quips_per_observed_wait: null,
    average_within_wait_display_gap_ms: null,
  });
  const base = {
    wait_id: "w1",
    line_hash: "one",
    sequence: 0,
    shown_at: "2026-11-19T00:00:00.000Z",
    since_wait_ms: 100,
  };
  const r = pacingMetrics([
    base,
    { ...base, shown_at: "2026-11-19T00:00:01.000Z" },
    { ...base, line_hash: "two", sequence: 1, shown_at: "2026-11-19T00:00:02.500Z" },
  ]);
  expect(r).toMatchObject({
    observed_segments: 3,
    unique_painted_lines: 2,
    observed_waits: 1,
    average_time_to_first_observed_quip_ms: 100,
    average_within_wait_display_gap_ms: 2500,
  });
});

it("does not silently stop a catalog analysis when the Data API cap is below the requested batch", async () => {
  const rows = Array.from({ length: 123 }, (_, n) => ({
    id: String(n).padStart(5, "0"),
    created_at: "2020-01-01",
  }));
  const db = {
    from: () => {
      let after = "";
      const q = {
        select: () => q,
        lte: () => q,
        order: () => q,
        limit: () => q,
        gt: (_: string, last: string) => {
          after = last;
          return q;
        },
        then: (resolve: (v: unknown) => unknown) => {
          const filtered = rows.filter((r) => !after || r.id > after);
          return Promise.resolve({
            data: filtered.slice(0, 17),
            count: filtered.length,
            error: null,
          }).then(resolve);
        },
      };
      return q;
    },
  };
  expect(await allRows({ db } as never, "pairings")).toEqual(rows);
});
