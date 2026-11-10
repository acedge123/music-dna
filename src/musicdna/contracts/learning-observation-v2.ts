/**
 * learning-observation.v2 — portable, dependency-free contract.
 * Canonical owner: acedge123/music-dna. Copies and fixtures are checksum-pinned.
 * This version permits explicitly consented real QA metadata only; it enables no exporter.
 */
export const LEARNING_OBSERVATION_VERSION = "learning-observation.v2" as const;
export const LEARNING_OBSERVATION_MAX_BYTES = 8192;
export const LEARNING_OBSERVATION_SUMMARY = "Music DNA learning observation" as const;

export type MusicDnaLearningObservationV2 = {
  schema_version: typeof LEARNING_OBSERVATION_VERSION;
  observation_id: string;
  observed_at: string;
  subject_ref: string;
  decision: {
    ref: string;
    result_ref: string;
    result_version: number;
    result_source: "pairings" | "chat_self_report";
    answered_count: 6;
  };
  versions: { evidence: string | null; catalog: string | null };
  policy: {
    id: string | null;
    version: string | null;
    recommendation_event_id: string | null;
    experiment_id: string | null;
    variant: "control" | "treatment" | null;
  };
  feedback: {
    ref: string;
    accuracy: "accurate" | "mixed" | "not_accurate" | null;
    rating: -1 | 0 | 1 | null;
  };
  privacy: {
    data_class: "consented_qa";
    purpose: "musicdna_diagnostic_quality";
    consent_basis: "explicit_tester_opt_in";
    policy_version: "real-qa.v1";
  };
};

export type MusicDnaLearningEnvelopeV2 = {
  type: "workflow";
  source: "music-dna";
  environment: "production";
  severity: "low";
  summary: typeof LEARNING_OBSERVATION_SUMMARY;
  correlation_id: string;
  metadata: {
    purpose: "learning_observation";
    observation: MusicDnaLearningObservationV2;
  };
};

export type LearningObservationValidationV2 =
  { ok: true; value: MusicDnaLearningEnvelopeV2 } | { ok: false; errors: string[] };

