import { describe, expect, it } from "vitest";
import { matchOpeningSong, openingAcknowledgement, parseOpeningSong } from "./opening-song";

const songs = [
  { title: "Home", artist: "Artist A", year: 1982 },
  { title: "Home", artist: "Artist B", year: 2010 },
];
describe("opening song identity", () => {
  it("does not attach another artist's facts to an ambiguous or mistyped input", () => {
    expect(matchOpeningSong(songs, parseOpeningSong("Home"))).toBeNull();
    expect(matchOpeningSong(songs, parseOpeningSong("Home — Artist C"))).toBeNull();
    expect(matchOpeningSong(songs, parseOpeningSong("home — artist b"))).toEqual(songs[1]);
  });
  it("keeps hyphens inside titles and asks for no invented year or scene", () => {
    expect(parseOpeningSong("X-Ray — Artist A")).toEqual({ title: "X-Ray", artist: "Artist A" });
    expect(parseOpeningSong("Home — Artist A - Live")).toEqual({
      title: "Home",
      artist: "Artist A - Live",
    });
    expect(openingAcknowledgement("Home", 0, null)).toBe("Added “Home” as your #1.");
    expect(openingAcknowledgement("Home — Artist B", 1, songs[1])).toBe(
      "Added Home by Artist B as your #2.",
    );
  });
});
