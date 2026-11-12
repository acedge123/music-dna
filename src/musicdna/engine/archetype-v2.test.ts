import { describe, expect, it } from "vitest";
import { buildLedger, type LedgerChoice } from "./evidence";
import { DIMS } from "./axes";
import { matchArchetypeV2, type ArchetypeProfileV2 } from "./archetype-v2";

const pick = (i: number, t: number[], c: number[], lane: string): LedgerChoice => ({
  pairing_id: `p${i}`,
  tests: ["texture", "confidence"],
  chosen: { id: `c${i}`, title: "a", artist: `a${i}`, texture: t[0], confidence: c[0], lane },
  rejected: { id: `r${i}`, title: "b", artist: `b${i}`, texture: t[1], confidence: c[1], lane },
});
const profiles: ArchetypeProfileV2[] = [
  { archetype_id: "1", name: "The Architect", core: { texture: 1, confidence: 0.7 } },
  { archetype_id: "2", name: "The Romantic", core: { confidence: -1, scale: -0.6 } },
  { archetype_id: "3", name: "The Seeker", core: { texture: 1, confidence: 0.7 }, thematic_note: "lyrics" },
];

describe("matchArchetypeV2", () => {
  const strong = [1, 2, 3, 4].map((i) => pick(i, [80, 20], [80, 20], i % 2 ? "hip-hop" : "pop"));

  it("confirms the Architect when refinement and command lead across genres", () => {
    const m = matchArchetypeV2(buildLedger(strong, DIMS), profiles.slice(0, 2));
    expect(m).toMatchObject({ name: "The Architect", status: "confirmed" });
  });

  it("only leans when every pick came from one genre", () => {
    const one = strong.map((c) => ({ ...c, chosen: { ...c.chosen!, lane: "hip-hop" } }));
    const m = matchArchetypeV2(buildLedger(one, DIMS), profiles.slice(0, 2))!;
    expect(m.status).toBe("leaning");
    expect(m.reasons).toContain("single_genre");
  });

  it("never confirms an archetype that needs thematic evidence", () => {
    const m = matchArchetypeV2(buildLedger(strong, DIMS), [profiles[2], profiles[1]])!;
    expect(m.status).not.toBe("confirmed");
  });
});
