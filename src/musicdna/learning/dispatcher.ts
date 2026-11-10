import {
  validateMusicDnaLearningEnvelope,
  validateMusicDnaLearningReceiptV1,
} from "../contracts/learning-observation";
import {
  validateLearningDeletionV1,
  validateLearningDeletionReceiptV1,
} from "../contracts/learning-deletion-v1";
import { canonicalLearningJson, type LearningScope } from "./outbox";

export type DispatchScope = Pick<LearningScope, "source" | "environment">;
export type DispatchKind = "observation" | "deletion";
export type Lease = {
  kind: DispatchKind;
  work_id: string;
  lease_token: string;
  lease_until: string;
};
export type DispatchControl = {
  scope_present: boolean;
  dispatch_enabled: boolean;
  capture_enabled: boolean;
  scope_expired: boolean;
  halt_reason: string | null;
  job_counts: Record<string, number>;
  pending_deletions: number;
  oldest_pending_deletion_seconds: number | null;
  oldest_observation_pending_seconds: number | null;
  captured: number;
  attempts_started: number;
  cooldown_until: string | null;
};
export type ClaimResult =
  | ({ state: "leased" } & Lease)
  | {
      state: "disabled" | "idle" | "halted" | "rate_limited";
      reason?: string;
      retry_after_ms?: number;
    };
export type BeginResult =
  | { state: "send"; body: string; fingerprint?: string }
  | {
      state: "stale" | "cancelled" | "disabled" | "halted" | "rate_limited" | "quarantined";
      reason?: string;
      retry_after_ms?: number;
    };
export type DispatchFailure =
  | "timeout"
  | "rate_limited"
  | "server_error"
  | "invalid_payload"
  | "observation_conflict"
  | "auth_rejected"
  | "source_disabled"
  | "invalid_receipt"
  | "configuration";
export type DispatchOutcome =
  | { outcome: "delivered"; receipt: unknown }
  | {
      outcome: "retry" | "quarantined" | "halted";
      failure: DispatchFailure;
      retryAfterSeconds?: number;
    };
