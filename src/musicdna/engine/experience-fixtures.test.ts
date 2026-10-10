import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLedger } from "./evidence";
import { sessionCompletion } from "./pairing";

const DIR = resolve(process.cwd(), "fixtures/musicdna/experience-v1");
const DIMS = [
  "movement",
  "atmosphere",
  "immersion",
  "scale",
  "community",
  "perspective",
  "confidence",
  "tension",
  "texture",
  "transformation",
];

describe("experience-v1 fixtures stay in sync with the engine", () => {
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
    it(f, () => {
      const fx = JSON.parse(readFileSync(resolve(DIR, f), "utf8"));
      const ledger = buildLedger(fx.input.choices, DIMS);
      const lead = ledger.axes[0] ?? null;
      expect(ledger.answered).toBe(fx.expected.answered);
      expect(
        lead
          ? {
              status: lead.status,
              eligible: lead.eligible,
              supporting: lead.supporting,
              contradicting: lead.contradicting,
            }
          : null,
      ).toEqual(
        fx.expected.lead_axis && {
          status: fx.expected.lead_axis.status,
          eligible: fx.expected.lead_axis.eligible,
          supporting: fx.expected.lead_axis.supporting,
          contradicting: fx.expected.lead_axis.contradicting,
        },
      );
      const c = sessionCompletion({
        answered: ledger.answered,
        skipped: fx.input.skipped,
        consecutive_skips: fx.input.consecutive_skips,
        vector: {},
        dims: DIMS,
      });
      expect({ done: c.done, reason: c.reason }).toEqual(fx.expected.completion);
    });
  }
});
