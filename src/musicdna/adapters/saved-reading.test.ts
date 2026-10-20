import { describe, it, expect, vi } from "vitest";
import { loadSavedReading } from "./saved-reading";
const content = { synthesis: "Saved original", kept_choosing: [], counter_reads: [] };
const rows = [
  {
    version: 1,
    source: "pairings",
    base_version: null,
    content,
    created_at: "2026-10-20T00:00:00Z",
  },
  {
    version: 2,
    source: "chat_self_report",
    base_version: 1,
    content: { ...content, synthesis: "Saved revision" },
    created_at: "2026-10-20T00:01:00Z",
  },
];
function client(owner = "owner", data: unknown[] = rows, error: unknown = null) {
  const from = vi.fn((table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({
        data: { id: "reading", user_id: owner, completed_at: "done" },
        error: null,
      }),
      order: async () => ({ data, error }),
    };
    return q;
  });
  return { from };
}
describe("owned saved-reading lookup", () => {
  it("keeps the original selected when newer self-report versions exist", async () => {
    const r = await loadSavedReading(client() as never, "owner", { sessionId: "reading" });
    expect(r.selected.content.synthesis).toBe("Saved original");
    expect(r.selected.version).toBe(1);
    expect(r.versions[1].source).toBe("chat_self_report");
  });
  it("opens an explicitly requested version within the same owned session", async () => {
    const r = await loadSavedReading(client() as never, "owner", {
      sessionId: "reading",
      resultVersion: 2,
    });
    expect(r.selected.content.synthesis).toBe("Saved revision");
    expect(r.selected.baseVersion).toBe(1);
  });
  it("denies another account before querying result content", async () => {
    const c = client("foreign");
    await expect(loadSavedReading(c as never, "owner", { sessionId: "reading" })).rejects.toThrow(
      "not available",
    );
    expect(c.from).toHaveBeenCalledTimes(1);
  });
  it("never substitutes a different version for a missing requested version", async () => {
    await expect(
      loadSavedReading(client() as never, "owner", { sessionId: "reading", resultVersion: 99 }),
    ).rejects.toThrow("before continuing");
  });
  it("propagates persistence failure without synthesizing a reading", async () => {
    await expect(
      loadSavedReading(client("owner", [], { message: "database failed" }) as never, "owner", {
        sessionId: "reading",
      }),
    ).rejects.toThrow("Couldn't load the saved reading");
  });
  it("rejects malformed content rather than trusting arbitrary stored JSON", async () => {
    await expect(
      loadSavedReading(
        client("owner", [{ ...rows[0], content: { synthesis: "no evidence fields" } }]) as never,
        "owner",
        { sessionId: "reading" },
      ),
    ).rejects.toThrow("couldn't be opened");
  });
});
