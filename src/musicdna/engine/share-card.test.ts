import { describe, expect, it } from "vitest";
import { layoutShareCard, renderShareCard, wrap } from "./share-card";

describe("share card", () => {
  it("story card is 1080x1920 and square is 1080x1080", () => {
    const c = { headline: "Alone in the front row.", traits: [], url: "musicdna.fm" };
    expect(renderShareCard(c, "story")).toContain('height="1920"');
    expect(renderShareCard(c, "square")).toContain('height="1080"');
  });
  it("escapes listener-visible text", () => {
    expect(renderShareCard({ headline: "<b>x</b>", traits: [], url: "u" }, "square")).not.toContain(
      "<b>",
    );
  });
  it("shows at most three traits", () => {
    const svg = renderShareCard(
      { headline: "h", traits: ["a1", "a2", "a3", "a4"], url: "u" },
      "square",
    );
    expect(svg).not.toContain("a4");
  });
  it("truncates long headlines", () => {
    expect(wrap("word ".repeat(80), 20, 3)).toHaveLength(3);
  });
});

describe("bounded card layout", () => {
  it.each(["square", "story"] as const)(
    "reserves the footer and wraps every content field in %s",
    async (format) => {
      const { layoutShareCard } = await import("./share-card");
      const input = {
        headline:
          "Wide words and long headlines are still frozen, including the interesting complication at the end. ".repeat(
            8,
          ),
        archetype: "A very long archetype name ".repeat(12),
        traits: [
          "W".repeat(200),
          "Very long song title over another long song title ".repeat(10),
          "日本語の曲名と絵文字🎸".repeat(20),
        ],
        url: "musicdna.fm",
      };
      const before = JSON.stringify(input);
      const lines = layoutShareCard(input, format);
      const footer = lines.find((l) => l.role === "footer")!;
      for (const line of lines) {
        expect(line.text).not.toBe("");
        expect(line.x + line.width).toBeLessThanOrEqual(990);
        expect(line.y - line.size).toBeGreaterThanOrEqual(0);
        if (!["footer", "url"].includes(line.role))
          expect(line.y + line.size * 0.2).toBeLessThan(footer.y - footer.size);
      }
      expect(lines.filter((l) => l.role === "evidence").length).toBeLessThanOrEqual(6);
      expect(lines.some((l) => l.text.endsWith("…"))).toBe(true);
      expect(JSON.stringify(input)).toBe(before);
    },
  );
  it("never emits empty lines for an unbroken title or loses Unicode surrogate pairs", () => {
    const lines = wrap("🎸".repeat(100), 10, 2);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.length > 0)).toBe(true);
    expect(lines.join("")).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(lines[1].endsWith("…")).toBe(true);
  });
});

describe("optional content bounds", () => {
  it.each(["square", "story"] as const)(
    "keeps %s bounded without an archetype or choices",
    (format) => {
      for (const traits of [
        [],
        ["Long chosen song over an equally long rejected song ".repeat(12)],
      ]) {
        const lines = layoutShareCard(
          { headline: "W".repeat(500), archetype: null, traits, url: "musicdna.fm/".repeat(40) },
          format,
        );
        const footer = lines.find((line) => line.role === "footer")!;
        expect(lines.some((line) => line.role === "archetype")).toBe(false);
        for (const line of lines) {
          expect(line.width).toBeLessThanOrEqual(900);
          if (!["footer", "url"].includes(line.role))
            expect(line.y + line.size * 0.2).toBeLessThan(footer.y - footer.size);
        }
      }
    },
  );
});
