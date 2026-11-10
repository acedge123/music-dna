import { describe, expect, it } from "vitest";
import { buildLedger } from "./evidence";
import { canStartQaInterview, hasReadingSupport, shouldResumeInterview } from "./reading-support";

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
  it("only a registered admin may create a tagged QA interview", () => {
    expect(canStartQaInterview(true, false)).toBe(true);
    expect(canStartQaInterview(false, false)).toBe(false);
    expect(canStartQaInterview(true, true)).toBe(false);
    expect(canStartQaInterview(false, true)).toBe(false);
  });
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
