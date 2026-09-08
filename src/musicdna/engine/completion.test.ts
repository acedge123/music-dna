import { describe, expect, it } from "vitest";
import { sessionCompletion } from "./pairing";

const DIMS = ["movement", "atmosphere", "immersion", "scale", "community"] as const;

function vec(confidentAxes: number): Record<string, number> {
  const v: Record<string, number> = {};
  DIMS.forEach((d, i) => {
    v[d] = i < confidentAxes ? 40 : 5;
  });
  return v;
}

describe("sessionCompletion", () => {
  it("keeps going early even with a strong vector", () => {
    const r = sessionCompletion({ answered: 2, vector: vec(5), dims: DIMS });
    expect(r.done).toBe(false);
    expect(r.reason).toBeNull();
  });

  it("stops early when the read is confident", () => {
    const r = sessionCompletion({ answered: 4, vector: vec(4), dims: DIMS });
    expect(r.done).toBe(true);
    expect(r.reason).toBe("confident");
  });

  it("does not stop early on a weak vector", () => {
    const r = sessionCompletion({ answered: 5, vector: vec(1), dims: DIMS });
    expect(r.done).toBe(false);
  });

  it("hard-caps at the round budget regardless of confidence", () => {
    const r = sessionCompletion({ answered: 6, vector: vec(0), dims: DIMS });
    expect(r.done).toBe(true);
    expect(r.reason).toBe("budget");
    expect(r.max_answered).toBe(6);
  });

  it("bounds a session that mostly skips instead of hunting for confidence", () => {
    const r = sessionCompletion({ answered: 2, skipped: 3, vector: vec(0), dims: DIMS });
    expect(r.done).toBe(true);
    expect(r.reason).toBe("skip_bound");
  });

  it("skips do not end a session that is actually answering", () => {
    const r = sessionCompletion({ answered: 3, skipped: 4, vector: vec(0), dims: DIMS });
    expect(r.done).toBe(false);
  });

  it("reports confidence as the share of confident axes", () => {
    const r = sessionCompletion({ answered: 1, vector: vec(2), dims: DIMS });
    expect(r.confident_axes).toBe(2);
    expect(r.confidence).toBeCloseTo(0.4);
  });
});
