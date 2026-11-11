import { describe, expect, it } from "vitest";
import {
  blendPrior, compareToOriginal, decadeCoverage, eraAllowsLane, explorationPool,
  inDecade, isExplorationSlot, pairingInDecade,
} from "./decades";

const DIMS = ["movement", "atmosphere", "immersion", "scale", "community", "perspective", "confidence", "tension", "texture", "transformation"];

describe("decade bounds", () => {
  it("allows one year of early leeway (1979 counts as the '80s)", () => {
    expect(inDecade(1979, 1980)).toBe(true);
    expect(inDecade(1978, 1980)).toBe(false);
    expect(inDecade(1989, 1980)).toBe(true);
    expect(inDecade(1990, 1980)).toBe(false);
  });
  it("needs both songs inside the decade", () => {
    expect(pairingInDecade({ lane: "pop", song_a: { year: 1984 }, song_b: { year: 1992 } }, 1980)).toBe(false);
    expect(pairingInDecade({ lane: "pop", song_a: { year: 1984 }, song_b: { year: 1987 } }, 1980)).toBe(true);
  });
});

describe("genre-era rules", () => {
  it("no Electronic or Hip-hop before 1980", () => {
    expect(eraAllowsLane("electronic", 1970)).toBe(false);
    expect(eraAllowsLane("hip_hop", 1970)).toBe(false);
    expect(eraAllowsLane("hip_hop", 1980)).toBe(true);
  });
  it("Classic Rock stops at 1990; Disco is '70s; Punk ends after the '90s", () => {
    expect(eraAllowsLane("classic_rock", 1980)).toBe(true);
    expect(eraAllowsLane("classic_rock", 1990)).toBe(false);
    expect(eraAllowsLane("disco", 1970)).toBe(true);
    expect(eraAllowsLane("disco", 1980)).toBe(false);
    expect(eraAllowsLane("punk", 1990)).toBe(true);
    expect(eraAllowsLane("punk", 2000)).toBe(false);
  });
});

describe("surprise picks", () => {
  it("every third pick is an exploration slot", () => {
    expect([0, 1, 2, 3, 4, 5].map(isExplorationSlot)).toEqual([false, false, true, false, false, true]);
  });
  it("exploration pool avoids known traits when it can", () => {
    const pool = [{ id: "a", tests: ["texture"] }, { id: "b", tests: ["scale"] }];
    expect(explorationPool(pool, ["texture"]).map((p) => p.id)).toEqual(["b"]);
    expect(explorationPool(pool, ["texture", "scale"]).map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("prior blending never mutates the original reading", () => {
  it("half-weights the parent and leaves inputs unchanged", () => {
    const parent = { texture: -40 };
    const current = { texture: 10 };
    expect(blendPrior(parent, current, DIMS).texture).toBe(-10);
    expect(parent).toEqual({ texture: -40 });
  });
});

describe("coverage", () => {
  it("counts playable matchups by decade × trait and gates readiness", () => {
    const p = (y: number, t: string) => ({ lane: "pop", tests: [t], song_a: { year: y, [t]: 10 }, song_b: { year: y, [t]: 90 } });
    const pool = Array.from({ length: 10 }, (_, i) => p(1985, DIMS[i % 6]));
    const c = decadeCoverage(pool, DIMS).find((x) => x.decade === 1980)!;
    expect(c.pairings).toBe(10);
    expect(c.traits_covered).toBe(6);
    expect(c.ready).toBe(true);
    expect(decadeCoverage(pool.slice(0, 9), DIMS).find((x) => x.decade === 1980)!.ready).toBe(false);
  });
});

describe("comparison", () => {
  it("labels held, flipped, new and quiet traits from eligible leans only", () => {
    const o = [
      { axis: "texture", direction: "lo" as const, eligible: true, magnitude: 1 },
      { axis: "tension", direction: "hi" as const, eligible: true, magnitude: 1 },
      { axis: "scale", direction: "hi" as const, eligible: true, magnitude: 1 },
    ];
    const d = [
      { axis: "texture", direction: "lo" as const, eligible: true, magnitude: 1 },
      { axis: "tension", direction: "lo" as const, eligible: true, magnitude: 1 },
      { axis: "movement", direction: "hi" as const, eligible: true, magnitude: 1 },
      { axis: "community", direction: "hi" as const, eligible: false, magnitude: 1 },
    ];
    const kinds = Object.fromEntries(compareToOriginal(o, d).map((s) => [s.axis, s.kind]));
    expect(kinds).toEqual({ texture: "held", tension: "flipped", scale: "quiet", movement: "new" });
  });
});

describe("decade review fixes", () => {
  it("caps the comparison at k", () => {
    const axes = ["texture", "tension", "scale", "movement", "community", "immersion"];
    const o = axes.map((axis) => ({ axis, direction: "hi" as const, eligible: true, magnitude: 1 }));
    expect(compareToOriginal(o, o, 3)).toHaveLength(3);
    expect(compareToOriginal(o, o)).toHaveLength(4);
  });
  it("coverage counts only matchups the selector can serve", async () => {
    const { playableDecadePool } = await import("./decades");
    const song = (year: number, v: number) => ({ id: String(year + v), year, texture: v, tension: 50 });
    const good = { id: "g", lane: "pop", tests: ["texture"], is_bootstrap: false, song_a: song(1985, 10), song_b: song(1986, 90) };
    const flat = { ...good, id: "f", song_b: song(1986, 15) };
    const boot = { ...good, id: "b", is_bootstrap: true };
    expect(playableDecadePool([good, flat, boot] as never, 1980).map((p: { id: string }) => p.id)).toEqual(["g"]);
  });
});
