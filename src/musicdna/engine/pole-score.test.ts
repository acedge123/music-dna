import { expect, it } from "vitest";
import { poleScoreLabel } from "./axes";
it("shows the leaning pole's strength", () => {
  expect(poleScoreLabel("immersion", 15)).toBe("Immediacy · 85/100");
  expect(poleScoreLabel("immersion", 70)).toBe("Slow reveal · 70/100");
});
