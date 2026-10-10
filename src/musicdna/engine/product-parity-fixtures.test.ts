import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildLedger, detectRevision } from "./evidence";
import { sessionCompletion } from "./pairing";
import { experienceVersion, nextV0, nextV1 } from "../../routes/api/v1/-experience";

const choice = z.object({
  pairing_id: z.string().uuid(),
  tests: z.array(z.string()),
  diagnostic_weight: z.number(),
  chosen: z.record(z.string(), z.unknown()),
  rejected: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
  catalog_revision: z.string(),
});
const lead = z.object({
  axis: z.string(),
  direction: z.enum(["hi", "lo"]),
  status: z.string(),
  eligible: z.boolean(),
  supporting: z.number(),
  contradicting: z.number(),
});
const next = z.object({
  contract: z.literal(1),
  pairing: z.unknown(),
  prompt: z.string().nullable(),
  progress: z.object({ answered: z.number(), max_answered: z.literal(6) }),
  completion: z.object({ done: z.boolean(), reason: z.string().nullable() }),
});
const suite = z
  .object({
    version: z.literal("musicdna-product-parity-fixtures-v1"),
    catalog_revision: z.string(),
    policy_version: z.literal("d01-v1"),
    dims: z.array(z.string()),
    sessions: z.record(
      z.string(),
      z.object({
        choices: z.array(choice),
        vector: z.record(z.string(), z.number()),
        skipped: z.number(),
        consecutive_skips: z.number(),
      }),
    ),
    expected: z.record(z.string(), z.object({ answered: z.number(), lead: lead.nullable() })),
    responses: z.record(z.string(), z.object({ next })),
    cases: z.array(
      z.object({
        id: z.string(),
        session: z.string(),
        cached_response: z.string(),
        requirements: z.array(z.string()),
        tickets: z.array(z.string()),
        acceptance: z.object({ status: z.literal("pending"), procedure: z.string() }),
      }),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync(resolve(process.cwd(), "fixtures/musicdna/product-parity-v1.json"), "utf8"),
    ),
  );

describe("TGA-302 synthetic product parity fixtures", () => {
  it("contains F01-F26 with explicit, unaccepted integration procedures", () => {
    expect(suite.cases.map((c) => c.id)).toEqual(
      Array.from({ length: 26 }, (_, i) => `F${String(i + 1).padStart(2, "0")}`),
    );
    for (const c of suite.cases) {
      expect(suite.sessions[c.session]).toBeDefined();
      expect(suite.responses[c.cached_response]).toBeDefined();
      expect(c.acceptance.procedure.length).toBeGreaterThan(30);
      expect(c.tickets.every((id) => /^TGA-\d+$/.test(id))).toBe(true);
    }
  });

  for (const [id, session] of Object.entries(suite.sessions)) {
    it(`${id}: frozen choices produce the expected ledger, not cached prose`, () => {
      const ledger = buildLedger(session.choices, suite.dims);
      const axis = ledger.axes[0];
      expect(ledger.answered).toBe(suite.expected[id].answered);
      expect(
        axis
          ? {
              axis: axis.axis,
              direction: axis.direction,
              status: axis.status,
              eligible: axis.eligible,
              supporting: axis.supporting,
              contradicting: axis.contradicting,
            }
          : null,
      ).toEqual(suite.expected[id].lead);
      for (const summary of ledger.axes) {
        expect(
          summary.supporting_examples.every((e) =>
            summary.direction === "hi" ? e.delta >= 10 : e.delta <= -10,
          ),
        ).toBe(true);
        expect(
          summary.contradicting_examples.every((e) =>
            summary.direction === "hi" ? e.delta <= -10 : e.delta >= 10,
          ),
        ).toBe(true);
      }
      expect(session.choices.every((c) => c.catalog_revision === suite.catalog_revision)).toBe(
        true,
      );
    });

    it(`${id}: completion and v1 next projection match the shared response`, () => {
      const answered = suite.expected[id].answered;
      const stop = sessionCompletion({ ...session, answered, dims: suite.dims });
      const response = suite.responses[id].next;
      expect({ done: stop.done, reason: stop.reason }).toEqual(response.completion);
      expect(
        nextV1({
          done: stop.done,
          confidence: stop.confidence,
          round: answered,
          answered,
          max_rounds: stop.max_answered,
          stop_reason: stop.reason,
          pairing: response.pairing,
          prompt: response.prompt ?? undefined,
        }),
      ).toEqual(response);
    });
  }

  it("F02 identifies the last contradicting decision", () => {
    const ledger = buildLedger(suite.sessions.reversal.choices, suite.dims);
    const revision = detectRevision({ axis: "scale", direction: "hi", tier: "theory" }, ledger);
    expect(revision.revised).toBe(true);
    expect(revision.changed_by?.pairing_id).toBe(suite.sessions.reversal.choices[2].pairing_id);
  });

  it("F03 reproduces the historical 0.65 false claim, then rejects it under D01", () => {
    const deltas = suite.sessions.balanced.choices.map(
      (c) => Number(c.chosen.scale) - Number(c.rejected.scale),
    );
    expect(deltas).toEqual([40, -40, 40, -40]);
    const support = deltas.filter((d) => d > 5).length;
    const magnitude = deltas.reduce((sum, d) => sum + Math.abs(d), 0);
    // Frozen former gate, only to demonstrate the original regression.
    const formerConfidence =
      (support / deltas.length) * 0.7 + Math.min(1, magnitude / (deltas.length * 30)) * 0.3;
    expect(formerConfidence).toBeCloseTo(0.65);
    expect(support >= 2 && formerConfidence >= 0.55).toBe(true);
    expect(buildLedger(suite.sessions.balanced.choices, suite.dims).axes[0].eligible).toBe(false);
  });

  it("F12 resets the late skip bound when a new answer interrupts the streak", () => {
    const s = suite.sessions.late_skips;
    expect(sessionCompletion({ ...s, answered: 3, dims: suite.dims }).reason).toBe("skip_bound");
    expect(
      sessionCompletion({ ...s, answered: 4, consecutive_skips: 1, dims: suite.dims }).done,
    ).toBe(false);
  });

  it("F24 rejects the incomplete target response in the fixture schema", () => {
    const raw = JSON.parse(
      readFileSync(resolve(process.cwd(), "fixtures/musicdna/product-parity-v1.json"), "utf8"),
    );
    expect(
      next.safeParse(raw.cases.find((c: { id: string }) => c.id === "F24").malformed_response)
        .success,
    ).toBe(false);
  });

  it("F23 preserves legacy next projection and exact header opt-in", () => {
    expect(experienceVersion(new Request("https://fixture.invalid"))).toBe(0);
    expect(
      experienceVersion(
        new Request("https://fixture.invalid", { headers: { "X-MusicDNA-Experience": "1" } }),
      ),
    ).toBe(1);
    expect(
      nextV0({ done: true, round: 6, confidence: 0, pairing: null, answered: 6, max_rounds: 6 }),
    ).toEqual({ done: true, round: 6, confidence: 0, pairing: null });
  });
});

describe("requirement and gap traceability", () => {
  const trace = z
    .object({
      requirements: z.array(
        z.object({
          id: z.string(),
          tickets: z.array(z.string()).nonempty(),
          fixtures: z.array(z.string()),
          acceptance: z.object({ status: z.literal("pending"), procedure: z.string() }),
        }),
      ),
      gaps: z.array(z.object({ id: z.string(), tickets: z.array(z.string()).nonempty() })),
    })
    .parse(
      JSON.parse(
        readFileSync(resolve(process.cwd(), "fixtures/musicdna/requirement-trace-v1.json"), "utf8"),
      ),
    );

  it("maps every PRD v1.1 requirement, including ARC06, exactly once", () => {
    const prd = readFileSync(
      resolve(process.cwd(), "docs/musicdna/product-requirements.md"),
      "utf8",
    );
    const ids = [...prd.matchAll(/\*\*([A-Z]+\d{2}) P\d /g)].map((m) => m[1]);
    expect(trace.requirements.map((r) => r.id).sort()).toEqual(ids.sort());
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of trace.requirements) {
      expect(r.acceptance.procedure).toContain(r.id);
      expect(r.fixtures.every((id) => suite.cases.some((c) => c.id === id))).toBe(true);
    }
    for (const c of suite.cases) expect(c.requirements.every((id) => ids.includes(id))).toBe(true);
  });

  it("maps all sixteen gaps without equating helper tests with acceptance", () => {
    expect(trace.gaps.map((g) => g.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `GAP${String(i + 1).padStart(2, "0")}`),
    );
  });
});
