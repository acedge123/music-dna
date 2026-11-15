import { describe, expect, it } from "vitest";
import { canPromoteIntake, intakeDraftSchema } from "./song-intake";
const draft = { title: "True", artist: "Spandau Ballet", year: 1983, lane: "pop", identity_confident: true, rationale: "A controlled vocal floats above a polished, spacious arrangement.", scores: { movement: 30, atmosphere: 70, immersion: 60, scale: 45, community: 30, perspective: 20, confidence: 50, tension: 20, texture: 85, transformation: 35 } };
describe("intake score review", () => {
  it("requires all ten dimensions", () => { const { texture: _texture, ...scores } = draft.scores; expect(intakeDraftSchema.safeParse({ ...draft, scores }).success).toBe(false); });
  it("rejects scores outside 0–100", () => { expect(intakeDraftSchema.safeParse({ ...draft, scores: { ...draft.scores, tension: 101 } }).success).toBe(false); });
  it("requires integer scores", () => { expect(intakeDraftSchema.safeParse({ ...draft, scores: { ...draft.scores, movement: 30.5 } }).success).toBe(false); });
  it("never promotes uncertain identity", () => { expect(canPromoteIntake(intakeDraftSchema.parse({ ...draft, identity_confident: false }))).toBe(false); });
  it("never promotes an unknown year", () => { expect(canPromoteIntake(intakeDraftSchema.parse({ ...draft, year: null }))).toBe(false); });
  it("accepts a complete reviewed proposal", () => { expect(canPromoteIntake(intakeDraftSchema.parse(draft))).toBe(true); });
});