import type { SupabaseClient } from "@supabase/supabase-js";
import { learningDispatchRepository } from "../adapters/learning-dispatch-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import {
  runLearningDispatch,
  classifyDispatch,
  retryAfterSeconds,
  DispatchError,
  type DispatchControl,
  type DispatchRepository,
  type Lease,
} from "./dispatcher";
import { canonicalLearningJson } from "./outbox";
import { learningDispatchTransport } from "../adapters/learning-dispatch-transport";

const envelope = JSON.parse(
  readFileSync("contracts/musicdna-learning/v1/fixtures.json", "utf8"),
).base_envelope;
const body = canonicalLearningJson(envelope),
  id = envelope.metadata.observation.observation_id;
const scope = { source: "music-dna-staging" as const, environment: "staging" as const };
const leased = {
  state: "leased" as const,
  kind: "observation" as const,
  work_id: id,
  lease_token: randomUUID(),
  lease_until: new Date(Date.now() + 90000).toISOString(),
};
const receipt = {
  ok: true,
  event_id: randomUUID(),
  observation_id: id,
  status: "received",
  route: "audit_only",
  duplicate: false,
  agent_job_id: null,
  approval_id: null,
};
const controls: DispatchControl = {
  scope_present: true,
  dispatch_enabled: true,
  capture_enabled: true,
  scope_expired: false,
  halt_reason: null,
  job_counts: {},
  pending_deletions: 0,
  oldest_pending_deletion_seconds: null,
  oldest_observation_pending_seconds: null,
  captured: 0,
  attempts_started: 0,
  cooldown_until: null,
};

