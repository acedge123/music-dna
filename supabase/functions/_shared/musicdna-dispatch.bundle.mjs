const LEARNING_OBSERVATION_VERSION$1 = "learning-observation.v1";
const LEARNING_OBSERVATION_MAX_BYTES = 8192;
const LEARNING_OBSERVATION_SUMMARY$1 = "Music DNA learning observation";
const UUID$1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODE$1 = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
function object$1(value, fields, path, errors) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path}: object required`);
    return null;
  }
  const record2 = value;
  if (Object.keys(record2).some((key) => !fields.includes(key))) {
    errors.push(`${path}: unknown fields`);
  }
  if (fields.some((key) => !Object.hasOwn(record2, key))) {
    errors.push(`${path}: missing fields`);
  }
  return record2;
}
function oneOf$1(value, allowed, path, errors) {
  if (!allowed.includes(value)) errors.push(`${path}: invalid value`);
}
function ref$1(value, prefix, path, errors) {
  if (typeof value !== "string" || !new RegExp(`^${prefix}_[0-9a-f]{64}$`).test(value)) {
    errors.push(`${path}: purpose-scoped reference required`);
  }
}
function nullableCode$1(value, path, errors) {
  if (value !== null && (typeof value !== "string" || !CODE$1.test(value))) {
    errors.push(`${path}: bounded code or null required`);
  }
}
function validateMusicDnaLearningEnvelopeV1(value) {
  const errors = [];
  const envelope = object$1(
    value,
    ["type", "source", "environment", "severity", "summary", "correlation_id", "metadata"],
    "envelope",
    errors
  );
  if (!envelope) return { ok: false, errors };
  oneOf$1(envelope.type, ["workflow"], "envelope.type", errors);
  oneOf$1(envelope.source, ["music-dna-staging", "music-dna"], "envelope.source", errors);
  oneOf$1(envelope.environment, ["staging", "production"], "envelope.environment", errors);
  if (envelope.source === "music-dna-staging" && envelope.environment !== "staging" || envelope.source === "music-dna" && envelope.environment !== "production") {
    errors.push("envelope: source/environment mismatch");
  }
  oneOf$1(envelope.severity, ["low"], "envelope.severity", errors);
  oneOf$1(envelope.summary, [LEARNING_OBSERVATION_SUMMARY$1], "envelope.summary", errors);
  const metadata = object$1(envelope.metadata, ["purpose", "observation"], "metadata", errors);
  if (!metadata) return { ok: false, errors };
  oneOf$1(metadata.purpose, ["learning_observation"], "metadata.purpose", errors);
  const observation = object$1(
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
      "privacy"
    ],
    "observation",
    errors
  );
  if (!observation) return { ok: false, errors };
  oneOf$1(
    observation.schema_version,
    [LEARNING_OBSERVATION_VERSION$1],
    "observation.schema_version",
    errors
  );
  const validObservationId = typeof observation.observation_id === "string" && UUID$1.test(observation.observation_id);
  if (!validObservationId) {
    errors.push("observation.observation_id: UUID required");
  }
  if (!validObservationId || envelope.correlation_id !== `music-dna:learning:v1:${observation.observation_id}`) {
    errors.push("envelope.correlation_id: observation ID mismatch");
  }
  if (typeof observation.observed_at !== "string" || !Number.isFinite(Date.parse(observation.observed_at)) || new Date(observation.observed_at).toISOString() !== observation.observed_at) {
    errors.push("observation.observed_at: canonical UTC timestamp required");
  }
  ref$1(observation.subject_ref, "s", "observation.subject_ref", errors);
  const decision = object$1(
    observation.decision,
    ["ref", "result_ref", "result_version", "result_source", "answered_count"],
    "decision",
    errors
  );
  if (decision) {
    ref$1(decision.ref, "d", "decision.ref", errors);
    ref$1(decision.result_ref, "r", "decision.result_ref", errors);
    if (!Number.isSafeInteger(decision.result_version) || Number(decision.result_version) < 1) {
      errors.push("decision.result_version: positive safe integer required");
    }
    oneOf$1(
      decision.result_source,
      ["pairings", "chat_self_report"],
      "decision.result_source",
      errors
    );
    oneOf$1(decision.answered_count, [6], "decision.answered_count", errors);
  }
  const versions = object$1(observation.versions, ["evidence", "catalog"], "versions", errors);
  if (versions) {
    nullableCode$1(versions.evidence, "versions.evidence", errors);
    nullableCode$1(versions.catalog, "versions.catalog", errors);
  }
  const policy = object$1(
    observation.policy,
    ["id", "version", "recommendation_event_id", "experiment_id", "variant"],
    "policy",
    errors
  );
  if (policy) {
    for (const key of ["id", "version", "recommendation_event_id", "experiment_id"]) {
      nullableCode$1(policy[key], `policy.${key}`, errors);
    }
    oneOf$1(policy.variant, ["control", "treatment", null], "policy.variant", errors);
    if (policy.id === null !== (policy.version === null))
      errors.push("policy: ID/version must be known together");
    if (policy.experiment_id === null !== (policy.variant === null))
      errors.push("policy: experiment/variant must be known together");
    if (policy.recommendation_event_id !== null && (policy.id === null || policy.version === null)) {
      errors.push("policy: recommendation attribution requires actual policy ID/version");
    }
  }
  const feedback = object$1(observation.feedback, ["ref", "accuracy", "rating"], "feedback", errors);
  if (feedback) {
    ref$1(feedback.ref, "f", "feedback.ref", errors);
    oneOf$1(
      feedback.accuracy,
      ["accurate", "mixed", "not_accurate", null],
      "feedback.accuracy",
      errors
    );
    oneOf$1(feedback.rating, [-1, 0, 1, null], "feedback.rating", errors);
    if (feedback.accuracy === null && feedback.rating === null)
      errors.push("feedback: explicit enum/rating required");
  }
  const privacy = object$1(
    observation.privacy,
    ["data_class", "purpose", "consent_basis", "policy_version"],
    "privacy",
    errors
  );
  if (privacy) {
    oneOf$1(privacy.data_class, ["synthetic"], "privacy.data_class", errors);
    oneOf$1(privacy.purpose, ["musicdna_diagnostic_quality"], "privacy.purpose", errors);
    oneOf$1(privacy.consent_basis, ["authorized_synthetic_test"], "privacy.consent_basis", errors);
    oneOf$1(privacy.policy_version, ["synthetic-pilot.v1"], "privacy.policy_version", errors);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
function validateMusicDnaLearningReceiptV1(value, expectedObservationId) {
  const errors = [];
  const receipt = object$1(
    value,
    [
      "ok",
      "event_id",
      "observation_id",
      "duplicate",
      "status",
      "route",
      "agent_job_id",
      "approval_id"
    ],
    "receipt",
    errors
  );
  if (!receipt) return { ok: false, errors };
  oneOf$1(receipt.ok, [true], "receipt.ok", errors);
  for (const field of ["event_id", "observation_id"]) {
    if (typeof receipt[field] !== "string" || !UUID$1.test(receipt[field]))
      errors.push(`receipt.${field}: UUID required`);
  }
  if (typeof expectedObservationId !== "string" || !UUID$1.test(expectedObservationId) || receipt.observation_id !== expectedObservationId)
    errors.push("receipt: observation ID mismatch");
  oneOf$1(receipt.duplicate, [true, false], "receipt.duplicate", errors);
  oneOf$1(receipt.status, ["received"], "receipt.status", errors);
  oneOf$1(receipt.route, ["audit_only"], "receipt.route", errors);
  oneOf$1(receipt.agent_job_id, [null], "receipt.agent_job_id", errors);
  oneOf$1(receipt.approval_id, [null], "receipt.approval_id", errors);
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
const LEARNING_OBSERVATION_VERSION = "learning-observation.v2";
const LEARNING_OBSERVATION_SUMMARY = "Music DNA learning observation";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
function object(value, fields, path, errors) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path}: object required`);
    return null;
  }
  const record2 = value;
  if (Object.keys(record2).some((key) => !fields.includes(key))) {
    errors.push(`${path}: unknown fields`);
  }
  if (fields.some((key) => !Object.hasOwn(record2, key))) {
    errors.push(`${path}: missing fields`);
  }
  return record2;
}
function oneOf(value, allowed, path, errors) {
  if (!allowed.includes(value)) errors.push(`${path}: invalid value`);
}
function ref(value, prefix, path, errors) {
  if (typeof value !== "string" || !new RegExp(`^${prefix}_[0-9a-f]{64}$`).test(value)) {
    errors.push(`${path}: purpose-scoped reference required`);
  }
}
function nullableCode(value, path, errors) {
  if (value !== null && (typeof value !== "string" || !CODE.test(value))) {
    errors.push(`${path}: bounded code or null required`);
  }
}
function validateMusicDnaLearningEnvelopeV2(value) {
  const errors = [];
  const envelope = object(
    value,
    ["type", "source", "environment", "severity", "summary", "correlation_id", "metadata"],
    "envelope",
    errors
  );
  if (!envelope) return { ok: false, errors };
  oneOf(envelope.type, ["workflow"], "envelope.type", errors);
  oneOf(envelope.source, ["music-dna"], "envelope.source", errors);
  oneOf(envelope.environment, ["production"], "envelope.environment", errors);
  if (envelope.source === "music-dna-staging" && envelope.environment !== "staging" || envelope.source === "music-dna" && envelope.environment !== "production") {
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
      "privacy"
    ],
    "observation",
    errors
  );
  if (!observation) return { ok: false, errors };
  oneOf(
    observation.schema_version,
    [LEARNING_OBSERVATION_VERSION],
    "observation.schema_version",
    errors
  );
  const validObservationId = typeof observation.observation_id === "string" && UUID.test(observation.observation_id);
  if (!validObservationId) {
    errors.push("observation.observation_id: UUID required");
  }
  if (!validObservationId || envelope.correlation_id !== `music-dna:learning:v2:${observation.observation_id}`) {
    errors.push("envelope.correlation_id: observation ID mismatch");
  }
  if (typeof observation.observed_at !== "string" || !Number.isFinite(Date.parse(observation.observed_at)) || new Date(observation.observed_at).toISOString() !== observation.observed_at) {
    errors.push("observation.observed_at: canonical UTC timestamp required");
  }
  ref(observation.subject_ref, "s", "observation.subject_ref", errors);
  const decision = object(
    observation.decision,
    ["ref", "result_ref", "result_version", "result_source", "answered_count"],
    "decision",
    errors
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
      errors
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
    errors
  );
  if (policy) {
    for (const key of ["id", "version", "recommendation_event_id", "experiment_id"]) {
      nullableCode(policy[key], `policy.${key}`, errors);
    }
    oneOf(policy.variant, ["control", "treatment", null], "policy.variant", errors);
    if (policy.id === null !== (policy.version === null))
      errors.push("policy: ID/version must be known together");
    if (policy.experiment_id === null !== (policy.variant === null))
      errors.push("policy: experiment/variant must be known together");
    if (policy.recommendation_event_id !== null && (policy.id === null || policy.version === null)) {
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
      errors
    );
    oneOf(feedback.rating, [-1, 0, 1, null], "feedback.rating", errors);
    if (feedback.accuracy === null && feedback.rating === null)
      errors.push("feedback: explicit enum/rating required");
  }
  const privacy = object(
    observation.privacy,
    ["data_class", "purpose", "consent_basis", "policy_version"],
    "privacy",
    errors
  );
  if (privacy) {
    oneOf(privacy.data_class, ["consented_qa"], "privacy.data_class", errors);
    oneOf(privacy.purpose, ["musicdna_diagnostic_quality"], "privacy.purpose", errors);
    oneOf(privacy.consent_basis, ["explicit_tester_opt_in"], "privacy.consent_basis", errors);
    oneOf(privacy.policy_version, ["real-qa.v1"], "privacy.policy_version", errors);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
function validateMusicDnaLearningEnvelope(value) {
  const legacy = validateMusicDnaLearningEnvelopeV1(value);
  if (legacy.ok) return legacy;
  return validateMusicDnaLearningEnvelopeV2(value);
}
const uuid$1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validateLearningDeletionV1(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value;
  if (Object.keys(b).sort().join(",") !== "deletion_id,environment,reason,schema_version,source,subject_ref" || b.schema_version !== "learning-deletion.v1" || !(b.source === "music-dna-staging" && b.environment === "staging" || b.source === "music-dna" && b.environment === "production") || typeof b.subject_ref !== "string" || !/^s_[0-9a-f]{64}$/.test(b.subject_ref) || typeof b.deletion_id !== "string" || !uuid$1.test(b.deletion_id) || !["withdrawal", "deletion", "retention"].includes(String(b.reason))) return null;
  return b;
}
function validateLearningDeletionReceiptV1(value, expectedId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value;
  if (r.ok !== true || r.status !== "completed" || typeof r.deletion_id !== "string" || !uuid$1.test(r.deletion_id) || expectedId !== void 0 && r.deletion_id !== expectedId || typeof r.completed_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(r.completed_at) || !Number.isFinite(Date.parse(r.completed_at)) || !Number.isSafeInteger(r.purged_count) || r.purged_count < 0 || typeof r.duplicate !== "boolean") return null;
  return {
    ok: true,
    deletion_id: r.deletion_id,
    status: "completed",
    completed_at: r.completed_at,
    purged_count: r.purged_count,
    duplicate: r.duplicate
  };
}
class LearningOutboxError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
  code;
}
function canonicalLearningJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalLearningJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record2 = value;
    return `{${Object.keys(record2).sort().map((key) => `${JSON.stringify(key)}:${canonicalLearningJson(record2[key])}`).join(",")}}`;
  }
  const scalar = JSON.stringify(value);
  if (scalar === void 0) throw new LearningOutboxError("invalid_capture");
  return scalar;
}
function safeScope(scope) {
  return (scope.source === "music-dna-staging" && scope.environment === "staging" || scope.source === "music-dna" && scope.environment === "production") && typeof scope.tenantId === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(scope.tenantId);
}
async function mapLearningCapture(record2, references) {
  if (!safeScope(record2.scope) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    record2.feedbackId
  ))
    return null;
  const value = structuredClone(record2.projection);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const observation = value;
  if (observation.observation_id !== record2.observationId || !observation.feedback || typeof observation.feedback !== "object" || Array.isArray(observation.feedback))
    return null;
  const feedback = observation.feedback;
  if (feedback.ref !== null) return null;
  feedback.ref = await references.reference(record2.scope, "feedback", record2.feedbackId);
  const envelope = {
    type: "workflow",
    source: record2.scope.source,
    environment: record2.scope.environment,
    severity: "low",
    summary: LEARNING_OBSERVATION_SUMMARY$1,
    correlation_id: "music-dna:learning:" + (observation.schema_version === "learning-observation.v2" ? "v2:" : "v1:") + record2.observationId,
    metadata: { purpose: "learning_observation", observation }
  };
  const result = validateMusicDnaLearningEnvelope(envelope);
  if (!result.ok || new TextEncoder().encode(JSON.stringify(envelope)).byteLength > LEARNING_OBSERVATION_MAX_BYTES)
    return null;
  return result.value;
}
async function materializeLearningCapture(id, deps) {
  const record2 = await deps.repository.load(id);
  if (!record2) return null;
  if (record2.state !== "captured")
    return { observation_id: record2.observationId, state: record2.state };
  const envelope = await mapLearningCapture(record2, deps.references);
  const result = envelope ? await deps.repository.materialize(id, canonicalLearningJson(envelope)) : await deps.repository.exclude(id);
  try {
    deps.audit?.({
      event: "musicdna_learning_materialization",
      state: result.state,
      ...result.duplicate !== void 0 ? { duplicate: result.duplicate } : {}
    });
  } catch {
  }
  return result;
}
class DispatchError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
  code;
}
function retryAfterSeconds(header, now) {
  if (!header || header.length > 100) return 0;
  const seconds = /^\d+$/.test(header.trim()) ? Number(header) : Math.ceil((Date.parse(header) - now) / 1e3);
  return Number.isFinite(seconds) ? Math.max(0, Math.min(3600, seconds)) : 0;
}
function classifyDispatch(kind, id, response, now) {
  if (response.status === 200) {
    const valid = kind === "observation" ? validateMusicDnaLearningReceiptV1(response.body, id) : null;
    const receipt = kind === "deletion" ? validateLearningDeletionReceiptV1(response.body, id) : valid?.ok ? valid.value : null;
    return receipt ? { outcome: "delivered", receipt } : { outcome: "quarantined", failure: "invalid_receipt" };
  }
  if (response.status === 401) return { outcome: "halted", failure: "auth_rejected" };
  if (response.status === 403) return { outcome: "halted", failure: "source_disabled" };
  if ([404, 405, 410].includes(response.status))
    return { outcome: "halted", failure: "configuration" };
  if (response.status === 409) return { outcome: "quarantined", failure: "observation_conflict" };
  if (response.status === 429)
    return {
      outcome: "retry",
      failure: "rate_limited",
      retryAfterSeconds: retryAfterSeconds(response.retryAfter, now)
    };
  if (response.status === 408 || response.status >= 500)
    return {
      outcome: "retry",
      failure: response.status === 408 ? "timeout" : "server_error",
      retryAfterSeconds: retryAfterSeconds(response.retryAfter, now)
    };
  return { outcome: "quarantined", failure: "invalid_payload" };
}
async function validOutgoing(scope, lease, value) {
  if (new TextEncoder().encode(value.body).byteLength > 8192) return false;
  let decoded;
  try {
    decoded = JSON.parse(value.body);
  } catch {
    return false;
  }
  if (lease.kind === "deletion") {
    const parsed2 = validateLearningDeletionV1(decoded);
    return !!parsed2 && parsed2.source === scope.source && parsed2.environment === scope.environment && parsed2.deletion_id === lease.work_id;
  }
  const parsed = validateMusicDnaLearningEnvelope(decoded);
  if (!parsed.ok || parsed.value.source !== scope.source || parsed.value.environment !== scope.environment || parsed.value.metadata.observation.observation_id !== lease.work_id || canonicalLearningJson(parsed.value) !== value.body)
    return false;
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.body))
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("") === value.fingerprint;
}
async function runLearningDispatch(scope, deps) {
  const max = deps.maxItems ?? 5;
  if (!Number.isInteger(max) || max < 1 || max > 10) throw new DispatchError("configuration");
  const now = deps.now ?? Date.now, delay = deps.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const start = now();
  const summary = {
    state: "idle",
    claimed: 0,
    attempts_started: 0,
    transport_calls: 0,
    http_responses: 0,
    delivered: 0,
    deleted: 0,
    retry: 0,
    quarantined: 0,
    stale: 0,
    materialized: 0,
    recovery_calls: 0,
    attention_required: false
  };
  if (deps.maintenance) summary.maintenance = await deps.repository.maintain();
  const controls = await deps.repository.status(scope);
  summary.attention_required = !!controls.halt_reason || (controls.job_counts.quarantined ?? 0) > 0 || (controls.oldest_pending_deletion_seconds ?? 0) > 6 * 86400;
  if (!controls.scope_present || !controls.dispatch_enabled)
    return { ...summary, state: "disabled" };
  if (controls.halt_reason) return { ...summary, state: "halted", attention_required: true };
  if (controls.capture_enabled && !controls.scope_expired && controls.pending_deletions === 0) {
    for (const id of await deps.repository.recoverable(scope, max)) {
      if (now() - start >= 45e3) break;
      const recovered = await deps.materialize(id);
      summary.recovery_calls++;
      if (recovered && typeof recovered === "object" && "state" in recovered && recovered.state === "pending")
        summary.materialized++;
    }
  }
  summary.state = "budget_exhausted";
  for (let cycle = 0; cycle < max * 2 + 5; cycle++) {
    if (summary.claimed >= max) {
      summary.state = "complete";
      break;
    }
    if (now() - start >= 45e3) {
      summary.state = "budget_exhausted";
      break;
    }
    const result = await deps.repository.claim(scope);
    if (result.state !== "leased") {
      if (result.state === "rate_limited") {
        const wait = result.retry_after_ms ?? 0;
        if (wait > 0 && wait <= 1e3 && now() - start + wait < 45e3) {
          await delay(wait);
          continue;
        }
        summary.state = "backoff";
        break;
      }
      summary.state = result.state;
      summary.attention_required ||= result.state === "halted";
      break;
    }
    summary.claimed++;
    const send = await deps.repository.begin(scope, result);
    if (send.state !== "send") {
      if (send.state === "stale" || send.state === "cancelled") summary.stale++;
      if (send.state === "quarantined") {
        summary.quarantined++;
        summary.attention_required = true;
      }
      if (send.state === "halted" || send.state === "disabled") {
        summary.state = send.state;
        summary.attention_required ||= send.state === "halted";
        break;
      }
      if (send.state === "rate_limited") {
        summary.state = "backoff";
        break;
      }
      continue;
    }
    summary.attempts_started++;
    let outcome;
    if (!await validOutgoing(scope, result, send))
      outcome = { outcome: "quarantined", failure: "invalid_payload" };
    else
      try {
        summary.transport_calls++;
        const response = await deps.transport.send(scope, result.kind, send.body);
        summary.http_responses++;
        outcome = classifyDispatch(result.kind, result.work_id, response, now());
      } catch (error) {
        outcome = error instanceof DispatchError && error.code === "configuration" ? { outcome: "halted", failure: "configuration" } : error instanceof DispatchError && error.code === "invalid_response" ? { outcome: "quarantined", failure: "invalid_receipt" } : { outcome: "retry", failure: "timeout" };
      }
    const saved = await deps.repository.finish(scope, result, outcome);
    if (saved.state === "delivered") {
      if (result.kind === "deletion") summary.deleted++;
      else summary.delivered++;
    } else if (saved.state === "stale" || saved.state === "cancelled") summary.stale++;
    else if (saved.state === "retry") summary.retry++;
    else if (saved.state === "quarantined") {
      summary.quarantined++;
      summary.attention_required = true;
    } else {
      summary.state = "halted";
      summary.attention_required = true;
      break;
    }
  }
  const final = await deps.repository.status(scope);
  summary.attention_required ||= !!final.halt_reason || (final.job_counts.quarantined ?? 0) > 0 || (final.oldest_pending_deletion_seconds ?? 0) > 6 * 86400;
  try {
    deps.audit?.({
      event: "musicdna_learning_dispatch",
      state: summary.state,
      attention_required: summary.attention_required
    });
  } catch {
  }
  return summary;
}
function learningReferences(serverSecret) {
  if (!serverSecret) throw new LearningOutboxError("outbox_unavailable");
  const encode = (value) => new TextEncoder().encode(value);
  const key = (async () => {
    const root = await crypto.subtle.importKey("raw", encode(serverSecret), "HKDF", false, [
      "deriveKey"
    ]);
    return crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encode("musicdna-learning-refs.v1"),
        info: encode("purpose-scoped-references")
      },
      root,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"]
    );
  })();
  return {
    async reference(scope, kind, internalId) {
      const prefix = { subject: "s", decision: "d", result: "r", feedback: "f" }[kind];
      if (!prefix || !internalId || internalId.length > 128 || !scope.tenantId)
        throw new LearningOutboxError("invalid_capture");
      const input = JSON.stringify([
        "musicdna_diagnostic_quality",
        scope.tenantId,
        scope.source,
        scope.environment,
        kind,
        internalId
      ]);
      const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", await key, encode(input)));
      return prefix + "_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  };
}
function learningOutboxRepository(client, signal) {
  const deadline = () => signal ? AbortSignal.any([signal, AbortSignal.timeout(1e4)]) : AbortSignal.timeout(1e4);
  const receipt = (data, id) => {
    const r = data;
    if (!r || r.observation_id !== id || !["captured", "pending", "excluded", "cancelled"].includes(String(r.state)))
      throw new LearningOutboxError("outbox_unavailable");
    return {
      observation_id: id,
      state: r.state,
      ...r.reason ? { reason: r.reason } : {},
      ...r.duplicate !== void 0 ? { duplicate: r.duplicate } : {}
    };
  };
  async function mutate(name, args, id) {
    const { data, error } = await client.rpc(name, args).abortSignal(deadline());
    if (error)
      throw new LearningOutboxError(
        error.code === "23505" ? "observation_conflict" : "outbox_unavailable"
      );
    return receipt(data, id);
  }
  return {
    async load(id) {
      const { data, error } = await client.from("musicdna_learning_outbox").select(
        "observation_id,feedback_id,source_key,environment,receiver_tenant_id,state,projection"
      ).eq("observation_id", id).abortSignal(deadline()).maybeSingle();
      if (error) throw new LearningOutboxError("outbox_unavailable");
      if (!data) return null;
      if (!["captured", "pending", "excluded", "cancelled"].includes(data.state))
        throw new LearningOutboxError("outbox_unavailable");
      return {
        observationId: data.observation_id,
        feedbackId: data.feedback_id,
        scope: {
          source: data.source_key,
          environment: data.environment,
          tenantId: data.receiver_tenant_id
        },
        state: data.state,
        projection: data.projection
      };
    },
    materialize: (id, canonical) => mutate(
      "materialize_musicdna_learning_observation",
      { p_observation_id: id, p_canonical_envelope: canonical },
      id
    ),
    exclude: (id) => mutate("exclude_musicdna_learning_capture", { p_observation_id: id }, id)
  };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const record = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DispatchError("worker_unavailable");
  return value;
};
function learningDispatchRepository(client, signal) {
  const deadline = () => signal ? AbortSignal.any([signal, AbortSignal.timeout(1e4)]) : AbortSignal.timeout(1e4);
  const binding = (scope) => ({
    p_source: scope.source,
    p_environment: scope.environment
  });
  async function rpc(name, args) {
    const { data, error } = await client.rpc(name, args).abortSignal(deadline());
    if (error) throw new DispatchError("worker_unavailable");
    return data;
  }
  function state(value, allowed) {
    const row = record(value);
    if (typeof row.state !== "string" || !allowed.includes(row.state))
      throw new DispatchError("worker_unavailable");
    return row;
  }
  return {
    async status(scope) {
      const row = record(await rpc("musicdna_learning_dispatch_status", binding(scope)));
      for (const field of ["scope_present", "dispatch_enabled", "capture_enabled", "scope_expired"])
        if (typeof row[field] !== "boolean") throw new DispatchError("worker_unavailable");
      for (const field of ["captured", "pending_deletions", "attempts_started"])
        if (typeof row[field] !== "number" || !Number.isSafeInteger(row[field]) || Number(row[field]) < 0)
          throw new DispatchError("worker_unavailable");
      const counts = record(row.job_counts);
      for (const [name, count] of Object.entries(counts))
        if (!["ready", "leased", "retry", "delivered", "quarantined", "cancelled"].includes(name) || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
          throw new DispatchError("worker_unavailable");
      for (const field of ["oldest_pending_deletion_seconds", "oldest_observation_pending_seconds"])
        if (row[field] !== null && (typeof row[field] !== "number" || !Number.isFinite(row[field])))
          throw new DispatchError("worker_unavailable");
      if (row.halt_reason !== null && !["auth_rejected", "source_disabled", "configuration", "binding_changed"].includes(
        String(row.halt_reason)
      ))
        throw new DispatchError("worker_unavailable");
      if (row.cooldown_until !== null && (typeof row.cooldown_until !== "string" || row.cooldown_until.length > 40 || !Number.isFinite(Date.parse(row.cooldown_until))))
        throw new DispatchError("worker_unavailable");
      return {
        scope_present: row.scope_present,
        dispatch_enabled: row.dispatch_enabled,
        capture_enabled: row.capture_enabled,
        scope_expired: row.scope_expired,
        halt_reason: row.halt_reason,
        job_counts: counts,
        pending_deletions: row.pending_deletions,
        oldest_pending_deletion_seconds: row.oldest_pending_deletion_seconds,
        oldest_observation_pending_seconds: row.oldest_observation_pending_seconds,
        captured: row.captured,
        attempts_started: row.attempts_started,
        cooldown_until: row.cooldown_until
      };
    },
    async recoverable(scope, limit) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 10)
        throw new DispatchError("configuration");
      const { data, error } = await client.from("musicdna_learning_outbox").select("observation_id").eq("source_key", scope.source).eq("environment", scope.environment).eq("state", "captured").order("created_at").order("observation_id").limit(limit).abortSignal(deadline());
      if (error || !data || data.some((row) => typeof row.observation_id !== "string" || !uuid.test(row.observation_id)))
        throw new DispatchError("worker_unavailable");
      return data.map((row) => row.observation_id);
    },
    async claim(scope) {
      const row = state(
        await rpc("claim_musicdna_learning_dispatch", binding(scope)),
        ["leased", "disabled", "idle", "halted", "rate_limited"]
      );
      if (row.state === "leased" && (!uuid.test(row.work_id) || !uuid.test(row.lease_token) || !["observation", "deletion"].includes(row.kind) || !Number.isFinite(Date.parse(row.lease_until))))
        throw new DispatchError("worker_unavailable");
      return row;
    },
    async begin(scope, lease) {
      const row = state(
        await rpc("begin_musicdna_learning_send", {
          ...binding(scope),
          p_kind: lease.kind,
          p_work_id: lease.work_id,
          p_lease_token: lease.lease_token
        }),
        ["send", "stale", "cancelled", "disabled", "halted", "rate_limited", "quarantined"]
      );
      if (row.state === "send" && typeof row.body !== "string")
        throw new DispatchError("worker_unavailable");
      return row;
    },
    async finish(scope, lease, result) {
      return state(
        await rpc("finish_musicdna_learning_dispatch", {
          ...binding(scope),
          p_kind: lease.kind,
          p_work_id: lease.work_id,
          p_lease_token: lease.lease_token,
          p_outcome: result.outcome,
          p_failure: "failure" in result ? result.failure : null,
          p_retry_after_seconds: "retryAfterSeconds" in result ? result.retryAfterSeconds ?? 0 : 0,
          p_receipt: "receipt" in result ? result.receipt : null
        }),
        ["delivered", "retry", "quarantined", "halted", "stale", "cancelled"]
      );
    },
    async maintain() {
      const outbox = record(await rpc("purge_musicdna_learning_outbox", { p_limit: 100 }));
      const markers = await rpc("purge_completed_musicdna_learning_withdrawals", { p_limit: 100 });
      const jobs = await rpc("purge_musicdna_learning_dispatch", { p_limit: 100 });
      return {
        purged_outbox: Number(outbox.purged_outbox),
        purged_enrollments: Number(outbox.purged_enrollments),
        purged_jobs: Number(jobs),
        purged_completed_withdrawals: Number(markers)
      };
    },
    async inspect(scope, id) {
      const value = await rpc("inspect_musicdna_learning_dispatch", {
        ...binding(scope),
        p_work_id: id
      });
      if (!Array.isArray(value) || value.length > 2) throw new DispatchError("worker_unavailable");
      return value.map((item) => {
        const row = record(item);
        if (row.work_id !== id || !["observation", "deletion"].includes(String(row.kind)) || !["ready", "leased", "retry", "delivered", "quarantined", "cancelled"].includes(
          String(row.state)
        ))
          throw new DispatchError("worker_unavailable");
        for (const field of ["claims", "attempts"])
          if (typeof row[field] !== "number" || !Number.isSafeInteger(row[field]) || Number(row[field]) < 0)
            throw new DispatchError("worker_unavailable");
        for (const field of ["next_attempt_at", "last_attempt_at", "completed_at", "lease_until"])
          if (row[field] !== null && (typeof row[field] !== "string" || String(row[field]).length > 40 || !Number.isFinite(Date.parse(String(row[field])))))
            throw new DispatchError("worker_unavailable");
        if (row.receipt_id !== null && (typeof row.receipt_id !== "string" || !uuid.test(row.receipt_id)))
          throw new DispatchError("worker_unavailable");
        if (row.last_failure !== null && ![
          "timeout",
          "rate_limited",
          "server_error",
          "invalid_payload",
          "observation_conflict",
          "auth_rejected",
          "source_disabled",
          "invalid_receipt",
          "configuration",
          "binding_changed",
          "missing_binding",
          "retry_exhausted",
          "max_age",
          "withdrawn",
          "lease_expired"
        ].includes(String(row.last_failure)))
          throw new DispatchError("worker_unavailable");
        return {
          kind: row.kind,
          work_id: row.work_id,
          state: row.state,
          claims: row.claims,
          attempts: row.attempts,
          next_attempt_at: row.next_attempt_at,
          last_attempt_at: row.last_attempt_at,
          completed_at: row.completed_at,
          lease_until: row.lease_until,
          receipt_id: row.receipt_id,
          last_failure: row.last_failure
        };
      });
    }
  };
}
const ECHELON_LEARNING_INGRESS = "https://yczomejrvihbmydyraqg.supabase.co/functions/v1/app-signal-inbound/learning";
function learningDispatchTransport(options) {
  const endpoint = new URL(options.endpoint ?? ECHELON_LEARNING_INGRESS);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/functions/v1/app-signal-inbound/learning")
    throw new DispatchError("configuration");
  return {
    async send(scope, kind, body) {
      const key = await options.keyForScope(scope.source, scope.environment);
      if (!key) throw new DispatchError("configuration");
      const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(5e3)]) : AbortSignal.timeout(5e3);
      const response = await (options.fetch ?? fetch)(
        new URL(endpoint.toString() + (kind === "deletion" ? "/delete" : "")),
        {
          method: "POST",
          redirect: "error",
          signal,
          headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
          body
        }
      );
      const retryAfter = response.headers.get("Retry-After");
      if (response.status !== 200) {
        try {
          await response.body?.cancel();
        } catch {
        }
        return {
          status: response.status,
          body: null,
          retryAfter: retryAfter?.slice(0, 100) ?? null
        };
      }
      const reader = response.body?.getReader();
      if (!reader) throw new DispatchError("invalid_response");
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8192) {
            try {
              await reader.cancel();
            } catch {
            }
            throw new DispatchError("invalid_response");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      let parsed;
      try {
        parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        throw new DispatchError("invalid_response");
      }
      return {
        status: response.status,
        body: parsed,
        retryAfter: retryAfter?.slice(0, 100) ?? null
      };
    }
  };
}
async function executeHostedDispatch(client, referenceSecret, ingestKey, signal) {
  const repository = learningDispatchRepository(client, signal), outbox = learningOutboxRepository(client, signal), references = learningReferences(referenceSecret);
  const transport = learningDispatchTransport({
    signal,
    keyForScope: async (source, environment) => source === "music-dna" && environment === "production" ? ingestKey : ""
  });
  return runLearningDispatch(
    { source: "music-dna", environment: "production" },
    {
      repository,
      transport,
      maxItems: 10,
      maintenance: true,
      materialize: (id) => materializeLearningCapture(id, { repository: outbox, references })
    }
  );
}
function createHostedDispatchHandler(deps) {
  return async (req) => {
    const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);
    const token = (req.headers.get("Authorization") ?? "").match(
      /^Bearer ([A-Za-z0-9_-]{32,128})$/
    )?.[1];
    if (!token) return reply({ ok: false, error: "unauthorized" }, 401);
    const reader = req.body?.getReader();
    if (!reader) return reply({ ok: false, error: "invalid_request" }, 400);
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 256) {
          await reader.cancel();
          return reply({ ok: false, error: "invalid_request" }, 413);
        }
        chunks.push(value);
      }
    } catch {
      return reply({ ok: false, error: "invalid_request" }, 400);
    } finally {
      reader.releaseLock();
    }
    try {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const b of chunks) {
        bytes.set(b, offset);
        offset += b.length;
      }
      const v = JSON.parse(new TextDecoder().decode(bytes));
      if (!v || Array.isArray(v) || typeof v !== "object" || Object.keys(v).length)
        throw Error("invalid");
    } catch {
      return reply({ ok: false, error: "invalid_request" }, 400);
    }
    let runId;
    try {
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
        (b) => b.toString(16).padStart(2, "0")
      ).join("");
      const lease = await deps.claim(hash);
      if (lease.state !== "leased") {
        if (!["disabled", "busy", "rate_limited"].includes(lease.state)) throw Error("invalid");
        return reply({
          ok: true,
          state: lease.state,
          delivered: 0,
          attention_required: lease.state === "disabled"
        });
      }
      if (!lease.run_id) throw Error("invalid");
      runId = lease.run_id;
      const s = await deps.dispatch(), attention = s.attention_required || s.state === "disabled";
      await deps.record(runId, attention ? "failed" : "completed", s.delivered, attention);
      return reply({
        ok: true,
        state: s.state,
        delivered: s.delivered,
        attention_required: attention
      });
    } catch (e) {
      if (runId) {
        try {
          await deps.record(runId, "failed", 0, true);
        } catch {
        }
      }
      const code = e && typeof e === "object" && "code" in e ? e.code : null;
      return reply(
        { ok: false, error: code === "42501" ? "unauthorized" : "dispatch_unavailable" },
        code === "42501" ? 401 : 503
      );
    }
  };
}
export {
  createHostedDispatchHandler,
  executeHostedDispatch
};
