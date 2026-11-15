import { describe, expect, it, vi } from "vitest";
import { loadOpenerAnalysis, saveOpeningProfile } from "./opener-profile";
import { nextPairingImpl } from "@/lib/musicdna.functions";
import { openerEra, preferEra } from "../engine/opener-era";

const analysis = {
  per_song: [
    { input: "True", lane: "pop", canon_id: "true-id" },
    { input: "Roxanne", lane: "classic_rock" },
    { input: "Little Red Corvette", lane: "pop" },
  ],
};
const values = {
  opening_songs: ["True", "Roxanne", "Little Red Corvette"],
  opening_hypothesis: "Opening hypothesis",
  opening_lane: "pop",
  opening_lane_confidence: 0.8,
  opening_analysis_json: analysis,
};
function clientWith(result: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  const from = vi.fn().mockReturnValue(chain);
  return { client: { from } as never, from, chain };
}

describe("shared opener profile", () => {
  it.each(["anonymous-owner", "registered-owner"])(
    "confirms ranked opener save for %s",
    async (owner) => {
      const { client, chain } = clientWith({ data: { user_id: owner, ...values }, error: null });
      expect(await saveOpeningProfile(client, owner, values)).toEqual(analysis);
      expect(chain.update).toHaveBeenCalledWith(values);
      expect(chain.eq).toHaveBeenCalledWith("user_id", owner);
      expect(await loadOpenerAnalysis(client, owner)).toEqual(analysis);
    },
  );
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "private database detail" } },
    { data: { user_id: "other", ...values }, error: null },
    { data: { user_id: "owner", ...values, opening_songs: ["old song"] }, error: null },
  ])("rejects unconfirmed saves", async (result) => {
    const { client } = clientWith(result);
    await expect(saveOpeningProfile(client, "owner", values)).rejects.toThrow(
      "Couldn't save your opening songs. Please retry.",
    );
  });
  it("preserves legitimate missing-profile fallback", async () => {
    expect(
      await loadOpenerAnalysis(clientWith({ data: null, error: null }).client, "owner"),
    ).toBeNull();
  });
  it("does not disguise a profile read error as missing input", async () => {
    await expect(
      loadOpenerAnalysis(
        clientWith({ data: null, error: { message: "private detail" } }).client,
        "owner",
      ),
    ).rejects.toThrow("Couldn't load your opening songs. Please retry.");
  });
  it("next reads the visible session owner's profile directly and uses recovered catalog IDs", async () => {
    const queries: Array<{ table: string; chain: ReturnType<typeof clientWith>["chain"] }> = [];
    const from = vi.fn((table: string) => {
      const result =
        table === "profiles"
          ? { data: { opening_analysis_json: analysis }, error: null }
          : table === "sessions"
            ? { data: { user_id: "visible-owner", lane: "pop", vector: {} }, error: null }
            : { data: [], error: null };
      const { chain } = clientWith(result);
      const extended = {
        ...chain,
        single: vi.fn().mockResolvedValue(result),
        in: vi.fn(() => {
          if (table === "songs") throw new Error("catalog-year-query-reached");
          return chain;
        }),
        order: vi.fn().mockReturnValue(chain),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      // Return-this mocks need their original chain extended in place.
      Object.assign(chain, extended);
      queries.push({ table, chain });
      return chain;
    });
    await expect(nextPairingImpl({ from } as never, { sessionId: "session" })).rejects.toThrow(
      "catalog-year-query-reached",
    );
    expect(queries.map((q) => q.table)).toEqual(["choices", "sessions", "event_log", "profiles", "songs"]);
    expect(queries[3].chain.eq).toHaveBeenCalledWith("user_id", "visible-owner");
    expect(queries[3].chain.select).toHaveBeenCalledWith("opening_analysis_json");
    expect(queries[4].chain.select).toHaveBeenCalledWith("id,year");
  });
  it("completed interviews do not depend on current opener profiles", async () => {
    const { chain } = clientWith({ data: null, error: null });
    const from = vi.fn((table: string) => {
      if (table === "profiles") throw new Error("unexpected profile read");
      return Object.assign(chain, {
        single: vi.fn().mockResolvedValue({ data: { user_id: "owner", completed_at: "2026-11-15", vector: {} }, error: null }),
      });
    });
    expect(await nextPairingImpl({ from } as never, { sessionId: "completed" })).toMatchObject({ done: true, pairing: null });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["choices", "sessions"]);
  });
});

describe("recovered True era policy", () => {
  const pair = (a: number, b: number) => ({ song_a: { year: a }, song_b: { year: b } });
  const near = [pair(1983, 1985), pair(1981, 1987), pair(1989, 1990)];
  const newer = [pair(2002, 2003), pair(2024, 2025)];
  it("one catalog match anchors 1973–1993 and excludes newer pairs for the first three answers", () => {
    const era = openerEra([1983, null, null]);
    expect(era).toEqual({ from: 1973, to: 1993 });
    for (const answered of [0, 1, 2])
      expect(preferEra([...near, ...newer], era, answered)).toEqual(near);
  });
  it("keeps the existing fewer-than-three fallback", () => {
    const pool = [...near.slice(0, 2), ...newer];
    expect(preferEra(pool, openerEra([1983]), 0)).toBe(pool);
  });
  it("keeps unmatched opener fallback", () => {
    const pool = [...near, ...newer];
    expect(preferEra(pool, openerEra([null, null, null]), 0)).toBe(pool);
  });
  it("fades at three answered choices, not after skipped offers", () => {
    const pool = [...near, ...newer];
    expect(preferEra(pool, openerEra([1983]), 2)).toEqual(near);
    expect(preferEra(pool, openerEra([1983]), 3)).toBe(pool);
  });
});
