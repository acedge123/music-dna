import { describe, expect, it } from "vitest";
import { advanceQuip } from "./quip-clock";

describe("quip dwell clock", () => {
  it("holds each line for 2500ms", () => {
    const clock = { index: 0, shownAt: 1000 };
    expect(advanceQuip(clock, 0, 3499, 4)).toBe(clock);
    expect(advanceQuip(clock, 0, 3500, 4)).toEqual({ index: 1, shownAt: 3500 });
  });
  it("ignores a duplicate callback from the previous line", () => {
    const clock = advanceQuip({ index: 0, shownAt: 0 }, 0, 2500, 4);
    expect(advanceQuip(clock, 0, 2501, 4)).toBe(clock);
  });
  it("never catches up by rapidly showing multiple lines after a delayed timer", () => {
    const clock = advanceQuip({ index: 0, shownAt: 0 }, 0, 12000, 4);
    expect(clock).toEqual({ index: 1, shownAt: 12000 });
    expect(advanceQuip(clock, 1, 12001, 4)).toBe(clock);
    expect(advanceQuip(clock, 1, 14500, 4).index).toBe(2);
  });
  it("holds the last line until new content is available", () => {
    const clock = { index: 3, shownAt: 7500 };
    expect(advanceQuip(clock, 3, 10000, 4)).toBe(clock);
  });
});
