import { describe, expect, it } from "vitest";
import { buildLedger } from "./evidence";
import {
  boundedClaim,
  deterministicNarration,
  insufficiencyReason,
  languageCeiling,
  validatedNarration,
  validatedChat,
} from "./claim-language";

const labels = { scale: { hi: "intimacy", lo: "spectacle" } };
function ledger(deltas: number[]) {
  return buildLedger(
    deltas.map((d, i) => ({
      choice_id: `c${i}`,
      pairing_id: `p${i}`,
      tests: ["scale"],
      diagnostic_weight: 100,
      chosen: { title: `Song ${i} A`, scale: d },
      rejected: { title: `Song ${i} B`, scale: 0 },
    })),
    ["scale"],
  );
}
const selection = { claims: [{ axis: "scale", direction: "hi", choice_ids: ["c0"] }] };

describe("versioned claim language ceilings", () => {
  it.each([
    [[40], "observation"],
    [[40, 40], "tentative"],
    [[40, 40, -40], "contested"],
    [[40, 40, -40, -40], "mixed"],
    [[40, 40, 40], "supported"],
    [[40, 40, 40, -40], "supported"],
    [[0], "insufficient"],
  ] as const)("%j has ceiling %s", (deltas, ceiling) => {
    expect(languageCeiling(ledger([...deltas]).axes[0])).toBe(ceiling);
  });
  it("2-2 never becomes directional through magnitude or prior scores", () => {
    const l = ledger([1000, 1000, -10, -10]);
    expect(l.axes[0].eligible).toBe(false);
    expect(boundedClaim(l.axes[0], labels)).toContain("No supported lean");
    expect(deterministicNarration(l, labels)).not.toContain("you favored");
  });
  it("3-1 always names the exception and qualification", () => {
    const l = ledger([40, 40, 40, -40]);
    const text = validatedNarration(selection, l, labels)!;
    expect(text).toContain("3 supporting choices, 1 against");
    expect(text).toContain("Song 3 A over Song 3 B");
    expect(text).toContain("qualified tendency");
  });
  it("separates sparse, conflict and invalid evidence", () => {
    expect(insufficiencyReason(ledger([40]))).toBe("sparse_evidence");
    expect(insufficiencyReason(ledger([40, 40, -40, -40]))).toBe("conflicting_evidence");
    const invalid = buildLedger([{ pairing_id: "p", chosen: null, rejected: null }], ["scale"]);
    expect(insufficiencyReason(invalid)).toBe("invalid_catalog_evidence");
    expect(deterministicNarration(invalid, labels)).toContain("choices are saved");
  });
  it.each([
    { claims: [{ axis: "unknown", direction: "hi", choice_ids: ["c0"] }] },
    { claims: [{ axis: "scale", direction: "lo", choice_ids: ["c0"] }] },
    { claims: [{ axis: "scale", direction: "hi", choice_ids: ["made-up"] }] },
    { claims: [{ axis: "scale", direction: "hi", choice_ids: ["c3"] }] },
    { claims: [{ axis: "scale", direction: "hi", choice_ids: ["c0", "c0"] }] },
    { ...selection, prose: "You are an empath." },
  ])("rejects invalid or invented claim references: %j", (raw) => {
    expect(validatedNarration(raw, ledger([40, 40, 40, -40]), labels)).toBeNull();
  });
  it("rejects an otherwise valid reference to a mixed claim", () => {
    expect(validatedNarration(selection, ledger([40, 40, -40, -40]), labels)).toBeNull();
  });
  it("chat quotes self-report without adding support or inventing prose", () => {
    const l = ledger([40, 40, 40, -40]);
    const original = structuredClone(l);
    const raw = { ...selection, question_id: "exception", acknowledge_self_report: true };
    const text = validatedChat(raw, l, labels, "I prefer the lyrics.")!;
    expect(text).toContain('You said: "I prefer the lyrics."');
    expect(text).toContain("qualified tendency");
    expect(l).toEqual(original);
    expect(
      validatedChat({ ...raw, text: "Invented listener trait" }, l, labels, "hello"),
    ).toBeNull();
    expect(validatedChat(raw, ledger([40, 40, 40]), labels, "hello")).toBeNull();
  });
  it("suppresses repeated supported narration in chat", () => {
    const l = ledger([40, 40, 40]);
    const previous = deterministicNarration(l, labels);
    const text = validatedChat(
      { ...selection, question_id: "correction", acknowledge_self_report: false },
      l,
      labels,
      "hello",
      previous,
    );
    expect(text).toBe("What would you change about that reading?");
  });
});
