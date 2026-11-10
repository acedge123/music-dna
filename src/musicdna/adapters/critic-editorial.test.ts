import { describe, expect, it, vi } from "vitest";
import { buildLedger } from "../engine/evidence";
import {
  authorCritic,
  validateCriticBeat,
  contextualChatFallback,
  criticFacts,
} from "./critic-editorial";

const labels = { scale: { hi: "intimacy", lo: "spectacle" } };
const ledger = (deltas: number[]) =>
  buildLedger(
    deltas.map((scale, i) => ({
      choice_id: `c${i}`,
      pairing_id: `p${i}`,
      tests: ["scale"],
      chosen: { title: `A${i}`, scale },
      rejected: { title: `B${i}`, scale: 0 },
    })),
    ["scale"],
  );
const beat = {
  headline: "The small room wins this round.",
  body: "A tendency here, not a biography.",
  choice_ids: ["c0"],
  claims: [{ axis: "scale", direction: "hi", choice_ids: ["c0"] }],
};
const review = {
  grounded: true,
  ceiling_preserved: true,
  exceptions_preserved: true,
  self_report_separate: true,
  no_invented_facts: true,
  no_future_test_disclosure: true,
  responsive: true,
};

describe("critic-expression-v2 boundary", () => {
  it("supplies only the answered saying with its valid tested direction to author and reviewer", async () => {
    const l = buildLedger(
      [
        {
          choice_id: "c0",
          pairing_id: "p0",
          pairing_saying: "Studio chrome, or open water?",
          tests: ["scale", "tension"],
          chosen: { title: "A", scale: 10, tension: 55 },
          rejected: { title: "B", scale: 90, tension: 50 },
        },
      ],
      ["scale", "tension"],
    );
    const facts = criticFacts(l, labels);
    expect(facts.choices[0].post_choice_saying).toBe("Studio chrome, or open water?");
    expect(facts.choices[0].tested_tradeoffs).toEqual([
      {
        axis: "scale",
        chosen_direction: "lo",
        chosen_pole: "spectacle",
        rejected_pole: "intimacy",
      },
    ]);
    const generate = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          headline: "Bigger wins this round.",
          body: "One choice, not a verdict.",
          choice_ids: ["c0"],
          claims: [],
        }),
      )
      .mockResolvedValueOnce(JSON.stringify(review));
    expect((await authorCritic(l, labels, generate, { stage: "read" })).status).toBe("ok");
    for (const call of generate.mock.calls) {
      const supplied = JSON.parse(String(call[0]).split("FACTS: ")[1].split("\nCONTEXT:")[0]);
      expect(supplied.choices[0]).toEqual(facts.choices[0]);
      expect(supplied.choices).toHaveLength(1);
    }
  });
  it("accepts fenced structured output while keeping all validation", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(`\`\`\`json\n${JSON.stringify(beat)}\n\`\`\``)
      .mockResolvedValueOnce(JSON.stringify(review));
    expect(
      (await authorCritic(ledger([40, 40, 40]), labels, generate, { stage: "read" })).status,
    ).toBe("ok");
  });
  it("rejects internal UUIDs in displayed prose", () => {
    expect(
      validateCriticBeat(
        { ...beat, body: "Song (781015b1-dbec-4c2b-b10e-9be06cfea57f)." },
        ledger([40, 40, 40]),
        labels,
      ),
    ).toBeNull();
  });
  it("accepts reviewed authored wording and keeps the full 3–1 audit exception", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(beat))
      .mockResolvedValueOnce(JSON.stringify(review));
    const result = await authorCritic(ledger([40, 40, 40, -40]), labels, generate, {
      stage: "reveal",
    });
    expect(result.status).toBe("ok");
    expect(result.audit_text).toContain("A3 over B3");
    expect(result.audit_text).toContain("3 supporting choices, 1 against");
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it.each([{ deltas: [40] }, { deltas: [40, 40] }, { deltas: [40, -40, 40, -40] }])(
    "cannot cite a supported tendency below D01: %j",
    ({ deltas }) => {
      expect(validateCriticBeat(beat, ledger(deltas), labels)).toBeNull();
    },
  );
  it.each([
    { ...beat, choice_ids: ["invented"] },
    { ...beat, claims: [{ axis: "scale", direction: "lo", choice_ids: ["c0"] }] },
    { ...beat, claims: [{ axis: "scale", direction: "hi", choice_ids: ["c3"] }] },
    { ...beat, choice_ids: ["c0", "c0"] },
  ])("rejects invented or contradictory references", (candidate) => {
    expect(validateCriticBeat(candidate, ledger([40, 40, 40, -40]), labels)).toBeNull();
  });
  it.each(Object.keys(review))("fails closed when semantic reviewer rejects %s", async (key) => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(beat))
      .mockResolvedValueOnce(JSON.stringify({ ...review, [key]: false }))
      .mockResolvedValueOnce(JSON.stringify(beat))
      .mockResolvedValueOnce(JSON.stringify({ ...review, [key]: false }));
    const result = await authorCritic(ledger([40, 40, 40, -40]), labels, generate, {
      stage: "reveal",
    });
    expect(result.status).toBe("invalid_generation");
    expect(result.review_checks?.[key]).toBe(false);
    expect(result.text).toContain("A3 over B3");
  });
  it("keeps reviewer outage distinct from evidence insufficiency", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(beat))
      .mockRejectedValueOnce(Error("outage"));
    expect(
      (await authorCritic(ledger([40, 40, 40]), labels, generate, { stage: "read" })).status,
    ).toBe("narrator_failure");
  });
  it("never invents an insufficient revelation or calls a model without verified evidence", async () => {
    const generate = vi.fn();
    expect((await authorCritic(ledger([]), labels, generate, { stage: "reveal" })).status).toBe(
      "insufficient",
    );
    expect(generate).not.toHaveBeenCalled();
  });
  it("acknowledges a vocal correction without turning self-report into votes", async () => {
    const l = ledger([40, 40, 40]);
    const original = structuredClone(l);
    const candidate = {
      headline: "Karen O's voice, not danger—fair point.",
      body: "A pick can't settle motive. What in the vocal made the difference?",
      choice_ids: [],
      claims: [],
    };
    const generate = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(candidate))
      .mockResolvedValueOnce(JSON.stringify(review));
    expect(
      (
        await authorCritic(l, labels, generate, {
          stage: "chat",
          selfReport: "Karen O's vulnerable vocal",
        })
      ).status,
    ).toBe("ok");
    expect(l).toEqual(original);
    expect(contextualChatFallback(l, "Karen O's vulnerable vocal", labels)).not.toContain(
      "Karen O's vulnerable vocal",
    );
    expect(contextualChatFallback(l, "question", labels)).toContain("A2 over B2");
  });
  it("rejects a full question echo even if the reviewer would accept it", async () => {
    const question = "Why did I choose Star Guitar over Hyperballad?";
    const generate = vi.fn().mockResolvedValueOnce(
      JSON.stringify({
        headline: question,
        body: "What made the difference?",
        choice_ids: [],
        claims: [],
      }),
    );
    const result = await authorCritic(ledger([40]), labels, generate, {
      stage: "chat",
      selfReport: question,
      fallback: contextualChatFallback(ledger([40]), question, labels),
    });
    expect(result.validation_reason).toBe("prompt_echo");
    expect(result.text).not.toContain(question);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
