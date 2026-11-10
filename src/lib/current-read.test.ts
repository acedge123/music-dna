import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectedCatalog } from "@/musicdna/engine/evidence-snapshot";

const state = vi.hoisted(() => ({
  events: [] as { props: Record<string, unknown> }[],
  failWrite: false,
}));
const generate = vi.hoisted(() => vi.fn());
vi.mock("@/musicdna/adapters/llm-gateway", () => ({
  DEFAULT_MODEL: "test-model",
  callLovableAi: generate,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: async (row: { props: Record<string, unknown> }) => {
        if (table !== "event_log") return { error: null };
        if (state.failWrite) return { error: { message: "write failed" } };
        if (table === "event_log") state.events.unshift(row);
        return { error: null };
      },
    }),
  },
}));
import { currentReadImpl } from "./musicdna.functions";

function client(deltas: number[], owner = "user") {
  const rows = deltas.map((scale, i) => ({
    id: String(i),
    session_id: "s",
    pairing_id: String(i),
    chosen_song_id: "a",
    rejected_song_id: "b",
    created_at: String(i),
    evidence: {
      version: "choice-evidence-v1",
      source: "pairing",
      choice_id: String(i),
      session_id: "s",
      pairing_id: String(i),
      created_at: String(i),
      ms_to_decide: 100,
      mutation_id: null,
      catalog_revision: "revision",
      catalog: expectedCatalog(
        { tests: ["scale"], diagnostic_weight: 100 },
        { id: "a", title: `A${i}`, artist: "X", scale: 50 + scale / 2 },
        { id: "b", title: `B${i}`, artist: "Y", scale: 50 - scale / 2 },
      ),
      contrasts: { scale },
    },
  }));
  return {
    from: (table: string) => {
      const result = () => ({
        data: table === "sessions" ? { user_id: owner } : table === "choices" ? rows : state.events,
        error: null,
      });
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => result(),
        then: (resolve: (r: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return q;
    },
  };
}

describe("current read service boundary", () => {
  beforeEach(() => {
    state.events = [];
    state.failWrite = false;
    generate.mockReset().mockRejectedValue(new Error("test generation unavailable"));
  });
  it("routes interim observations through the v2.3 writer and reviewer with zero eligible claims", async () => {
    generate
      .mockResolvedValueOnce(
        JSON.stringify({
          headline: "A0 beat B0 in this matchup.",
          body: "One choice leaves the larger pattern open.",
          choice_ids: ["0"],
          claims: [],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          grounded: true,
          ceiling_preserved: true,
          exceptions_preserved: true,
          self_report_separate: true,
          no_invented_facts: true,
          no_future_test_disclosure: true,
          responsive: true,
          failed: [],
        }),
      );
    const result = await currentReadImpl(client([40]) as never, "user", { sessionId: "s" });
    expect(result.voice_version).toBe("critic-expression-v2.3");
    expect(result.narration_status).toBe("ok");
    expect(generate).toHaveBeenCalledTimes(2);
    const writer = generate.mock.calls[0][1];
    const reviewer = generate.mock.calls[1][1];
    expect(writer.role).toBe("writer");
    expect(writer.jsonSchema.schema.properties.claims.maxItems).toBe(0);
    expect(writer.jsonSchema.schema.properties.choice_ids.items.enum).toEqual(["0"]);
    expect(reviewer.role).toBe("reviewer");
    expect(reviewer.jsonSchema.name).toBe("critic_review");
  });
  it("stores and replays the complete qualified read verbatim", async () => {
    const api = client([40, 40, 40, -40]);
    const first = await currentReadImpl(api as never, "user", { sessionId: "s" });
    expect(first).toMatchObject({ tier: "read", evidence: { supporting: 3, contradicting: 1 } });
    expect(first.thesis).toContain("A3 over B3");
    const replay = await currentReadImpl(api as never, "user", { sessionId: "s" });
    expect(replay).toEqual(first);
    expect(state.events).toHaveLength(1);
  });
  it("keeps a persisted revision stable on resume", async () => {
    state.events = [
      {
        props: {
          axis: "scale",
          direction: "hi",
          tier: "theory",
          thesis: "Earlier read",
          answered: 1,
        },
      },
    ];
    const api = client([40, -40, -40]);
    const first = await currentReadImpl(api as never, "user", { sessionId: "s" });
    expect(first.direction).toBe("revising");
    expect(first.revision?.changed_by).toMatchObject({ chosen: "A2 (X)", rejected: "B2 (Y)" });
    expect(await currentReadImpl(api as never, "user", { sessionId: "s" })).toEqual(first);
    expect(state.events).toHaveLength(2);
  });
  it("does not acknowledge a read that failed persistence", async () => {
    state.failWrite = true;
    await expect(
      currentReadImpl(client([40]) as never, "user", { sessionId: "s" }),
    ).rejects.toThrow("read_persistence_failed");
  });
  it("checks ownership before reading or persisting evidence", async () => {
    await expect(
      currentReadImpl(client([40], "other") as never, "user", { sessionId: "s" }),
    ).rejects.toThrow("forbidden");
    expect(state.events).toEqual([]);
  });
});
