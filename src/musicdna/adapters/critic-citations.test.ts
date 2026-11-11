import { describe, expect, it } from "vitest";
import { normalizeCriticBeat } from "./critic-editorial";

describe("reveal citation repair", () => {
  it("drops duplicate citations without touching prose", () => {
    const out = normalizeCriticBeat({
      headline: "Solitary doesn't mean small.",
      body: "",
      choice_ids: ["a", "a", "b"],
      claims: [{ axis: "x", direction: "hi", choice_ids: ["a", "b", "c", "d", "d"] }],
    }) as { headline: string; choice_ids: string[]; claims: { choice_ids: string[] }[] };
    expect(out.headline).toBe("Solitary doesn't mean small.");
    expect(out.choice_ids).toEqual(["a", "b"]);
    expect(out.claims[0].choice_ids).toEqual(["a", "b", "c", "d"]);
  });
});
