import { expect, it } from "vitest";
import { poleScoreLabel } from "./axes";
it("names both poles with the score on the leaning side", () => {
  expect(poleScoreLabel("texture", 85)).toBe("Refinement 85 vs Rawness");
  expect(poleScoreLabel("immersion", 15)).toBe("Immediacy 85 vs Slow reveal");
});
