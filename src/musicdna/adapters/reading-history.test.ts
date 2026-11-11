import { describe, expect, it } from "vitest";
import { loadReadingHistory, parseReadingCursor } from "./reading-history";
const id = "00000000-0000-4000-8000-000000000001";
const started_at = "2026-11-10T12:00:00.000Z";
function fake(rows: unknown[], error: unknown = null) {
  const calls: unknown[][] = [];
  const q = {
    select: (...a: unknown[]) => {
      calls.push(["select", ...a]);
      return q;
    },
    eq: (...a: unknown[]) => {
      calls.push(["eq", ...a]);
      return q;
    },
    order: (...a: unknown[]) => {
      calls.push(["order", ...a]);
      return q;
    },
    or: (...a: unknown[]) => {
      calls.push(["or", ...a]);
      return q;
    },
    limit: async (...a: unknown[]) => {
      calls.push(["limit", ...a]);
      return { data: rows, error };
    },
  };
  return { client: { from: () => q }, calls };
}
describe("reading library", () => {
  it("scopes the owner, preserves mode/parent and uses a tied-time cursor", async () => {
    const row = {
      id,
      started_at,
      mode: "explore",
      decade: 1980,
      parent_session_id: "root",
      completed_at: null,
    };
    const { client, calls } = fake([row, { ...row, id: "second" }]);
    const page = await loadReadingHistory(client as never, "owner", 1, null);
    expect(calls).toContainEqual(["eq", "user_id", "owner"]);
    expect(calls).toContainEqual(["order", "id", { ascending: false }]);
    expect(calls).toContainEqual(["limit", 2]);
    expect(page.sessions).toHaveLength(1);
    expect(page.sessions[0]).toMatchObject({
      mode: "explore",
      decade: 1980,
      parent_session_id: "root",
      status: "in_progress",
    });
    expect(parseReadingCursor(page.next_cursor)).toEqual({ id, started_at });
  });
  it("uses both cursor fields and does not invent an extra page", async () => {
    const { client, calls } = fake([]);
    const page = await loadReadingHistory(client as never, "owner", 30, { id, started_at });
    expect(calls).toContainEqual([
      "or",
      `started_at.lt.${started_at},and(started_at.eq.${started_at},id.lt.${id})`,
    ]);
    expect(page).toEqual({ sessions: [], has_more: false, next_cursor: null });
  });
  it("rejects cursor injection and malformed timestamps before DB access", () => {
    for (const v of [
      "{}",
      "not-json",
      JSON.stringify({ id: "x),user_id.neq.owner", started_at }),
      JSON.stringify({ id, started_at: "yesterday" }),
    ])
      expect(() => parseReadingCursor(v)).toThrow();
  });
  it("does not label failed reads as empty history", async () => {
    const { client } = fake([], { message: "database failure" });
    await expect(loadReadingHistory(client as never, "owner", 30, null)).rejects.toThrow(
      "Reading history unavailable",
    );
  });
});
