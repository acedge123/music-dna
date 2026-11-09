import { describe, expect, it } from "vitest";
import { releaseCandidates, type Recording } from "./matching";

const song = { title: "Everlong", artist: "Foo Fighters", year: 1997 };
const recording: Recording = { id: "studio", title: "Everlong", score: 100, "artist-credit": [{ name: "Foo Fighters" }], releases: [{ id: "original", title: "The Colour and the Shape", status: "Official", date: "1997", "artist-credit": [{ name: "Foo Fighters" }], "release-group": { "primary-type": "Album" } }] };
describe("release-specific artwork candidates", () => {
  it("rejects a high-scoring live bootleg instead of accepting the first hit", () => {
    const live = { ...recording, id: "live", disambiguation: "live, 2018: Nürburg" };
    expect(releaseCandidates(song, [live, recording]).map((r) => r.recording.id)).toEqual(["studio"]);
  });
  it("rejects a different artist with the same title", () => {
    expect(releaseCandidates(song, [{ ...recording, "artist-credit": [{ name: "Cover Band" }] }])).toEqual([]);
  });
  it("rejects compilations even when the artist credit matches", () => {
    expect(releaseCandidates(song, [{ ...recording, releases: [{ ...recording.releases?.[0], id: "compilation", title: "Greatest Hits", status: "Official", "artist-credit": [{ name: "Foo Fighters" }], "release-group": { "primary-type": "Album", "secondary-types": ["Compilation"] } }] }])).toEqual([]);
  });
  it("prefers the release near the catalog year, without auto-verification", () => {
    const original = recording.releases?.[0];
    if (!original) throw new Error("Missing fixture release");
    const picks = releaseCandidates(song, [{ ...recording, releases: [{ ...original, id: "reissue", date: "2020" }, original] }]);
    expect(picks[0]?.release.id).toBe("original");
  });
});