describe("dispatch result classification", () => {
  it("requires a matching durable audit-only receipt, not a 2xx dispatch acknowledgement", () => {
    expect(
      classifyDispatch("observation", id, { status: 200, body: receipt, retryAfter: null }, 0),
    ).toEqual({ outcome: "delivered", receipt });
    for (const response of [
      { status: 202, body: receipt },
      { status: 200, body: { ...receipt, observation_id: randomUUID() } },
      { status: 200, body: { ...receipt, route: "agent_queue" } },
      { status: 200, body: { ...receipt, agent_job_id: randomUUID() } },
      { status: 200, body: { ok: true } },
    ])
      expect(
        classifyDispatch("observation", id, { ...response, retryAfter: null }, 0).outcome,
      ).toBe("quarantined");
  });
  it.each([
    [401, "halted", "auth_rejected"],
    [403, "halted", "source_disabled"],
    [404, "halted", "configuration"],
    [409, "quarantined", "observation_conflict"],
    [400, "quarantined", "invalid_payload"],
    [413, "quarantined", "invalid_payload"],
    [429, "retry", "rate_limited"],
    [503, "retry", "server_error"],
    [408, "retry", "timeout"],
  ])("classifies %i without persisting error prose", (status, outcome, failure) => {
    expect(
      classifyDispatch(
        "observation",
        id,
        { status: Number(status), body: { private: "must-not-persist" }, retryAfter: "10" },
        Date.now(),
      ),
    ).toMatchObject({ outcome, failure });
  });
  it("validates completed deletion IDs and preserves pending on an unmatched receipt", () => {
    const value = {
      ok: true,
      deletion_id: id,
      status: "completed",
      completed_at: "2026-11-07T21:00:00.000Z",
      purged_count: 3,
      duplicate: true,
    };
    expect(
      classifyDispatch("deletion", id, { status: 200, body: value, retryAfter: null }, 0),
    ).toEqual({ outcome: "delivered", receipt: value });
    expect(
      classifyDispatch(
        "deletion",
        id,
        { status: 200, body: { ...value, deletion_id: randomUUID() }, retryAfter: null },
        0,
      ),
    ).toMatchObject({ outcome: "quarantined", failure: "invalid_receipt" });
  });
  it("bounds Retry-After numeric/date hints and ignores malformed or past values", () => {
    const now = Date.parse("2026-11-07T21:00:00Z");
    expect(retryAfterSeconds("60", now)).toBe(60);
    expect(retryAfterSeconds("99999999", now)).toBe(3600);
    expect(retryAfterSeconds("Sat, 07 Nov 2026 21:01:00 GMT", now)).toBe(60);
    for (const value of [null, "bad", "-1", "x".repeat(101), "Sat, 07 Nov 2026 20:00:00 GMT"])
      expect(retryAfterSeconds(value, now)).toBe(0);
  });
});
describe("bounded one-run worker use case", () => {
  const status = vi.fn(),
    recoverable = vi.fn(),
    claim = vi.fn(),
    begin = vi.fn(),
    finish = vi.fn(),
    maintain = vi.fn(),
    send = vi.fn(),
    materialize = vi.fn(),
    audit = vi.fn();
  const repository: DispatchRepository = { status, recoverable, claim, begin, finish, maintain };
  let clock = 0;
  const run = (opts: Partial<Parameters<typeof runLearningDispatch>[1]> = {}) =>
    runLearningDispatch(scope, {
      repository,
      transport: { send },
      materialize,
      maxItems: 1,
      now: () => clock,
      delay: async (ms) => {
        clock += ms;
      },
      audit,
      ...opts,
    });
  beforeEach(() => {
    vi.resetAllMocks();
    clock = 0;
    status.mockResolvedValue(structuredClone(controls));
    recoverable.mockResolvedValue([]);
    claim.mockResolvedValue({ state: "idle" });
    begin.mockResolvedValue({
      state: "send",
      body,
      fingerprint: createHash("sha256").update(body).digest("hex"),
    });
    finish.mockResolvedValue({ state: "delivered", receipt_id: receipt.event_id });
    maintain.mockResolvedValue({
      purged_outbox: 0,
      purged_enrollments: 0,
      purged_jobs: 0,
      purged_completed_withdrawals: 0,
    });
    send.mockResolvedValue({ status: 200, body: receipt, retryAfter: null });
    materialize.mockResolvedValue({ state: "pending" });
  });
  it("keeps disabled/unconfigured scopes free of writes, key access and transport", async () => {
    status.mockResolvedValue({ ...controls, dispatch_enabled: false });
    expect(await run()).toMatchObject({ state: "disabled", transport_calls: 0 });
    expect(claim).not.toHaveBeenCalled();
    expect(recoverable).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(maintain).not.toHaveBeenCalled();
  });
  it("retains operator attention for overdue deletion even while dispatch is disabled", async () => {
    status.mockResolvedValue({
      ...controls,
      dispatch_enabled: false,
      pending_deletions: 1,
      oldest_pending_deletion_seconds: 7 * 86400,
    });
    expect(await run()).toMatchObject({ state: "disabled", attention_required: true });
  });
  it("runs explicit maintenance separately without treating queued deletion as completed", async () => {
    status.mockResolvedValue({ ...controls, dispatch_enabled: false });
    maintain.mockResolvedValue({
      purged_outbox: 1,
      purged_enrollments: 1,
      purged_jobs: 0,
      purged_completed_withdrawals: 0,
    });
    expect(await run({ maintenance: true })).toMatchObject({
      state: "disabled",
      maintenance: { purged_outbox: 1 },
      deleted: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });
  it("recovers only bounded captured IDs and counts actual pending materialization", async () => {
    recoverable.mockResolvedValue([id]);
    expect(await run()).toMatchObject({ recovery_calls: 1, materialized: 1 });
    expect(recoverable).toHaveBeenCalledWith(scope, 1);
    materialize.mockResolvedValue({ state: "excluded" });
    expect(await run()).toMatchObject({ recovery_calls: 1, materialized: 0 });
  });
  it("prioritizes unresolved deletion over observation recovery", async () => {
    status.mockResolvedValue({ ...controls, pending_deletions: 1 });
    recoverable.mockResolvedValue([id]);
    await run();
    expect(materialize).not.toHaveBeenCalled();
    expect(claim).toHaveBeenCalled();
  });
  it("never re-materializes while capture is paused or scope expired but can process deletion", async () => {
    status.mockResolvedValue({ ...controls, capture_enabled: false, scope_expired: true });
    await run();
    expect(materialize).not.toHaveBeenCalled();
    expect(claim).toHaveBeenCalled();
  });
  it("sends exact stored canonical bytes and acknowledges only after validation", async () => {
    claim.mockResolvedValue(leased);
    const report = await run();
    expect(report).toMatchObject({ delivered: 1, transport_calls: 1, http_responses: 1 });
    expect(send).toHaveBeenCalledWith(scope, "observation", body);
    expect(finish).toHaveBeenCalledWith(scope, leased, { outcome: "delivered", receipt });
  });
  it("quarantines corrupted/noncanonical payloads before any external request", async () => {
    claim.mockResolvedValue(leased);
    finish.mockResolvedValue({ state: "quarantined" });
    begin.mockResolvedValue({ state: "send", body: body + " ", fingerprint: "bad" });
    expect(await run()).toMatchObject({
      quarantined: 1,
      attention_required: true,
      transport_calls: 0,
    });
    expect(send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(scope, leased, {
      outcome: "quarantined",
      failure: "invalid_payload",
    });
  });
  it("propagates credential configuration failures into durable halt and no false acknowledgement", async () => {
    claim.mockResolvedValue(leased);
    send.mockRejectedValue(new DispatchError("configuration"));
    finish.mockResolvedValue({ state: "halted" });
    expect(await run()).toMatchObject({
      state: "halted",
      attention_required: true,
      delivered: 0,
      http_responses: 0,
    });
    expect(finish).toHaveBeenCalledWith(scope, leased, {
      outcome: "halted",
      failure: "configuration",
    });
  });
  it("retries ambiguous timeout against the same ID and keeps delivery unconfirmed", async () => {
    claim.mockResolvedValue(leased);
    send.mockRejectedValue(new Error("private DNS/key-bearing error"));
    finish.mockResolvedValue({ state: "retry" });
    expect(await run()).toMatchObject({ retry: 1, delivered: 0, http_responses: 0 });
    expect(finish).toHaveBeenCalledWith(scope, leased, { outcome: "retry", failure: "timeout" });
  });
  it("does not claim completion after a successful receiver response but failed local acknowledgement", async () => {
    claim.mockResolvedValue(leased);
    finish.mockRejectedValue(new DispatchError("worker_unavailable"));
    await expect(run()).rejects.toThrow("worker_unavailable");
    expect(audit).not.toHaveBeenCalled();
  });
  it("a stale lease or concurrent withdrawal cannot be marked delivered", async () => {
    claim.mockResolvedValue(leased);
    finish.mockResolvedValue({ state: "cancelled" });
    expect(await run()).toMatchObject({ stale: 1, delivered: 0 });
    begin.mockResolvedValue({ state: "stale" });
    send.mockClear();
    expect(await run()).toMatchObject({ stale: 1, transport_calls: 0 });
    expect(send).not.toHaveBeenCalled();
  });
  it("stops on credential/source halts instead of dispatching another item", async () => {
    claim.mockResolvedValue(leased);
    send.mockResolvedValue({ status: 401, body: null, retryAfter: null });
    finish.mockResolvedValue({ state: "halted" });
    expect(await run({ maxItems: 10 })).toMatchObject({
      state: "halted",
      claimed: 1,
      attention_required: true,
    });
    expect(claim).toHaveBeenCalledTimes(1);
  });
  it("caps item count, deadline and cooldown waits without an infinite retry loop", async () => {
    claim.mockResolvedValue(leased);
    await run({ maxItems: 3 });
    expect(send).toHaveBeenCalledTimes(3);
    claim.mockReset().mockResolvedValue({ state: "rate_limited", retry_after_ms: 300000 });
    expect(await run()).toMatchObject({ state: "backoff", claimed: 0 });
    clock = 0;
    recoverable.mockResolvedValue([id]);
    materialize.mockImplementation(async () => {
      clock = 46000;
      return { state: "pending" };
    });
    claim.mockClear();
    expect(await run()).toMatchObject({ state: "budget_exhausted" });
    expect(claim).not.toHaveBeenCalled();
  });
  it("enforces validated finite batch bounds and sanitized audit records", async () => {
    for (const maxItems of [0, 11, 1.5])
      await expect(run({ maxItems })).rejects.toThrow("configuration");
    claim.mockResolvedValue(leased);
    audit.mockImplementation(() => {
      throw new Error("sink offline");
    });
    expect(await run()).toMatchObject({ delivered: 1 });
    expect(audit.mock.calls[0][0]).toEqual({
      event: "musicdna_learning_dispatch",
      state: "complete",
      attention_required: false,
    });
  });
});
describe("bounded source-key HTTPS transport", () => {
  const keyForScope = vi.fn();
  beforeEach(() => {
    keyForScope.mockReset().mockResolvedValue("synthetic-ingest-key");
  });
  it("uses the scoped key and exact bytes, never follows redirects", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(receipt)));
    const transport = learningDispatchTransport({ fetch, keyForScope });
    await transport.send(scope, "observation", body);
    expect(keyForScope).toHaveBeenCalledWith(scope.source, scope.environment);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body,
      redirect: "error",
      headers: { Authorization: "Bearer synthetic-ingest-key" },
    });
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("targets only the dedicated deletion suffix and keeps error prose unread", async () => {
    const reader = vi.fn();
    const stream = new ReadableStream({
      pull() {
        reader();
      },
    });
    const fetch = vi.fn().mockResolvedValue(new Response(stream, { status: 401 }));
    const transport = learningDispatchTransport({ fetch, keyForScope });
    expect(await transport.send(scope, "deletion", "{}")).toEqual({
      status: 401,
      body: null,
      retryAfter: null,
    });
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/learning\/delete$/);
  });
  it("preserves an authentication failure even when cancelling its error stream fails", async () => {
    const stream = new ReadableStream({
      cancel() {
        throw new Error("private error body failure");
      },
    });
    const transport = learningDispatchTransport({
      fetch: vi.fn().mockResolvedValue(new Response(stream, { status: 401 })),
      keyForScope,
    });
    expect(await transport.send(scope, "observation", body)).toEqual({
      status: 401,
      body: null,
      retryAfter: null,
    });
  });
  it("bounds and validates success response bytes before JSON parsing", async () => {
    for (const text of ["x".repeat(9000), "invalid-json"]) {
      const transport = learningDispatchTransport({
        fetch: vi.fn().mockResolvedValue(new Response(text)),
        keyForScope,
      });
      await expect(transport.send(scope, "observation", body)).rejects.toThrow("invalid_response");
    }
  });
  it("refuses wrong endpoints or missing source credentials without sending", async () => {
    expect(() =>
      learningDispatchTransport({
        endpoint: "http://example.com/functions/v1/app-signal-inbound/learning",
        keyForScope,
      }),
    ).toThrow("configuration");
    const fetch = vi.fn();
    const transport = learningDispatchTransport({ fetch, keyForScope: async () => "" });
    await expect(transport.send(scope, "observation", body)).rejects.toThrow("configuration");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("closed operator metadata projections", () => {
  const clientFor = (data: unknown, error: unknown = null) =>
    ({ rpc: () => ({ abortSignal: async () => ({ data, error }) }) }) as unknown as SupabaseClient;
  it("does not expose unexpected status payloads, identities or secrets", async () => {
    const result = await learningDispatchRepository(
      clientFor({ ...controls, private_payload: "PRIVATE_PAYLOAD", secret: "PRIVATE_KEY" }),
    ).status(scope);
    expect(result).toEqual(controls);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("restricts inspection to safe IDs, counts and timestamps", async () => {
    const row = {
      kind: "observation",
      work_id: id,
      state: "delivered",
      claims: 1,
      attempts: 1,
      next_attempt_at: "2026-11-07T21:00:00.000Z",
      last_attempt_at: null,
      completed_at: "2026-11-07T21:00:00.000Z",
      lease_until: null,
      receipt_id: receipt.event_id,
      last_failure: null,
    };
    const result = await learningDispatchRepository(
      clientFor([{ ...row, lease_token: "PRIVATE_LEASE", canonical_envelope: "PRIVATE_BODY" }]),
    ).inspect(scope, id);
    expect(result).toEqual([row]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("fails unavailable on malformed metadata and masks database error messages", async () => {
    await expect(
      learningDispatchRepository(clientFor({ ...controls, job_counts: { PRIVATE: 1 } })).status(
        scope,
      ),
    ).rejects.toThrow("worker_unavailable");
    await expect(
      learningDispatchRepository(clientFor(null, { message: "PRIVATE_SECRET_ERROR" })).status(
        scope,
      ),
    ).rejects.toThrow("worker_unavailable");
  });
});
