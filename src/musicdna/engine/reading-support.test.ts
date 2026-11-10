import { describe, expect, it } from "vitest";
import { buildLedger } from "./evidence";
import { hasReadingSupport, shouldResumeInterview } from "./reading-support";

function ledger(deltas: number[]) {
  return buildLedger(
    deltas.map((scale, i) => ({
      pairing_id: `p${i}`,
      tests: ["scale"],
      chosen: { scale },
      rejected: { scale: 0 },
    })),
    ["scale"],
  );
}

describe("reading and restart policy", () => {
  it("withholds an archetype without three supporting pairings", () => {
    expect(hasReadingSupport(ledger([40, 40]))).toBe(false);
    expect(hasReadingSupport(ledger([40, 40, 40]))).toBe(true);
  });
  it("withholds an archetype for split evidence", () => {
    expect(hasReadingSupport(ledger([40, 40, -40, -40]))).toBe(false);
  });
  it("a fresh start bypasses implicit resume but explicit history still restores", () => {
    expect(shouldResumeInterview({ fresh: "new" })).toBe(false);
    expect(shouldResumeInterview({ fresh: "new", session: "saved" })).toBe(true);
    expect(shouldResumeInterview({})).toBe(true);
  });
});
