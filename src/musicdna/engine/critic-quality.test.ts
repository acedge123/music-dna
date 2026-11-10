import { describe, it, expect } from "vitest";
import { QualityScores, SessionVerdict, exposureReport, keptTalkingRate } from "./critic-quality";
describe("independent critic measurements", () => {
  const scores = {
    inference_accuracy: 1,
    musical_specificity: 2,
    prose_originality: 4,
    conversational_relevance: 5,
    entertainment: 3,
  };
  it("requires the entertainment score to be 1-5", () => {
    expect(QualityScores.safeParse({ ...scores, entertainment: 6 }).success).toBe(false);
    expect(QualityScores.safeParse({ ...scores, entertainment: 0 }).success).toBe(false);
    expect(QualityScores.parse({ ...scores, entertainment: 5 }).entertainment).toBe(5);
  });
  it("limits keep-talking verdicts to yes/maybe/no", () => {
    expect(SessionVerdict.safeParse({ keep_talking: "yes", reason: null }).success).toBe(true);
    expect(SessionVerdict.safeParse({ keep_talking: "sure", reason: null }).success).toBe(false);
  });
  it("counts sessions that chatted after the reveal", () => {
    const r = keptTalkingRate([
      { session_id: "a", user_turns: 0 },
      { session_id: "b", user_turns: 2 },
      { session_id: "c", user_turns: 4 },
      { session_id: "d", user_turns: 0 },
    ]);
    expect(r.rate).toBe(0.5);
    expect(r.avg_turns_when_talking).toBe(3);
  });
  it("keeps all five 1–5 scores separate", () =>
    expect(QualityScores.parse(scores)).toEqual(scores));
  it.each([0, 6, 1.5])("rejects score %s", (score) =>
    expect(QualityScores.safeParse({ ...scores, inference_accuracy: score }).success).toBe(false),
  );
  it("keeps unassessed dimensions null", () =>
    expect(
      QualityScores.parse({ ...scores, prose_originality: null }).prose_originality,
    ).toBeNull());
  it("separates offered and chosen denominators and deduplicates retries", () => {
    const a = { id: "a", artist: "A", year: 1990 },
      b = { id: "b", artist: "B", year: null };
    const offer = { id: "o", pairing_id: "p", songs: [a, b], shown: false };
    const d = { id: "c", pairing_id: "p", chosen: a, rejected: b };
    const r = exposureReport([offer, offer], [d, d]);
    expect(r.served).toBe(1);
    expect(r.client_reported_shown).toBe(0);
    expect(r.missing_display_reports).toBe(1);
    expect(r.answered_offered_songs.total).toBe(2);
    expect(r.chosen_songs.total).toBe(1);
    expect(r.answered_offered_songs.unknown_era).toBe(1);
  });
  it("does not call repeated opponents independent retests", () => {
    const a = { id: "a", artist: "A", year: 2001 },
      b = { id: "b", artist: "B", year: 2002 };
    const r = exposureReport(
      [],
      [
        { id: "1", pairing_id: "p1", chosen: a, rejected: b },
        { id: "2", pairing_id: "p2", chosen: a, rejected: b },
      ],
      3,
    );
    expect(r.repeated_opponents).toEqual([{ song_id: "b", count: 2 }]);
    expect(r.independent_retests).toBeNull();
    expect(r.unavailable_choices).toBe(3);
  });
});
