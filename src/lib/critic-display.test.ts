import { describe, expect, it } from "vitest";
import { criticDisplayLine, readingLead } from "./critic-display";

describe("bounded presentation", () => {
  it("does not promote a contested claim when removing numeric bookkeeping", () => {
    const source =
      "The evidence for tension is contested (2 supporting, 1 against); no supported claim yet.";
    expect(criticDisplayLine(source)).toBe(
      "The evidence for tension is contested; no supported claim yet.",
    );
  });
  it("keeps explicit uncertainty and qualifications in a supported sentence", () => {
    expect(
      criticDisplayLine("A qualified tendency (3 supporting choices, 1 against), not a rule."),
    ).toBe("A qualified tendency, not a rule.");
  });
  it("extracts a lead without changing the frozen content or inventing a claim", () => {
    const saved =
      "These choices pull in different directions. There isn't a supported reading yet.";
    expect(readingLead(saved)).toBe("These choices pull in different directions.");
    expect(saved).toBe(
      "These choices pull in different directions. There isn't a supported reading yet.",
    );
    expect(readingLead("")).toBe("");
  });
});
