import { describe, expect, it } from "vitest";
import { rankSongs, suggestionLabel } from "./song-search";

const rows = [
  { id: "1", title: "LOVE.", artist: "Kendrick Lamar", year: 2017 },
  { id: "2", title: "Love", artist: "Lana Del Rey", year: 2017 },
  { id: "3", title: "Crazy in Love", artist: "Beyoncé", year: 2003 },
  { id: "4", title: "Ceremony", artist: "New Order", year: 1981 },
  { id: "5", title: "Love", artist: "Lana Del Rey", year: 2017 },
];

describe("opener song search", () => {
  it("shows every distinct artist version of a generic title, exact titles first", () => {
    const r = rankSongs(rows, "Love");
    expect(
      r
        .slice(0, 2)
        .map((s) => s.artist)
        .sort(),
    ).toEqual(["Kendrick Lamar", "Lana Del Rey"]);
    expect(r.map((s) => s.id)).toContain("3");
    expect(r.filter((s) => s.artist === "Lana Del Rey")).toHaveLength(1);
  });
  it("narrows by artist when typed as Title — Artist", () => {
    expect(rankSongs(rows, "Love — Lana").map((s) => s.id)).toEqual(["2"]);
  });
  it("matches by artist name", () => {
    expect(rankSongs(rows, "new order")[0]?.id).toBe("4");
  });
  it("needs at least two characters and caps at five", () => {
    expect(rankSongs(rows, "l")).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `${i}`,
      title: `Love ${i}`,
      artist: `A${i}`,
      year: null,
    }));
    expect(rankSongs(many, "love")).toHaveLength(5);
  });
  it("fills the field in the existing opener format", () => {
    const row = rows[3];
    if (!row) throw new Error("Missing fixture");
    expect(suggestionLabel(row)).toBe("Ceremony — New Order");
  });
  it("does not return unrelated titles just because title weighting exists", () => {
    expect(rankSongs(rows, "purple rain")).toEqual([]);
  });
  it("recognizes unscored identities without replacing the scored duplicate", () => {
    const combined = [
      { id: "scored", title: "Purple Rain", artist: "Prince", year: 1984 },
      { id: "recognition", title: "Purple Rain", artist: "Prince", year: 1984 },
      { id: "recognition-only", title: "When Doves Cry", artist: "Prince", year: 1984 },
    ];
    expect(rankSongs(combined, "Purple Rain").map((row) => row.id)).toEqual(["scored"]);
    expect(rankSongs(combined, "When Doves Cry").map((row) => row.id)).toEqual([
      "recognition-only",
    ]);
  });
  it("keeps the scored duplicate even when recognition has higher popularity", () => {
    expect(rankSongs([
      { id: "scored", title: "Dreams", artist: "Fleetwood Mac", year: 1977 },
      { id: "recognition", title: "Dreams", artist: "Fleetwood Mac", year: null, listen_count: 9999 },
    ], "Dreams")[0]?.id).toBe("scored");
  });
  it("does not offer Jack the Ripper for the specific title The Rip", () => {
    expect(rankSongs([{ id: "ripper", title: "Jack the Ripper", artist: "L.L. Cool J", year: 1987 }], "The Rip")).toEqual([]);
  });
  it("groups recording variants and uses popularity for artist-only ties", () => {
    expect(rankSongs([
      { id: "demo", title: "Boys Don't Cry (Demo)", artist: "The Cure", year: null, listen_count: 999 },
      { id: "original", title: "Boys Don't Cry", artist: "The Cure", year: 1979, listen_count: 5 },
      { id: "other", title: "A Forest", artist: "The Cure", year: 1980, listen_count: 10 },
    ], "The Cure").map((s) => s.id)).toEqual(["other", "original"]);
  });
});
