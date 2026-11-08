// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  runSyntheticJourney,
  type JourneyHttp,
  type JourneyProgress,
} from "../../../tools/musicdna/learning-acceptance/journey.ts";

const sha = "a".repeat(40),
  persona = "ab50-10000000-0000-4000-8000-000000000001";
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fake(
  options: {
    existing?: boolean;
    sha?: string;
    early?: boolean;
    lostChoice?: boolean;
    persistedCount?: number;
  } = {},
) {
  let choices = 0;
  const calls: Array<{ path: string; body?: unknown }> = [];
  const checkpoints: JourneyProgress[] = [];
  const http: JourneyHttp = {
    async request(path, request = {}) {
      calls.push({ path, body: request.body });
      if (path === "/api/public/version")
        return { status: 200, data: { serving_sha: options.sha ?? sha, persistence_v2: true } };
      if (path.includes("/status?")) return { status: options.existing ? 200 : 404, data: {} };
      if (path.endsWith("/opener"))
        return {
          status: 200,
          data: { ok: true, user_id: id(1), opener: { private: "NOT_REPORTABLE" } },
        };
      if (path === "/api/v1/session") return { status: 200, data: { session_id: id(2) } };
      if (path.endsWith("/next"))
        return {
          status: 200,
          data: {
            contract: 1,
            completion: { done: options.early || choices === 6 },
            progress: { answered: choices, max_answered: 6 },
            session_id: id(2),
            pairing:
              choices === 6
                ? null
                : { id: id(10 + choices), song_a: { id: id(30) }, song_b: { id: id(31) } },
          },
        };
      if (path.endsWith("/choice")) {
        choices++;
        if (options.lostChoice) throw new Error("PRIVATE_TOKEN_AND_DATABASE_PROSE");
        return {
          status: 200,
          data: { contract: 1, replayed: false, reveal: "NOT_REPORTABLE" },
        };
      }
      if (path.endsWith("/reveal"))
        return {
          status: 200,
          data: { contract: 1, result_version: 1, share_token: null, synth: "NOT_REPORTABLE" },
        };
      if (path.endsWith("/bearer"))
        return {
          status: 200,
          data: { user_id: id(1), access_token: "PRIVATE_TOKEN_NEVER_PERSIST_ME" },
        };
      if (path.startsWith("/api/v1/session/"))
        return {
          status: 200,
          data: {
            status: "completed",
            rounds_completed: options.persistedCount ?? 6,
            is_public: false,
            contract: request.experience ? 1 : undefined,
            result_versions: [{ version: 1, source: "pairings" }],
          },
        };
      throw new Error("unexpected request");
    },
  };
  const run = (approved = true) =>
    runSyntheticJourney({ approved, expectedSha: sha, persona }, http, (p) => checkpoints.push(p));
  return { run, calls, checkpoints };
}
describe("AB-50 fresh synthetic source journey", () => {
  it("requires approval before any request", async () => {
    const f = fake();
    await expect(f.run(false)).rejects.toThrow("approval_required");
    expect(f.calls).toHaveLength(0);
  });
  it("rejects serving drift before mutation", async () => {
    const f = fake({ sha: "b".repeat(40) });
    await expect(f.run()).rejects.toThrow("serving_sha_mismatch");
    expect(f.calls).toHaveLength(1);
  });
  it("never resets or reuses an existing persona", async () => {
    const f = fake({ existing: true });
    await expect(f.run()).rejects.toThrow("persona_not_fresh_or_harness_denied");
    expect(f.calls.some((c) => c.body)).toBe(false);
  });
  it("fails a premature engine stop instead of fabricating six choices", async () => {
    const f = fake({ early: true });
    await expect(f.run()).rejects.toThrow("premature_completion");
    expect(f.calls.some((c) => c.path.endsWith("/choice"))).toBe(false);
  });
  it("does not retry an ambiguously committed choice or finalize it", async () => {
    const f = fake({ lostChoice: true });
    await expect(f.run()).rejects.toThrow();
    expect(f.calls.filter((c) => c.path.endsWith("/choice"))).toHaveLength(1);
    expect(f.calls.some((c) => c.path.endsWith("/reveal"))).toBe(false);
    expect(f.checkpoints.at(-1)?.phase).toBe("choice_started");
  });
  it("requires persisted six-answer proof rather than trusting harness counters", async () => {
    const f = fake({ persistedCount: 5 });
    await expect(f.run()).rejects.toThrow("persisted_six_answers_missing");
  });
  it("retains only IDs/counts and leaves export, feedback and publication untouched", async () => {
    const f = fake();
    const r = await f.run();
    expect(r.answered).toBe(6);
    expect(f.calls).toHaveLength(22);
    expect(f.calls.some((c) => c.path === "/api/public/test/choice")).toBe(false);
    expect(f.calls.some((c) => /reset|share|feedback|learning/.test(c.path))).toBe(false);
    expect(JSON.stringify([r, f.checkpoints])).not.toMatch(/NOT_REPORTABLE|PRIVATE_TOKEN/);
    expect(f.checkpoints.at(-1)?.phase).toBe("journey_passed");
  });
});
