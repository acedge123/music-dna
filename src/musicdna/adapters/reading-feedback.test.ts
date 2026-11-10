import { describe, it, expect } from "vitest";
import { loadReadingFeedback } from "./reading-feedback";
function client(options: { foreign?: boolean; fail?: boolean } = {}) {
  const calls: { table: string; filters: unknown[][] }[] = [];
  const db = {
    from: (table: string) => {
      const filters: unknown[][] = [];
      calls.push({ table, filters });
      const q = {
        select: () => q,
        eq: (...args: unknown[]) => {
          filters.push(args);
          return q;
        },
        is: (...args: unknown[]) => {
          filters.push(args);
          return q;
        },
        not: () => q,
        order: () => q,
        maybeSingle: async () => ({
          data: options.foreign ? null : { id: "reading" },
          error: null,
        }),
        limit: async () => ({
          data: [{ id: "feedback", accuracy: "mixed", result_version: 2, mutation_id: "key" }],
          error: options.fail ? { message: "private database detail" } : null,
        }),
      };
      return q;
    },
  };
  return { db, calls };
}
describe("owner/version-scoped rating read", () => {
  it("checks the owned result before reading only that version’s untargeted accuracy feedback", async () => {
    const f = client();
    const r = await loadReadingFeedback(f.db as never, "owner", {
      sessionId: "session",
      resultVersion: 2,
    });
    expect(r.feedback?.accuracy).toBe("mixed");
    expect(f.calls[0].filters).toEqual([
      ["session_id", "session"],
      ["user_id", "owner"],
      ["version", 2],
    ]);
    expect(f.calls[1].filters).toEqual([
      ["session_id", "session"],
      ["user_id", "owner"],
      ["result_version", 2],
      ["target", null],
    ]);
  });
  it("denies an unavailable or foreign reading before reading feedback", async () => {
    const f = client({ foreign: true });
    await expect(
      loadReadingFeedback(f.db as never, "owner", { sessionId: "foreign", resultVersion: 1 }),
    ).rejects.toThrow("not available");
    expect(f.calls).toHaveLength(1);
  });
  it("does not disguise a failed query as an unrated reading", async () => {
    const f = client({ fail: true });
    await expect(
      loadReadingFeedback(f.db as never, "owner", { sessionId: "session", resultVersion: 1 }),
    ).rejects.toThrow("load your rating");
  });
});
