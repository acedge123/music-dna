import { describe, expect, it } from "vitest";
import { copiesExemplar, exemplarVoiceBlock, pickExemplars } from "./critic-exemplars";

const ex = [{ id: "a", text: "Alone in the front row, and loving every second of it." }];
describe("critic exemplars", () => {
  it("flags output that reuses five consecutive words", () => {
    expect(copiesExemplar("You stood alone in the front row, and loving it.", ex)).toBe(true);
  });
  it("allows output that only shares a few words", () => {
    expect(copiesExemplar("Front row seats, but you sat at the back.", ex)).toBe(false);
  });
  it("adds no prompt block when nothing is approved", () => {
    expect(exemplarVoiceBlock([])).toBeNull();
  });
  it("caps the rotating set at five", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: String(i), text: `line ${i}` }));
    expect(pickExemplars(many, "s1")).toHaveLength(5);
  });
});
