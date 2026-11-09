import { describe, expect, it, vi } from "vitest";
import { approvedArtwork, withPairingArtwork } from "./song-artwork";

const row = { song_id: "a", image_url: "https://images.example.test/cover.jpg", release_title: "Album", release_mbid: "release", source: "cover_art_archive", attribution: "Rights holder", display_enabled: true, match_status: "verified", rights_status: "licensed", rights_reference: "Agreement 1" };
describe("shared web and Flutter artwork", () => {
  it("keeps unreviewed rights unavailable", () => { expect(approvedArtwork({ ...row, rights_status: "unreviewed" })).toBeNull(); });
  it("requires an exact verified release match", () => { expect(approvedArtwork({ ...row, match_status: "candidate" })).toBeNull(); });
  it("requires an explicit display approval", () => { expect(approvedArtwork({ ...row, display_enabled: false })).toBeNull(); });
  it("requires documented permission", () => { expect(approvedArtwork({ ...row, rights_reference: " " })).toBeNull(); });
  it("returns approved artwork without internal rights notes", () => {
    expect(approvedArtwork(row)).toEqual({ image_url: row.image_url, album_title: "Album", release_mbid: "release", source: "cover_art_archive", attribution: "Rights holder" });
  });
  it("adds nullable artwork to both songs and preserves the pairing", async () => {
    const result = { data: [row], error: null };
    const chain = { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: (resolve: (r: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
    const pairing = { id: "pair", tests: ["texture"], song_a: { id: "a", title: "A" }, song_b: { id: "b", title: "B" } };
    const enriched = await withPairingArtwork({ from: vi.fn().mockReturnValue(chain) } as never, pairing);
    expect(enriched).toEqual({ ...pairing, song_a: { ...pairing.song_a, artwork: approvedArtwork(row) }, song_b: { ...pairing.song_b, artwork: null } });
    expect(pairing.song_a).not.toHaveProperty("artwork");
  });
  it("keeps the interview available when the artwork service fails", async () => {
    const pairing = { song_a: { id: "a" }, song_b: { id: "b" } };
    expect(await withPairingArtwork({ from: () => { throw new Error("unavailable"); } } as never, pairing)).toEqual({ song_a: { id: "a", artwork: null }, song_b: { id: "b", artwork: null } });
  });
});