export type FinishResult = {
  state: "delivered" | "retry" | "quarantined" | "halted" | "stale" | "cancelled";
  receipt_id?: string;
  reason?: string;
};
export interface DispatchRepository {
  status(scope: DispatchScope): Promise<DispatchControl>;
  recoverable(scope: DispatchScope, limit: number): Promise<string[]>;
  claim(scope: DispatchScope): Promise<ClaimResult>;
  begin(scope: DispatchScope, lease: Lease): Promise<BeginResult>;
  finish(scope: DispatchScope, lease: Lease, result: DispatchOutcome): Promise<FinishResult>;
  maintain(): Promise<{
    purged_outbox: number;
    purged_enrollments: number;
    purged_jobs: number;
    purged_completed_withdrawals: number;
  }>;
}
export interface DispatchTransport {
  send(
    scope: DispatchScope,
    kind: DispatchKind,
    body: string,
  ): Promise<{ status: number; body: unknown; retryAfter: string | null }>;
}
export class DispatchError extends Error {
  constructor(readonly code: "configuration" | "worker_unavailable" | "invalid_response") {
    super(code);
  }
}
export function retryAfterSeconds(header: string | null, now: number): number {
  if (!header || header.length > 100) return 0;
  const seconds = /^\d+$/.test(header.trim())
    ? Number(header)
    : Math.ceil((Date.parse(header) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(0, Math.min(3600, seconds)) : 0;
}
export function classifyDispatch(
  kind: DispatchKind,
  id: string,
  response: { status: number; body: unknown; retryAfter: string | null },
  now: number,
): DispatchOutcome {
  if (response.status === 200) {
    const valid =
      kind === "observation" ? validateMusicDnaLearningReceiptV1(response.body, id) : null;
    const receipt =
      kind === "deletion"
        ? validateLearningDeletionReceiptV1(response.body, id)
        : valid?.ok
          ? valid.value
          : null;
    return receipt
      ? { outcome: "delivered", receipt }
      : { outcome: "quarantined", failure: "invalid_receipt" };
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
      retryAfterSeconds: retryAfterSeconds(response.retryAfter, now),
    };
  if (response.status === 408 || response.status >= 500)
    return {
      outcome: "retry",
      failure: response.status === 408 ? "timeout" : "server_error",
      retryAfterSeconds: retryAfterSeconds(response.retryAfter, now),
    };
  return { outcome: "quarantined", failure: "invalid_payload" };
}
async function validOutgoing(
  scope: DispatchScope,
  lease: Lease,
  value: { body: string; fingerprint?: string },
): Promise<boolean> {
  if (new TextEncoder().encode(value.body).byteLength > 8192) return false;
  let decoded: unknown;
  try {
    decoded = JSON.parse(value.body);
  } catch {
    return false;
  }
  if (lease.kind === "deletion") {
    const parsed = validateLearningDeletionV1(decoded);
    return (
      !!parsed &&
      parsed.source === scope.source &&
      parsed.environment === scope.environment &&
      parsed.deletion_id === lease.work_id
    );
  }
  const parsed = validateMusicDnaLearningEnvelope(decoded);
  if (
    !parsed.ok ||
    parsed.value.source !== scope.source ||
    parsed.value.environment !== scope.environment ||
    parsed.value.metadata.observation.observation_id !== lease.work_id ||
    canonicalLearningJson(parsed.value) !== value.body
  )
    return false;
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.body)),
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("") === value.fingerprint;
}
export type DispatchSummary = {
  state: "disabled" | "idle" | "complete" | "halted" | "backoff" | "budget_exhausted";
  claimed: number;
  attempts_started: number;
  transport_calls: number;
  http_responses: number;
  delivered: number;
  deleted: number;
  retry: number;
  quarantined: number;
  stale: number;
  materialized: number;
  recovery_calls: number;
  attention_required: boolean;
  maintenance?: Awaited<ReturnType<DispatchRepository["maintain"]>>;
};
/** One bounded operator tick. Never called from a listener-facing route. */
export async function runLearningDispatch(
  scope: DispatchScope,
  deps: {
    repository: DispatchRepository;
    transport: DispatchTransport;
    materialize: (id: string) => Promise<unknown>;
    maxItems?: number;
    maintenance?: boolean;
    now?: () => number;
    delay?: (ms: number) => Promise<void>;
    audit?: (event: {
      event: "musicdna_learning_dispatch";
      state: string;
      attention_required: boolean;
    }) => void;
  },
): Promise<DispatchSummary> {
  const max = deps.maxItems ?? 5;
  if (!Number.isInteger(max) || max < 1 || max > 10) throw new DispatchError("configuration");
  const now = deps.now ?? Date.now,
    delay = deps.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const start = now();
  const summary: DispatchSummary = {
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
    attention_required: false,
  };
  if (deps.maintenance) summary.maintenance = await deps.repository.maintain();
  const controls = await deps.repository.status(scope);
  summary.attention_required =
    !!controls.halt_reason ||
    (controls.job_counts.quarantined ?? 0) > 0 ||
    (controls.oldest_pending_deletion_seconds ?? 0) > 6 * 86400;
  if (!controls.scope_present || !controls.dispatch_enabled)
    return { ...summary, state: "disabled" };
  if (controls.halt_reason) return { ...summary, state: "halted", attention_required: true };
  if (controls.capture_enabled && !controls.scope_expired && controls.pending_deletions === 0) {
    for (const id of await deps.repository.recoverable(scope, max)) {
      if (now() - start >= 45000) break;
      const recovered = await deps.materialize(id);
      summary.recovery_calls++;
      if (
        recovered &&
        typeof recovered === "object" &&
        "state" in recovered &&
        recovered.state === "pending"
      )
        summary.materialized++;
    }
  }
  summary.state = "budget_exhausted";
  for (let cycle = 0; cycle < max * 2 + 5; cycle++) {
    if (summary.claimed >= max) {
      summary.state = "complete";
      break;
    }
    if (now() - start >= 45000) {
      summary.state = "budget_exhausted";
      break;
    }
    const result = await deps.repository.claim(scope);
    if (result.state !== "leased") {
      if (result.state === "rate_limited") {
        const wait = result.retry_after_ms ?? 0;
        if (wait > 0 && wait <= 1000 && now() - start + wait < 45000) {
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
    let outcome: DispatchOutcome;
    if (!(await validOutgoing(scope, result, send)))
      outcome = { outcome: "quarantined", failure: "invalid_payload" };
    else
      try {
        summary.transport_calls++;
        const response = await deps.transport.send(scope, result.kind, send.body);
        summary.http_responses++;
        outcome = classifyDispatch(result.kind, result.work_id, response, now());
      } catch (error) {
        outcome =
          error instanceof DispatchError && error.code === "configuration"
            ? { outcome: "halted", failure: "configuration" }
            : error instanceof DispatchError && error.code === "invalid_response"
              ? { outcome: "quarantined", failure: "invalid_receipt" }
              : { outcome: "retry", failure: "timeout" };
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
  // Refresh numeric attention after exhaustion/age quarantine can happen inside claim.
  const final = await deps.repository.status(scope);
  summary.attention_required ||=
    !!final.halt_reason ||
    (final.job_counts.quarantined ?? 0) > 0 ||
    (final.oldest_pending_deletion_seconds ?? 0) > 6 * 86400;
  try {
    deps.audit?.({
      event: "musicdna_learning_dispatch",
      state: summary.state,
      attention_required: summary.attention_required,
    });
  } catch {
    /* DB outcome/CLI result remains authoritative */
  }
  return summary;
}
