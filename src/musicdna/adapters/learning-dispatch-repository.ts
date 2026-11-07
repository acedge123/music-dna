import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DispatchError,
  type DispatchRepository,
  type DispatchControl,
  type ClaimResult,
  type BeginResult,
  type FinishResult,
  type DispatchScope,
} from "../learning/dispatcher";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DispatchError("worker_unavailable");
  return value as Record<string, unknown>;
};
/** Operator-only service client; bounded errors never serialize database messages. */
export function learningDispatchRepository(
  client: SupabaseClient,
  signal?: AbortSignal,
): DispatchRepository & { inspect(scope: DispatchScope, id: string): Promise<unknown> } {
  const deadline = () =>
    signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000);
  const binding = (scope: DispatchScope) => ({
    p_source: scope.source,
    p_environment: scope.environment,
  });
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(deadline());
    if (error) throw new DispatchError("worker_unavailable");
    return data as unknown;
  }
  function state<T>(value: unknown, allowed: string[]): T {
    const row = record(value);
    if (typeof row.state !== "string" || !allowed.includes(row.state))
      throw new DispatchError("worker_unavailable");
    return row as T;
  }
  return {
    async status(scope) {
      const row = record(await rpc("musicdna_learning_dispatch_status", binding(scope)));
      for (const field of ["scope_present", "dispatch_enabled", "capture_enabled", "scope_expired"])
        if (typeof row[field] !== "boolean") throw new DispatchError("worker_unavailable");
      for (const field of ["captured", "pending_deletions", "attempts_started"])
        if (
          typeof row[field] !== "number" ||
          !Number.isSafeInteger(row[field]) ||
          Number(row[field]) < 0
        )
          throw new DispatchError("worker_unavailable");
      const counts = record(row.job_counts);
      for (const [name, count] of Object.entries(counts))
        if (
          !["ready", "leased", "retry", "delivered", "quarantined", "cancelled"].includes(name) ||
          typeof count !== "number" ||
          !Number.isSafeInteger(count) ||
          count < 0
        )
          throw new DispatchError("worker_unavailable");
      for (const field of ["oldest_pending_deletion_seconds", "oldest_observation_pending_seconds"])
        if (row[field] !== null && (typeof row[field] !== "number" || !Number.isFinite(row[field])))
          throw new DispatchError("worker_unavailable");
      if (
        row.halt_reason !== null &&
        !["auth_rejected", "source_disabled", "configuration", "binding_changed"].includes(
          String(row.halt_reason),
        )
      )
        throw new DispatchError("worker_unavailable");
      if (
        row.cooldown_until !== null &&
        (typeof row.cooldown_until !== "string" ||
          row.cooldown_until.length > 40 ||
          !Number.isFinite(Date.parse(row.cooldown_until)))
      )
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
        cooldown_until: row.cooldown_until,
      } as DispatchControl;
    },
    async recoverable(scope, limit) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 10)
        throw new DispatchError("configuration");
      const { data, error } = await client
        .from("musicdna_learning_outbox")
        .select("observation_id")
        .eq("source_key", scope.source)
        .eq("environment", scope.environment)
        .eq("state", "captured")
        .order("created_at")
        .order("observation_id")
        .limit(limit)
        .abortSignal(deadline());
      if (
        error ||
        !data ||
        data.some((row) => typeof row.observation_id !== "string" || !uuid.test(row.observation_id))
      )
        throw new DispatchError("worker_unavailable");
      return data.map((row) => row.observation_id);
    },
    async claim(scope) {
      const row = state<ClaimResult>(
        await rpc("claim_musicdna_learning_dispatch", binding(scope)),
        ["leased", "disabled", "idle", "halted", "rate_limited"],
      );
      if (
        row.state === "leased" &&
        (!uuid.test(row.work_id) ||
          !uuid.test(row.lease_token) ||
          !["observation", "deletion"].includes(row.kind) ||
          !Number.isFinite(Date.parse(row.lease_until)))
      )
        throw new DispatchError("worker_unavailable");
      return row;
    },
    async begin(scope, lease) {
      const row = state<BeginResult>(
        await rpc("begin_musicdna_learning_send", {
          ...binding(scope),
          p_kind: lease.kind,
          p_work_id: lease.work_id,
          p_lease_token: lease.lease_token,
        }),
        ["send", "stale", "cancelled", "disabled", "halted", "rate_limited", "quarantined"],
      );
      if (row.state === "send" && typeof row.body !== "string")
        throw new DispatchError("worker_unavailable");
      return row;
    },
    async finish(scope, lease, result) {
      return state<FinishResult>(
        await rpc("finish_musicdna_learning_dispatch", {
          ...binding(scope),
          p_kind: lease.kind,
          p_work_id: lease.work_id,
          p_lease_token: lease.lease_token,
          p_outcome: result.outcome,
          p_failure: "failure" in result ? result.failure : null,
          p_retry_after_seconds:
            "retryAfterSeconds" in result ? (result.retryAfterSeconds ?? 0) : 0,
          p_receipt: "receipt" in result ? result.receipt : null,
        }),
        ["delivered", "retry", "quarantined", "halted", "stale", "cancelled"],
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
        purged_completed_withdrawals: Number(markers),
      };
    },
    async inspect(scope, id) {
      const value = await rpc("inspect_musicdna_learning_dispatch", {
        ...binding(scope),
        p_work_id: id,
      });
      if (!Array.isArray(value) || value.length > 2) throw new DispatchError("worker_unavailable");
      return value.map((item) => {
        const row = record(item);
        if (
          row.work_id !== id ||
          !["observation", "deletion"].includes(String(row.kind)) ||
          !["ready", "leased", "retry", "delivered", "quarantined", "cancelled"].includes(
            String(row.state),
          )
        )
          throw new DispatchError("worker_unavailable");
        for (const field of ["claims", "attempts"])
          if (
            typeof row[field] !== "number" ||
            !Number.isSafeInteger(row[field]) ||
            Number(row[field]) < 0
          )
            throw new DispatchError("worker_unavailable");
        for (const field of ["next_attempt_at", "last_attempt_at", "completed_at", "lease_until"])
          if (
            row[field] !== null &&
            (typeof row[field] !== "string" ||
              String(row[field]).length > 40 ||
              !Number.isFinite(Date.parse(String(row[field]))))
          )
            throw new DispatchError("worker_unavailable");
        if (
          row.receipt_id !== null &&
          (typeof row.receipt_id !== "string" || !uuid.test(row.receipt_id))
        )
          throw new DispatchError("worker_unavailable");
        if (
          row.last_failure !== null &&
          ![
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
            "lease_expired",
          ].includes(String(row.last_failure))
        )
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
          last_failure: row.last_failure,
        };
      });
    },
  };
}
