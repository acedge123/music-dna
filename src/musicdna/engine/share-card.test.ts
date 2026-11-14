import { describe, expect, it } from "vitest";
import { renderShareCard, wrap } from "./share-card";

describe("share card", () => {
  it("story card is 1080x1920 and square is 1080x1080", () => {
    const c = { headline: "Alone in the front row.", traits: [], url: "musicdna.fm" };
    expect(renderShareCard(c, "story")).toContain('height="1920"');
    expect(renderShareCard(c, "square")).toContain('height="1080"');
  });
  it("escapes listener-visible text", () => {
    expect(renderShareCard({ headline: "<b>x</b>", traits: [], url: "u" }, "square")).not.toContain("<b>");
  });
  it("shows at most three traits", () => {
    const svg = renderShareCard({ headline: "h", traits: ["a1", "a2", "a3", "a4"], url: "u" }, "square");
    expect(svg).not.toContain("a4");
  });
  it("truncates long headlines", () => {
    expect(wrap("word ".repeat(80), 20, 3)).toHaveLength(3);
  });
});
