import { describe, expect, it } from "vitest";
import {
  parseSongWhyReview,
  reviewStorageFields,
  requiresIndividualReview,
} from "./song-why-review";

const dispute = {
  axis: "confidence",
  verdict: "fail",
  note: "Command is unsupported.",
  score_disputed: true,
  suggested_score: 25,
  reason: "Vocal restraint is being mistaken for defiance.",
};

describe("advisory score review", () => {
  it("retains the 25 Confidence proposal without writing a replacement catalog score", () => {
    const [review] = parseSongWhyReview({ items: [dispute] }, ["confidence"]);
    if (!review) throw new Error("Missing review");
    expect(reviewStorageFields(review)).toEqual({
      status: "pending_review",
      model_review_verdict: "fail",
      review_note: "Command is unsupported.",
      score_disputed: true,
      suggested_score: 25,
      score_dispute_reason: "Vocal restraint is being mistaken for defiance.",
    });
  });
  it("permits a disputed score with no confident numerical suggestion", () => {
    expect(
      parseSongWhyReview({ items: [{ ...dispute, suggested_score: null }] }, ["confidence"])[0]
        ?.suggested_score,
    ).toBeNull();
  });
  it("excludes failed explanations and disputed scores from bulk approval independently", () => {
    expect(requiresIndividualReview({ score_disputed: true, model_review_verdict: "pass" })).toBe(
      true,
    );
    expect(requiresIndividualReview({ score_disputed: false, model_review_verdict: "fail" })).toBe(
      true,
    );
    expect(requiresIndividualReview({ score_disputed: false, model_review_verdict: "pass" })).toBe(
      false,
    );
    expect(requiresIndividualReview({ model_review_verdict: null })).toBe(false);
  });
  it("rejects missing, duplicate and unrelated attribute reviews", () => {
    expect(() => parseSongWhyReview({ items: [] }, ["confidence"])).toThrow();
    expect(() =>
      parseSongWhyReview({ items: [dispute, dispute] }, ["confidence", "texture"]),
    ).toThrow();
    expect(() => parseSongWhyReview({ items: [dispute] }, ["texture"])).toThrow();
  });
  it("rejects out-of-range proposals and undisputed replacement scores", () => {
    for (const suggested_score of [-1, 101, 25.5])
      expect(() =>
        parseSongWhyReview({ items: [{ ...dispute, suggested_score }] }, ["confidence"]),
      ).toThrow();
    expect(() =>
      parseSongWhyReview({ items: [{ ...dispute, score_disputed: false }] }, ["confidence"]),
    ).toThrow();
  });
});
