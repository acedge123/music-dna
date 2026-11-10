import { describe, expect, it } from "vitest";
import { hasDiagnosticIntegrity, sayingProblem, validTests } from "./pairing-eligibility";

const a = { tension: 80, texture: 50, scale: 40 };
const b = { tension: 30, texture: 40, scale: 40 };

describe("pairing activation checks", () => {
  it("rejects a matchup with no declared tests", () => {
    expect(hasDiagnosticIntegrity({ tests: [], song_a: a, song_b: b })).toBe(false);
  });
  it("rejects declared traits whose songs differ by under 20 points", () => {
    expect(hasDiagnosticIntegrity({ tests: ["texture", "scale"], song_a: a, song_b: b })).toBe(false);
  });
  it("accepts a declared trait with a 20+ point contrast and drops unknown traits", () => {
    expect(validTests(["tension", "groove"], a, b)).toEqual(["tension"]);
    expect(hasDiagnosticIntegrity({ tests: ["tension"], song_a: a, song_b: b })).toBe(true);
  });
  it("rejects the generic 'Which one stays with you?' saying", () => {
    expect(sayingProblem("Which one stays with you?")).toBe("generic");
  });
  it("rejects a saying already used by another live matchup", () => {
    expect(sayingProblem("Control the attack, or let it break loose?", ["control the attack, or let it break loose?"])).toBe("duplicate");
  });
  it("accepts a specific, unique saying", () => {
    expect(sayingProblem("One man at a piano, or a cathedral on fire?", [])).toBeNull();
  });
});
