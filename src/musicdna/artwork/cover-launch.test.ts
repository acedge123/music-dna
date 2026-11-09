import { describe, expect, it } from "vitest";
import launch from "../../../data/musicdna/artwork/cover-launch-2026-11-09.json";
import candidates from "../../../data/musicdna/artwork/catalog-match-2026-11-09.json";

describe("album artwork launch approvals", () => {
  it("enables only checked candidates with documented owner permission and hosted images", () => {
    const originals = new Map(candidates.rows.map((row) => [row.song_id, row]));
    const enabled = launch.rows.filter((row) => row.display_enabled);
    expect(enabled).toHaveLength(333);
    for (const row of enabled) {
      expect(originals.get(row.song_id)?.release_mbid).toBe(row.release_mbid);
      expect(row.match_status).toBe("verified");
      expect(row.rights_status).toBe("permission_granted");
      expect(row.rights_reference).toContain("Alan Edgett 2026-11-09");
      expect(row.review_reason).toBe("");
      expect("image_url" in row && String(row.image_url).startsWith("https://")).toBe(true);
    }
  });
  it("keeps suspicious editions disabled rather than promoting all 356 candidates", () => {
    const held = launch.rows.filter((row) => !row.display_enabled);
    expect(held).toHaveLength(23);
    expect(held.find((row) => row.title === "No Diggity")?.display_enabled).toBe(false);
    expect(held.find((row) => row.title === "Heaven Knows I'm Miserable Now")?.display_enabled).toBe(false);
    expect(launch.summary.fallback_count).toBe(161);
  });
});