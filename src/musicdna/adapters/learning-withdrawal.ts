import { validateLearningDeletionV1 } from "../contracts/learning-deletion-v1";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeletionTask, DeletionTransport, WithdrawalRepository } from "../learning/withdrawal";

/** Caller injects a trusted server client. This adapter never creates a client or loads secrets. */
function learningWithdrawalRepository(client: SupabaseClient): WithdrawalRepository {
  return {
    async pending(source, environment, id) {
      const { data, error } = await client
        .from("musicdna_export_withdrawals")
        .select("source_key,environment,subject_ref,deletion_id,reason")
        .eq("source_key", source)
        .eq("environment", environment)
        .eq("deletion_id", id)
        .is("completed_at", null)
        .abortSignal(AbortSignal.timeout(10_000))
        .maybeSingle();
      if (error) throw new Error("withdrawal_store_unavailable");
      if (!data) return null;
      if (!validTask({ ...data, source: data.source_key }))
        throw new Error("invalid_withdrawal_task");
      return {
        source: data.source_key,
        environment: data.environment,
        subject_ref: data.subject_ref,
        deletion_id: data.deletion_id,
        reason: data.reason,
      } as DeletionTask;
    },
    async finish(task, result) {
      const receipt = "receipt" in result ? result.receipt : null;
      const { error } = await client
        .rpc("finish_musicdna_learning_withdrawal", {
          p_source: task.source,
          p_environment: task.environment,
          p_deletion_id: task.deletion_id,
          p_completed_at: receipt?.completed_at ?? null,
          p_purged_count: receipt?.purged_count ?? null,
          p_failure: "failure" in result ? result.failure : null,
        })
        .abortSignal(AbortSignal.timeout(10_000));
      if (error) throw new Error("withdrawal_store_unavailable");
    },
  };
}
function validTask(value: Record<string, unknown>): boolean {
  return !!validateLearningDeletionV1({
    schema_version: "learning-deletion.v1",
    source: value.source,
    environment: value.environment,
    subject_ref: value.subject_ref,
    deletion_id: value.deletion_id,
    reason: value.reason,
  });
}
/** Only operator-supplied HTTPS function endpoints and source-specific keys. No redirects. */
export function learningDeletionTransport(options: {
  endpoint: string;
  keyForScope: (source: string, environment: string) => Promise<string>;
  fetch?: typeof fetch;
}): DeletionTransport {
  const url = new URL(options.endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/functions/v1/app-signal-inbound/learning/delete"
  )
    throw new Error("invalid_learning_deletion_endpoint");
  return {
    async send(task) {
      if (!validTask(task)) throw new Error("invalid_withdrawal_task");
      const key = await options.keyForScope(task.source, task.environment);
      if (!key) throw new Error("source_key_unavailable");
      const response = await (options.fetch ?? fetch)(url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          schema_version: "learning-deletion.v1",
          source: task.source,
          environment: task.environment,
          subject_ref: task.subject_ref,
          deletion_id: task.deletion_id,
          reason: task.reason,
        }),
      });
      // Never retain response text or error prose; bound reads before JSON parsing.
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (!reader) return { status: response.status, body: null };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8192) {
            await reader.cancel();
            throw new Error("invalid_deletion_receipt");
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
      let body: unknown = null;
      try {
        body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        /* invalid receipt stays pending */
      }
      return { status: response.status, body };
    },
  };
}
