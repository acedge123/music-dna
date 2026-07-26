import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { recommendMusicDNARegime } from "./index";
import type { MusicDNATerrainInput } from "./types";

type GoldenCase = {
  id: string;
  input: MusicDNATerrainInput;
  expected: {
    terrain: unknown;
    regime: string;
    confidence: number;
    mode_pressure_in: string;
    scoring_agrees: boolean;
    transition_candidate: string | null;
    selection_mode: string;
    pairing_knobs: unknown;
    scores: Record<string, number>;
  };
};

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "fixtures/musicdna/parity-golden-v1.json"), "utf8"),
) as { cases: GoldenCase[] };

describe("MusicDNA x Agent Brain golden parity", () => {
  for (const testCase of fixture.cases) {
    it(testCase.id, () => {
      const rec = recommendMusicDNARegime(testCase.input);
      expect(rec.terrain).toEqual(testCase.expected.terrain);
      expect(rec.regime).toBe(testCase.expected.regime);
      expect(rec.confidence).toBe(testCase.expected.confidence);
      expect(rec.mode_pressure_in).toBe(testCase.expected.mode_pressure_in);
      expect(rec.scoring_agrees).toBe(testCase.expected.scoring_agrees);
      expect(rec.transition_candidate).toBe(testCase.expected.transition_candidate);
      expect(rec.selection_mode).toBe(testCase.expected.selection_mode);
      expect(rec.pairing_knobs).toEqual(testCase.expected.pairing_knobs);
      expect(Object.fromEntries(rec.scoring.breakdown.map((row) => [row.regime, row.score]))).toEqual(
        testCase.expected.scores,
      );
    });
  }
});
