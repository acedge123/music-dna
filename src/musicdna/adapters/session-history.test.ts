import { describe, expect, it } from "vitest";
import { loadSessionHistory } from "./session-history";
import { expectedCatalog } from "../engine/evidence-snapshot";

function client(
  legacy = false,
  error: { message: string } | null = null,
  events: Record<string, unknown>[] = [],
) {
  const chosen = { id: "b", title: "Live B renamed", artist: "Y", year: null, lane: "pop" };
  const rejected = { id: "a", title: "Live A renamed", artist: "X", year: null, lane: "pop" };
  const row = {
    id: "c",
    session_id: "s",
    pairing_id: "p",
    chosen_song_id: "b",
    rejected_song_id: "a",
    created_at: "1",
    chosen,
    rejected,
    response: { verdict: "Frozen B over Frozen A", why: "Noted" },
    pairing: {
      id: "p",
      tests: ["tension"],
      diagnostic_weight: 20,
      song_a: rejected,
      song_b: chosen,
    },
    evidence: legacy
      ? null
      : {
          version: "choice-evidence-v1",
          source: "pairing",
          choice_id: "c",
          session_id: "s",
          pairing_id: "p",
          song_a_id: "a",
          song_b_id: "b",
          created_at: "1",
          ms_to_decide: 100,
          mutation_id: null,
          catalog_revision: "revision",
          catalog: expectedCatalog(
            { tests: ["scale"], diagnostic_weight: 100 },
            { ...chosen, title: "Frozen B", scale: 90 },
            { ...rejected, title: "Frozen A", scale: 10 },
          ),
          contrasts: { scale: 80 },
        },
  };
  return {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: table === "choices" ? [row] : events, error }).then(resolve),
      };
      return q;
    },
  };
}

describe("frozen resume history", () => {
  it("restores authored read and frozen audit metadata without exposing validation diagnostics", async () => {
    const history = await loadSessionHistory(
      client(false, null, [
        {
          event_type: "read_shown",
          created_at: "2",
          pairing_id: null,
          props: {
            thesis: "The saved authored read.",
            validation_reason: "private diagnostic",
            result: {
              voice_version: "critic-expression-v2",
              audit_text: "The frozen evidence.",
              narration_status: "ok",
            },
          },
        },
      ]) as never,
      "s",
    );
    expect(history[1]).toMatchObject({
      type: "read",
      thesis: "The saved authored read.",
      voice_version: "critic-expression-v2",
      audit_text: "The frozen evidence.",
      narration_status: "ok",
    });
    expect(JSON.stringify(history)).not.toContain("private diagnostic");
  });
  it("preserves legacy read wording when optional narration metadata is absent", async () => {
    const history = await loadSessionHistory(
      client(false, null, [
        {
          event_type: "read_shown",
          created_at: "2",
          pairing_id: null,
          props: { thesis: "A historical claim, including its exception." },
        },
      ]) as never,
      "s",
    );
    expect(history[1]).toMatchObject({
      thesis: "A historical claim, including its exception.",
      voice_version: null,
      audit_text: null,
      narration_status: null,
    });
  });
  it("uses vote-time metadata and preserves the original A/B order", async () => {
    const history = await loadSessionHistory(client() as never, "s");
    expect(history[0]).toMatchObject({
      type: "choice",
      evidence_source: "pairing",
      chosen: { title: "Frozen B" },
      pairing: {
        tests: ["scale"],
        diagnostic_weight: 100,
        song_a: { id: "a", title: "Frozen A" },
        song_b: { id: "b", title: "Frozen B" },
      },
    });
    expect(JSON.stringify(history)).not.toContain("renamed");
  });
  it("labels legacy display joins as unavailable evidence", async () => {
    expect((await loadSessionHistory(client(true) as never, "s"))[0]).toMatchObject({
      type: "choice",
      evidence_source: "legacy_unavailable",
      chosen: { title: "Live B renamed" },
    });
  });
  it("propagates history read failures", async () => {
    await expect(
      loadSessionHistory(client(false, { message: "offline" }) as never, "s"),
    ).rejects.toThrow("offline");
  });
});
