import { describe, expect, it } from "vitest";
import { pushbackEventId, recordHalftimePushbackImpl, PushbackError } from "./halftime-pushback";

type Row = Record<string, unknown>;
function fakes(owner = "u1") {
  const events = new Map<string, Row>();
  const writes: string[] = [];
  const q = (table: string, store: "user" | "admin") => {
    const f: Record<string, unknown> = {};
    let idEq: string | null = null;
    f.select = () => f;
    f.eq = (k: string, v: string) => { if (k === "id") idEq = v; return f; };
    f.maybeSingle = async () => {
      if (table === "sessions") return { data: owner ? { user_id: owner } : null, error: null };
      return { data: idEq ? events.get(idEq) ?? null : null, error: null };
    };
    f.then = (r: (v: unknown) => unknown) => r({ count: 3, error: null });
    f.insert = async (row: Row) => {
      writes.push(`${store}:${table}`);
      if (events.has(row.id as string)) return { error: { code: "23505" } };
      events.set(row.id as string, { ...row, created_at: "t" });
      return { error: null };
    };
    for (const m of ["update", "upsert", "delete"]) f[m] = () => { writes.push(`${m}:${table}`); return f; };
    return f;
  };
  return {
    events,
    writes,
    user: { from: (t: string) => q(t, "user") } as never,
    admin: { from: (t: string) => q(t, "admin") } as never,
  };
}
const input = { sessionId: "11111111-1111-4111-8111-111111111111", text: "  No, I hate slow songs ", mutationId: "mut-00001" };

describe("halftime pushback", () => {
  it("denies another owner's session", async () => {
    const f = fakes("someone-else");
    await expect(recordHalftimePushbackImpl(f.user, f.admin, "u1", input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.writes).toEqual([]);
  });

  it("saves trimmed text with at_pick as self-report, never a vote", async () => {
    const f = fakes();
    const r = await recordHalftimePushbackImpl(f.user, f.admin, "u1", input);
    expect(r).toMatchObject({ text: "No, I hate slow songs", at_pick: 3, counts_as_vote: false, provenance: "self_report", replayed: false });
    expect(f.writes).toEqual(["admin:event_log"]);
  });

  it("a double tap or retry replays the same reply without a second event", async () => {
    const f = fakes();
    const a = await recordHalftimePushbackImpl(f.user, f.admin, "u1", input);
    const b = await recordHalftimePushbackImpl(f.user, f.admin, "u1", input);
    expect(b.replayed).toBe(true);
    expect(b.reply).toBe(a.reply);
    expect(f.events.size).toBe(1);
  });

  it("rejects reusing a mutation_id for different text", async () => {
    const f = fakes();
    await recordHalftimePushbackImpl(f.user, f.admin, "u1", input);
    await expect(recordHalftimePushbackImpl(f.user, f.admin, "u1", { ...input, text: "other" })).rejects.toBeInstanceOf(PushbackError);
  });

  it("derives a stable event id per session and mutation", async () => {
    expect(await pushbackEventId("s", "m")).toBe(await pushbackEventId("s", "m"));
    expect(await pushbackEventId("s", "m")).not.toBe(await pushbackEventId("s", "n"));
  });
});
