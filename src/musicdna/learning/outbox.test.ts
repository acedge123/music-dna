import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  canonicalLearningJson,
  mapLearningCapture,
  materializeLearningCapture,
  type CaptureRecord,
  type LearningOutboxRepository,
} from "./outbox";
import { learningReferences } from "./references";

const fixture = JSON.parse(
  readFileSync("contracts/musicdna-learning/v1/fixtures.json", "utf8"),
).base_envelope;
function capture(): CaptureRecord {
  const projection = structuredClone(fixture.metadata.observation);
  projection.feedback.ref = null;
  return {
    observationId: projection.observation_id,
    feedbackId: "10000000-0000-4000-8000-000000000001",
    scope: { source: fixture.source, environment: fixture.environment, tenantId: "tenant-a" },
    state: "captured",
    projection,
  };
}
const references = {
  reference: vi.fn().mockResolvedValue(fixture.metadata.observation.feedback.ref),
};
describe("transaction-captured observation mapper", () => {
  it("matches the frozen canonical envelope fixture exactly", async () => {
    expect(await mapLearningCapture(capture(), references)).toEqual(fixture);
  });
  it("does not mutate its frozen input or invent policy/catalog data", async () => {
    const row = capture();
    const before = structuredClone(row);
    const mapped = await mapLearningCapture(row, references);
    expect(row).toEqual(before);
    expect(mapped?.metadata.observation.policy).toEqual(fixture.metadata.observation.policy);
  });
  it.each(["comment", "email", "chat", "share_token", "vector"])(
    "rejects an unexpected captured %s field instead of exporting it",
    async (field) => {
      const row = capture();
      (row.projection as Record<string, unknown>)[field] = "private";
      expect(await mapLearningCapture(row, references)).toBeNull();
    },
  );
  it("rejects wrong observation IDs, real privacy labels, bad source bindings and invalid operation IDs", async () => {
    for (const change of [
      (r: CaptureRecord) => (r.observationId = randomUUID()),
      (r: CaptureRecord) => (r.feedbackId = "raw-private-identifier"),
      (r: CaptureRecord) => (r.scope.environment = "production"),
      (r: CaptureRecord) =>
        ((r.projection as { privacy: { data_class: string } }).privacy.data_class = "real"),
      (r: CaptureRecord) =>
        ((r.projection as { feedback: { ref: string } }).feedback.ref = "f_" + "a".repeat(64)),
    ]) {
      const row = capture();
      change(row);
      expect(await mapLearningCapture(row, references)).toBeNull();
    }
  });
  it("preserves the source observed timestamp and exact committed result version", async () => {
    const row = capture();
    const result = await mapLearningCapture(row, references);
    expect(result?.metadata.observation.observed_at).toBe(fixture.metadata.observation.observed_at);
    expect(result?.metadata.observation.decision).toEqual(fixture.metadata.observation.decision);
  });
  it("rejects invalid generated references without echoing private input", async () => {
    expect(
      await mapLearningCapture(capture(), { reference: async () => "user@example.com" }),
    ).toBeNull();
  });
  it("canonicalizes objects independently from property insertion order", () => {
    expect(canonicalLearningJson({ z: [3, { b: 2, a: 1 }], a: "value" })).toBe(
      '{"a":"value","z":[3,{"a":1,"b":2}]}',
    );
  });
});
describe("recoverable outbox materialization", () => {
  const load = vi.fn(),
    materialize = vi.fn(),
    exclude = vi.fn(),
    audit = vi.fn();
  const repository: LearningOutboxRepository = { load, materialize, exclude };
  beforeEach(() => {
    vi.resetAllMocks();
    references.reference.mockResolvedValue(fixture.metadata.observation.feedback.ref);
    load.mockResolvedValue(capture());
    materialize.mockResolvedValue({
      observation_id: fixture.metadata.observation.observation_id,
      state: "pending",
      duplicate: false,
    });
    exclude.mockResolvedValue({
      observation_id: fixture.metadata.observation.observation_id,
      state: "excluded",
      reason: "invalid_provenance",
    });
  });
  const run = () =>
    materializeLearningCapture(fixture.metadata.observation.observation_id, {
      repository,
      references,
      audit,
    });
  it("materializes the persisted observation ID/content without any HTTP transport", async () => {
    expect(await run()).toMatchObject({ state: "pending" });
    expect(materialize).toHaveBeenCalledWith(
      fixture.metadata.observation.observation_id,
      canonicalLearningJson(fixture),
    );
    expect(exclude).not.toHaveBeenCalled();
  });
  it("marks corrupt provenance explicitly excluded", async () => {
    load.mockResolvedValue({ ...capture(), projection: { unsafe: "private" } });
    expect(await run()).toMatchObject({ state: "excluded" });
    expect(materialize).not.toHaveBeenCalled();
  });
  it.each(["pending", "excluded", "cancelled"])(
    "never remaps a %s row or changes refs on a retry",
    async (state) => {
      load.mockResolvedValue({ ...capture(), state });
      expect(await run()).toMatchObject({ state });
      expect(materialize).not.toHaveBeenCalled();
      expect(references.reference).not.toHaveBeenCalled();
    },
  );
  it("does not report success after a persistence or key-provider failure", async () => {
    materialize.mockRejectedValue(new Error("unavailable"));
    await expect(run()).rejects.toThrow("unavailable");
    expect(audit).not.toHaveBeenCalled();
    materialize.mockReset();
    references.reference.mockRejectedValue(new Error("reference key unavailable"));
    await expect(run()).rejects.toThrow("reference key unavailable");
    expect(exclude).not.toHaveBeenCalled();
  });
  it("keeps audit events bounded and preserves committed state if audit fails", async () => {
    audit.mockImplementation(() => {
      throw new Error("offline sink");
    });
    expect(await run()).toMatchObject({ state: "pending" });
    expect(audit.mock.calls[0][0]).toEqual({
      event: "musicdna_learning_materialization",
      state: "pending",
      duplicate: false,
    });
  });
  it("returns absent for an unavailable/removed observation without creating a replacement ID", async () => {
    load.mockResolvedValue(null);
    expect(await run()).toBeNull();
    expect(materialize).not.toHaveBeenCalled();
  });
});
describe("purpose-scoped enrollment/feedback references", () => {
  const scope = {
    source: "music-dna-staging" as const,
    environment: "staging" as const,
    tenantId: "tenant-a",
  };
  it("is stable and separates tenant, environment, purpose kind and managed-key generation", async () => {
    const refs = learningReferences("synthetic-secret");
    const first = await refs.reference(scope, "subject", "synthetic-id");
    expect(first).toMatch(/^s_[0-9a-f]{64}$/);
    expect(await refs.reference(scope, "subject", "synthetic-id")).toBe(first);
    const values = await Promise.all([
      refs.reference({ ...scope, tenantId: "tenant-b" }, "subject", "synthetic-id"),
      refs.reference(
        { source: "music-dna", environment: "production", tenantId: "tenant-a" },
        "subject",
        "synthetic-id",
      ),
      refs.reference(scope, "feedback", "synthetic-id"),
      learningReferences("rotated-key").reference(scope, "subject", "synthetic-id"),
    ]);
    expect(new Set([first, ...values]).size).toBe(5);
    expect(first).not.toContain("synthetic-id");
  });
  it("requires an injected server secret; it never reads environment credentials", () => {
    expect(() => learningReferences("")).toThrow("outbox_unavailable");
  });
});
