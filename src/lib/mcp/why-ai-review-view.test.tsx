import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { WhyAiReview } from "./why-ai-review";
vi.mock("./admin.functions", () => ({ listSavedWhyAiReviews: vi.fn() }));
import { WhyAiReviewCard } from "../../components/musicdna/song-why-ai-reviews";
it("shows original text/score, historical verdict and separate advisory nullable result together", () => {
  const r = {
    id: "request",
    explanation_id: "why",
    state: "completed",
    configured_routing: null,
    measurement: null,
    error_code: null,
    completed_at: null,
    snapshot: {
      version: "original-version",
      stale_explanation: false,
      explanation: {
        id: "why",
        song_id: "song",
        scoring_version: "score-v1",
        axis: "confidence",
        score_at_write: 95,
        audible_evidence: "Original evidence",
        interpretation: "Original means",
        review_note: "Historical reviewer note",
        status: "approved",
      },
      song: { id: "song", title: "Example", artist: "Artist", year: 1991, genre: "alternative" },
      attribute: {
        key: "confidence",
        score_at_write: 95,
        current_score: 95,
        definition: "Command versus vulnerability",
        low_pole: "vulnerability",
        high_pole: "command",
      },
      recording_identity: { verification: "Edition unavailable" },
    },
    explanation_version: "original-version",
    context_version: "context-version",
    policy_version: "new-review-policy",
    created_at: "2026-11-19T05:00:00Z",
    stale_explanation: false,
    stale_result: true,
    display_state: "completed",
    result: {
      axis: "confidence",
      verdict: "fail",
      note: "Restraint is not command",
      score_disputed: true,
      suggested_score: null,
      reason: "Uncertain without listening",
    },
  } as WhyAiReview;
  const html = renderToStaticMarkup(<WhyAiReviewCard review={r} />);
  for (const text of [
    "Original evidence",
    "Original means",
    "Historical reviewer note",
    "95/100",
    "Restraint is not command",
    "unavailable / no justified replacement",
    "Uncertain without listening",
    "Stale result",
    "original-version",
    "not the original approval",
  ]) {
    expect(html).toContain(text);
  }
  expect(html).not.toContain("Suggested score: 0");
});
