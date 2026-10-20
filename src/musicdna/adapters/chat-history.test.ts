import { describe, it, expect } from "vitest";
import { loadChatPage, decodeChatCursor } from "./chat-history";
const stamp = "2026-10-20T04:00:00.000Z";
const rows = Array.from({ length: 451 }, (_, i) => ({
  id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  created_at: stamp,
  content: String(i),
  role: "user",
  mutation_id: String(i),
})).reverse();
function client(owner = "owner") {
  return {
    from: (table: string) => {
      let before: string | undefined,
        limit = 201;
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        or: (v: string) => {
          before = v.match(/id.lt.([0-9a-f-]+)/)?.[1];
          return q;
        },
        limit: (v: number) => {
          limit = v;
          return q;
        },
        maybeSingle: async () => ({ data: { user_id: owner }, error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({
            data:
              table === "chat_messages"
                ? rows.filter((r) => !before || r.id < before).slice(0, limit)
                : [],
            error: null,
          }).then(resolve),
      };
      return q;
    },
  };
}
describe("complete chat restoration", () => {
  it("restores 451 equal-timestamp messages with no gaps or duplicates beyond 200", async () => {
    const restored: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await loadChatPage(client() as never, "owner", "s", cursor);
      restored.push(...page.messages.map((m) => m.id));
      cursor = page.next_cursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(restored).toHaveLength(451);
    expect(new Set(restored).size).toBe(451);
    expect(restored.sort()).toEqual(rows.map((r) => r.id).sort());
  });
  it("rejects invalid cursor syntax rather than interpolating filters", () => {
    expect(() => decodeChatCursor("bad,or(id.gt.0)")).toThrow("Invalid history cursor");
  });
  it("denies nonowner restoration", async () => {
    await expect(loadChatPage(client("other") as never, "owner", "s")).rejects.toThrow("forbidden");
  });
});
