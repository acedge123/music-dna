import { describe, expect, it } from "vitest";
import { buildLedger, detectRevision } from "./evidence";

const DIMS = ["scale", "tension"] as const;
const song = (title: string, scale: number | null, tension = 50) => ({
  title,
  artist: "X",
  scale,
  tension,
});
const pick = (id: string, a: ReturnType<typeof song>, b: ReturnType<typeof song>) => ({
  pairing_id: id,
  tests: ["scale"],
  diagnostic_weight: 50,
  chosen: a,
  rejected: b,
});

describe("evidence ledger", () => {
  it("3–1 qualifies, examples only supporting", () => {
    const l = buildLedger(
      [
        pick("1", song("A", 80), song("B", 20)),
        pick("2", song("C", 70), song("D", 30)),
        pick("3", song("E", 90), song("F", 40)),
        pick("4", song("G", 20), song("H", 70)),
      ],
      DIMS,
    );
    const s = l.axes.find((a) => a.axis === "scale")!;
    expect(s).toMatchObject({
      supporting: 3,
      contradicting: 1,
      status: "qualified",
      eligible: true,
    });
    expect(s.supporting_examples.every((e) => e.delta > 0)).toBe(true);
  });
  it("2–2 is mixed", () => {
    const l = buildLedger(
      [
        pick("1", song("A", 80), song("B", 20)),
        pick("2", song("C", 70), song("D", 30)),
        pick("3", song("E", 20), song("F", 70)),
        pick("4", song("G", 20), song("H", 70)),
      ],
      DIMS,
    );
    expect(l.axes[0].eligible).toBe(false);
    expect(l.axes[0].status).toBe("mixed");
  });
  it("missing values are unknown, duplicates count once", () => {
    const l = buildLedger(
      [
        pick("1", song("A", null), song("B", 20)),
        pick("2", song("C", 70), song("D", 30)),
        pick("2", song("C", 70), song("D", 30)),
      ],
      DIMS,
    );
    expect(l.entries).toHaveLength(1);
    expect(l.answered).toBe(2);
  });
  it("revision names the contradicting pick", () => {
    const l = buildLedger(
      [
        pick("1", song("A", 80), song("B", 20)),
        pick("2", song("C", 20), song("D", 70)),
        pick("3", song("E", 20), song("F", 70)),
      ],
      DIMS,
    );
    const r = detectRevision({ axis: "scale", direction: "hi", tier: "theory" }, l);
    expect(r.revised).toBe(true);
    expect(r.changed_by?.chosen).toBe("E");
  });
  it("no revision when the claim still holds", () => {
    const l = buildLedger([pick("1", song("A", 80), song("B", 20))], DIMS);
    expect(detectRevision({ axis: "scale", direction: "hi", tier: "theory" }, l).revised).toBe(
      false,
    );
  });
});
