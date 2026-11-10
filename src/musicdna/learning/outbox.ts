import {
  LEARNING_OBSERVATION_MAX_BYTES,
  LEARNING_OBSERVATION_SUMMARY,
  validateMusicDnaLearningEnvelope,
  type MusicDnaLearningEnvelope,
} from "../contracts/learning-observation";

export type LearningScope = {
  source: "music-dna" | "music-dna-staging";
  environment: "production" | "staging";
  tenantId: string;
};
export type CaptureRecord = {
  observationId: string;
  feedbackId: string;
  scope: LearningScope;
  state: "captured" | "pending" | "excluded" | "cancelled";
  projection: unknown;
};
export type MaterializationReceipt = {
  observation_id: string;
  state: CaptureRecord["state"];
  reason?:
    "missing_provenance" | "invalid_provenance" | "empty_feedback" | "scope_closed" | "withdrawn";
  duplicate?: boolean;
};
export interface LearningOutboxRepository {
  load(id: string): Promise<CaptureRecord | null>;
  materialize(id: string, canonical: string): Promise<MaterializationReceipt>;
  exclude(id: string): Promise<MaterializationReceipt>;
}
export interface LearningReferences {
  reference(
    scope: LearningScope,
    kind: "subject" | "decision" | "result" | "feedback",
    internalId: string,
  ): Promise<string>;
}
export class LearningOutboxError extends Error {
  constructor(readonly code: "outbox_unavailable" | "observation_conflict" | "invalid_capture") {
    super(code);
  }
}
/** Canonical algorithm shared by the frozen receiver protocol; keys are ASCII. */
export function canonicalLearningJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalLearningJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalLearningJson(record[key])}`)
      .join(",")}}`;
  }
  const scalar = JSON.stringify(value);
  if (scalar === undefined) throw new LearningOutboxError("invalid_capture");
  return scalar;
}
function safeScope(scope: LearningScope): boolean {
  return (
    ((scope.source === "music-dna-staging" && scope.environment === "staging") ||
      (scope.source === "music-dna" && scope.environment === "production")) &&
    typeof scope.tenantId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(scope.tenantId)
  );
}
/** Maps ONLY a transaction-captured projection. It never queries live catalog/results. */
export async function mapLearningCapture(
  record: CaptureRecord,
  references: LearningReferences,
): Promise<MusicDnaLearningEnvelope | null> {
  if (
    !safeScope(record.scope) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      record.feedbackId,
    )
  )
    return null;
  const value = structuredClone(record.projection);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const observation = value as Record<string, unknown>;
  if (
    observation.observation_id !== record.observationId ||
    !observation.feedback ||
    typeof observation.feedback !== "object" ||
    Array.isArray(observation.feedback)
  )
    return null;
  const feedback = observation.feedback as Record<string, unknown>;
  if (feedback.ref !== null) return null;
  feedback.ref = await references.reference(record.scope, "feedback", record.feedbackId);
  const envelope = {
    type: "workflow",
    source: record.scope.source,
    environment: record.scope.environment,
    severity: "low",
    summary: LEARNING_OBSERVATION_SUMMARY,
    correlation_id:
      "music-dna:learning:" +
      (observation.schema_version === "learning-observation.v2" ? "v2:" : "v1:") +
      record.observationId,
    metadata: { purpose: "learning_observation", observation },
  };
  const result = validateMusicDnaLearningEnvelope(envelope);
  if (
    !result.ok ||
    new TextEncoder().encode(JSON.stringify(envelope)).byteLength > LEARNING_OBSERVATION_MAX_BYTES
  )
    return null;
  return result.value;
}
/** Durable capture survives a crash before this function runs. No transport I/O. */
export async function materializeLearningCapture(
  id: string,
  deps: {
    repository: LearningOutboxRepository;
    references: LearningReferences;
    audit?: (event: {
      event: "musicdna_learning_materialization";
      state: MaterializationReceipt["state"];
      duplicate?: boolean;
    }) => void;
  },
): Promise<MaterializationReceipt | null> {
  const record = await deps.repository.load(id);
  if (!record) return null;
  if (record.state !== "captured")
    return { observation_id: record.observationId, state: record.state };
  const envelope = await mapLearningCapture(record, deps.references);
  const result = envelope
    ? await deps.repository.materialize(id, canonicalLearningJson(envelope))
    : await deps.repository.exclude(id);
  // A secondary audit sink cannot undo a durable DB result. Never log payloads,
  // internal IDs, pseudonymous references, credentials, free text or DB errors.
  try {
    deps.audit?.({
      event: "musicdna_learning_materialization",
      state: result.state,
      ...(result.duplicate !== undefined ? { duplicate: result.duplicate } : {}),
    });
  } catch {
    /* durable state remains authoritative */
  }
  return result;
}
