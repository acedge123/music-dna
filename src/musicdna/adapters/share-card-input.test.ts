import { describe, expect, it } from "vitest";
import { cardInputFromPublished } from "./share-card-input";
describe("share card input", () => {
  it("uses the frozen first sentence and frozen archetype", () => {
    const c = cardInputFromPublished({ session: { content: { synthesis: "Alone in the front row. More text.", archetype_v2: { name: "The Witness", status: "confirmed" } } }, definingChoices: [] }, "musicdna.fm");
    expect(c.headline).toBe("Alone in the front row.");
    expect(c.archetype).toBe("The Witness");
  });
});
