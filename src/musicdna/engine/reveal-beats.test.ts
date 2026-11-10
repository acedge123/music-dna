import { describe, expect, it } from "vitest";
import { buildLedger } from "./evidence";
import { revealBeats } from "./reveal-beats";

const ledger = (values: number[]) =>
  buildLedger(
    values.map((scale, i) => ({
      pairing_id: `p${i}`,
      tests: ["scale"],
      chosen: { title: `Chosen ${i}`, scale },
      rejected: { title: `Rejected ${i}`, scale: 0 },
    })),
    ["scale"],
  );

describe("reveal evidence beats", () => {
  it("uses the actual contrary fourth choice and the actual answer count", () => {
    expect(revealBeats(ledger([40, 40, 40, -40]))).toMatchObject({
      answered: 4,
      twist: "Chosen 3 over Rejected 3",
    });
  });
  it("does not invent a contradiction when all six choices support the tendency", () => {
    expect(revealBeats(ledger([40, 40, 40, 40, 40, 40]))).toMatchObject({
      answered: 6,
      twist: null,
    });
  });
  it("does not label a balanced split as an exception to an established tendency", () => {
    expect(revealBeats(ledger([40, 40, -40, -40])).twist).toBeNull();
  });
});
