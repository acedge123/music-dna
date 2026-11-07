import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deliverLearningWithdrawal,
  type DeletionTask,
  type WithdrawalRepository,
} from "./withdrawal";
import { learningDeletionTransport } from "../adapters/learning-withdrawal";

const task: DeletionTask = {
  source: "music-dna-staging",
  environment: "staging",
  subject_ref: "s_" + "a".repeat(64),
  deletion_id: "10000000-0000-4000-8000-000000000001",
  reason: "withdrawal",
};
const scope = { source: task.source, environment: task.environment, deletionId: task.deletion_id };
const receipt = {
  ok: true,
  deletion_id: task.deletion_id,
  status: "completed",
  completed_at: "2026-11-07T20:00:00.000Z",
  purged_count: 2,
  duplicate: false,
};
describe("durable withdrawal delivery use case", () => {
  const pending = vi.fn();
  const finish = vi.fn();
  const send = vi.fn();
  const repo: WithdrawalRepository = { pending, finish };
  beforeEach(() => {
    vi.resetAllMocks();
    pending.mockResolvedValue(task);
    finish.mockResolvedValue(undefined);
    send.mockResolvedValue({ status: 200, body: receipt });
  });
  it("acks only a matching durable receiver completion", async () => {
    expect(await deliverLearningWithdrawal(scope, repo, { send })).toBe("completed");
    expect(finish).toHaveBeenCalledWith(task, { receipt });
  });
  it("leaves an offline receiver pending and retries the identical deletion ID", async () => {
    send.mockRejectedValueOnce(new Error("offline"));
    expect(await deliverLearningWithdrawal(scope, repo, { send })).toBe("pending");
    expect(finish).toHaveBeenLastCalledWith(task, { failure: "unavailable" });
    send.mockResolvedValue({ status: 200, body: { ...receipt, duplicate: true } });
    expect(await deliverLearningWithdrawal(scope, repo, { send })).toBe("completed");
    expect(send.mock.calls.map((c) => c[0].deletion_id)).toEqual([
      task.deletion_id,
      task.deletion_id,
    ]);
  });
  it.each([
    { status: 202, body: receipt },
    { status: 200, body: { ...receipt, status: "pending" } },
    { status: 200, body: { ...receipt, deletion_id: "wrong" } },
    { status: 200, body: { ...receipt, purged_count: -1 } },
    { status: 200, body: null },
    { status: 401, body: { ok: false } },
    { status: 503, body: { ok: false } },
  ])("never mistakes dispatch for completion: %j", async (response) => {
    send.mockResolvedValue(response);
    expect(await deliverLearningWithdrawal(scope, repo, { send })).toBe("pending");
    expect(finish).toHaveBeenCalledWith(task, {
      failure: response.status >= 500 ? "unavailable" : "rejected",
    });
  });
  it("does not send a missing/already completed task", async () => {
    pending.mockResolvedValue(null);
    expect(await deliverLearningWithdrawal(scope, repo, { send })).toBe(
      "already_completed_or_missing",
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("reports no completion if local acknowledgement persistence fails", async () => {
    finish.mockRejectedValue(new Error("storage unavailable"));
    await expect(deliverLearningWithdrawal(scope, repo, { send })).rejects.toThrow(
      "storage unavailable",
    );
  });
});
describe("source-scoped deletion transport", () => {
  const endpoint = "https://synthetic.supabase.co/functions/v1/app-signal-inbound/learning/delete";
  it("sends only the closed lifecycle DTO with the injected scope key and redirect/timeout protection", async () => {
    const run = vi.fn().mockResolvedValue(new Response(JSON.stringify(receipt)));
    const keyForScope = vi.fn().mockResolvedValue("synthetic-key");
    const transport = learningDeletionTransport({ endpoint, keyForScope, fetch: run });
    expect(await transport.send(task)).toEqual({ status: 200, body: receipt });
    expect(keyForScope).toHaveBeenCalledWith(task.source, task.environment);
    const init = run.mock.calls[0][1];
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({ schema_version: "learning-deletion.v1", ...task });
  });
  it("does not transmit unexpected private fields on an internal task", async () => {
    const run = vi.fn().mockResolvedValue(new Response(JSON.stringify(receipt)));
    const transport = learningDeletionTransport({
      endpoint,
      keyForScope: async () => "synthetic-key",
      fetch: run,
    });
    await transport.send({ ...task, ...{ private_payload: "must-stay-local" } });
    expect(run.mock.calls[0][1].body).not.toContain("must-stay-local");
    expect(JSON.parse(run.mock.calls[0][1].body)).toEqual({
      schema_version: "learning-deletion.v1",
      ...task,
    });
  });
  it("rejects credential-bearing/non-HTTPS/wrong-path endpoints", () => {
    for (const url of [
      "http://example.com/functions/v1/app-signal-inbound/learning/delete",
      endpoint + "?token=x",
      endpoint.replace("https://", "https://user:pass@"),
      endpoint + "/other",
    ])
      expect(() =>
        learningDeletionTransport({ endpoint: url, keyForScope: async () => "" }),
      ).toThrow();
  });
  it("refuses oversized responses instead of retaining arbitrary error prose", async () => {
    const transport = learningDeletionTransport({
      endpoint,
      keyForScope: async () => "key",
      fetch: vi.fn().mockResolvedValue(new Response("x".repeat(9000))),
    });
    await expect(transport.send(task)).rejects.toThrow("invalid_deletion_receipt");
  });
});
