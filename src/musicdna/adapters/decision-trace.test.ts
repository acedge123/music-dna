import { describe, expect, it } from "vitest";
import { classifyTrace } from "./critic-quality";

describe("decision trace cause", () => {
  it("labels an AI call failure", () => {
    expect(
      classifyTrace({
        status: "narrator_failure",
        rejection_reason: "generation_or_review_failed",
      }),
    ).toBe("ai_call_failed");
  });
  it("labels a reviewer rejection", () => {
    expect(
      classifyTrace({
        status: "invalid_generation",
        rejection_reason: "semantic_review_rejected",
        facts_summary: { entries: 6 },
      }),
    ).toBe("rejected");
  });
  it("labels missing evidence when the critic got no picks", () => {
    expect(
      classifyTrace({
        status: "invalid_generation",
        rejection_reason: "invalid_references_or_schema",
        facts_summary: { entries: 0 },
      }),
    ).toBe("missing_evidence");
  });
  it("labels accepted replies", () => {
    expect(classifyTrace({ status: "ok", rejection_reason: "accepted" })).toBe("accepted");
  });
});
