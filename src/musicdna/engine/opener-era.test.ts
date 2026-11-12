import { describe, expect, it } from "vitest";
import { openerEra, preferEra } from "./opener-era";

const pair = (a: number, b: number) => ({ song_a: { year: a }, song_b: { year: b } });

describe("opener era", () => {
  it("1977/1983/1987 openers prefer matchups from about 1967–1997", () => {
    const era = openerEra([1977, 1983, 1987])!;
    expect(era.from).toBe(1967);
    expect(era.to).toBe(1997);
    const pool = [pair(1980, 1985), pair(1979, 1990), pair(1984, 1986), pair(2019, 2022)];
    expect(preferEra(pool, era, 0)).toHaveLength(3);
  });
  it("still offers a matchup when too few in-era ones exist", () => {
    const pool = [pair(2019, 2022), pair(2015, 2021)];
    expect(preferEra(pool, openerEra([1977, 1983, 1987]), 0)).toHaveLength(2);
  });
  it("fades after the opening three picks", () => {
    const pool = [pair(1980, 1985), pair(1979, 1990), pair(1984, 1986), pair(2019, 2022)];
    expect(preferEra(pool, openerEra([1977, 1983, 1987]), 3)).toHaveLength(4);
  });
});