export type MusicDnaLearningReceiptV2 = {
  ok: true;
  event_id: string;
  observation_id: string;
  duplicate: boolean;
  status: "received";
  route: "audit_only";
  agent_job_id: null;
  approval_id: null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function object(
  value: unknown,
  fields: readonly string[],
  path: string,
  errors: string[],
): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path}: object required`);
    return null;
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !fields.includes(key))) {
    // Never echo an untrusted field name/value into a log or error response.
    errors.push(`${path}: unknown fields`);
  }
  if (fields.some((key) => !Object.hasOwn(record, key))) {
    errors.push(`${path}: missing fields`);
  }
  return record;
}

function oneOf(value: unknown, allowed: readonly unknown[], path: string, errors: string[]): void {
  if (!allowed.includes(value)) errors.push(`${path}: invalid value`);
}

function ref(value: unknown, prefix: string, path: string, errors: string[]): void {
  if (typeof value !== "string" || !new RegExp(`^${prefix}_[0-9a-f]{64}$`).test(value)) {
    errors.push(`${path}: purpose-scoped reference required`);
  }
}

function nullableCode(value: unknown, path: string, errors: string[]): void {
  if (value !== null && (typeof value !== "string" || !CODE.test(value))) {
    errors.push(`${path}: bounded code or null required`);
  }
}

/** Validate the closed envelope; identity/consent still require trusted source authorization. */
export function validateMusicDnaLearningEnvelopeV2(
  value: unknown,
): LearningObservationValidationV2 {
  const errors: string[] = [];
  const envelope = object(
    value,
    ["type", "source", "environment", "severity", "summary", "correlation_id", "metadata"],
    "envelope",
    errors,
  );
  if (!envelope) return { ok: false, errors };
  oneOf(envelope.type, ["workflow"], "envelope.type", errors);
  oneOf(envelope.source, ["music-dna"], "envelope.source", errors);
  oneOf(envelope.environment, ["production"], "envelope.environment", errors);
  if (
    (envelope.source === "music-dna-staging" && envelope.environment !== "staging") ||
    (envelope.source === "music-dna" && envelope.environment !== "production")
  ) {
    errors.push("envelope: source/environment mismatch");
  }
  oneOf(envelope.severity, ["low"], "envelope.severity", errors);
  oneOf(envelope.summary, [LEARNING_OBSERVATION_SUMMARY], "envelope.summary", errors);
  const metadata = object(envelope.metadata, ["purpose", "observation"], "metadata", errors);
  if (!metadata) return { ok: false, errors };
  oneOf(metadata.purpose, ["learning_observation"], "metadata.purpose", errors);
  const observation = object(
    metadata.observation,
    [
      "schema_version",
      "observation_id",
      "observed_at",
      "subject_ref",
      "decision",
      "versions",
      "policy",
      "feedback",
      "privacy",
    ],
    "observation",
    errors,
  );
  if (!observation) return { ok: false, errors };
  oneOf(
    observation.schema_version,
    [LEARNING_OBSERVATION_VERSION],
    "observation.schema_version",
    errors,
  );
  const validObservationId =
    typeof observation.observation_id === "string" && UUID.test(observation.observation_id);
  if (!validObservationId) {
    errors.push("observation.observation_id: UUID required");
  }
  if (
    !validObservationId ||
    envelope.correlation_id !== `music-dna:learning:v2:${observation.observation_id}`
  ) {
    errors.push("envelope.correlation_id: observation ID mismatch");
  }
  if (
    typeof observation.observed_at !== "string" ||
    !Number.isFinite(Date.parse(observation.observed_at)) ||
    new Date(observation.observed_at).toISOString() !== observation.observed_at
  ) {
    errors.push("observation.observed_at: canonical UTC timestamp required");
  }
  ref(observation.subject_ref, "s", "observation.subject_ref", errors);
  const decision = object(
    observation.decision,
    ["ref", "result_ref", "result_version", "result_source", "answered_count"],
    "decision",
    errors,
  );
  if (decision) {
    ref(decision.ref, "d", "decision.ref", errors);
    ref(decision.result_ref, "r", "decision.result_ref", errors);
    if (!Number.isSafeInteger(decision.result_version) || Number(decision.result_version) < 1) {
      errors.push("decision.result_version: positive safe integer required");
    }
    oneOf(
      decision.result_source,
      ["pairings", "chat_self_report"],
      "decision.result_source",
      errors,
    );
    oneOf(decision.answered_count, [6], "decision.answered_count", errors);
  }
  const versions = object(observation.versions, ["evidence", "catalog"], "versions", errors);
  if (versions) {
    nullableCode(versions.evidence, "versions.evidence", errors);
    nullableCode(versions.catalog, "versions.catalog", errors);
  }
  const policy = object(
    observation.policy,
    ["id", "version", "recommendation_event_id", "experiment_id", "variant"],
    "policy",
    errors,
  );
  if (policy) {
    for (const key of ["id", "version", "recommendation_event_id", "experiment_id"]) {
      nullableCode(policy[key], `policy.${key}`, errors);
    }
    oneOf(policy.variant, ["control", "treatment", null], "policy.variant", errors);
    if ((policy.id === null) !== (policy.version === null))
      errors.push("policy: ID/version must be known together");
    if ((policy.experiment_id === null) !== (policy.variant === null))
      errors.push("policy: experiment/variant must be known together");
    if (
      policy.recommendation_event_id !== null &&
      (policy.id === null || policy.version === null)
    ) {
      errors.push("policy: recommendation attribution requires actual policy ID/version");
    }
  }
  const feedback = object(observation.feedback, ["ref", "accuracy", "rating"], "feedback", errors);
  if (feedback) {
    ref(feedback.ref, "f", "feedback.ref", errors);
    oneOf(
      feedback.accuracy,
      ["accurate", "mixed", "not_accurate", null],
      "feedback.accuracy",
      errors,
    );
    oneOf(feedback.rating, [-1, 0, 1, null], "feedback.rating", errors);
    if (feedback.accuracy === null && feedback.rating === null)
      errors.push("feedback: explicit enum/rating required");
  }
  const privacy = object(
    observation.privacy,
    ["data_class", "purpose", "consent_basis", "policy_version"],
    "privacy",
    errors,
  );
  if (privacy) {
    oneOf(privacy.data_class, ["consented_qa"], "privacy.data_class", errors);
    oneOf(privacy.purpose, ["musicdna_diagnostic_quality"], "privacy.purpose", errors);
    oneOf(privacy.consent_basis, ["explicit_tester_opt_in"], "privacy.consent_basis", errors);
    oneOf(privacy.policy_version, ["real-qa.v1"], "privacy.policy_version", errors);
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: value as MusicDnaLearningEnvelopeV2 };
}

/** A dispatcher may acknowledge only the durable receipt for its own observation. */
export function validateMusicDnaLearningReceiptV2(
  value: unknown,
  expectedObservationId: string,
): { ok: true; value: MusicDnaLearningReceiptV2 } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const receipt = object(
    value,
    [
      "ok",
      "event_id",
      "observation_id",
      "duplicate",
      "status",
      "route",
      "agent_job_id",
      "approval_id",
    ],
    "receipt",
    errors,
  );
  if (!receipt) return { ok: false, errors };
  oneOf(receipt.ok, [true], "receipt.ok", errors);
  for (const field of ["event_id", "observation_id"]) {
    if (typeof receipt[field] !== "string" || !UUID.test(receipt[field] as string))
      errors.push(`receipt.${field}: UUID required`);
  }
  if (
    typeof expectedObservationId !== "string" ||
    !UUID.test(expectedObservationId) ||
    receipt.observation_id !== expectedObservationId
  )
    errors.push("receipt: observation ID mismatch");
  oneOf(receipt.duplicate, [true, false], "receipt.duplicate", errors);
  oneOf(receipt.status, ["received"], "receipt.status", errors);
  oneOf(receipt.route, ["audit_only"], "receipt.route", errors);
  oneOf(receipt.agent_job_id, [null], "receipt.agent_job_id", errors);
  oneOf(receipt.approval_id, [null], "receipt.approval_id", errors);
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: value as MusicDnaLearningReceiptV2 };
}
