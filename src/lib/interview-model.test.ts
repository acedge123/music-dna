import { describe, expect, it } from "vitest";
import { answeredChoiceNumber } from "./interview-model";

describe("answered choice numbering", () => {
  it("counts three answered picks despite skipped served rounds between them", () => {
    const entries = [
      { round: 1, pairing: { id: "first" } },
      { round: 3, pairing: { id: "second" } },
      { round: 5, pairing: { id: "third" } },
    ];
    expect(answeredChoiceNumber(entries, "first")).toBe(1);
    expect(answeredChoiceNumber(entries, "second")).toBe(2);
    expect(answeredChoiceNumber(entries, "third")).toBe(3);
    expect(answeredChoiceNumber(entries, "skipped")).toBe(0);
  });
});