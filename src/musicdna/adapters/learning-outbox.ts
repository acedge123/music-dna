import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LearningOutboxError,
  type CaptureRecord,
  type LearningOutboxRepository,
  type MaterializationReceipt,
} from "../learning/outbox";

/** Trusted worker/operator client only. RLS/grants deny ordinary users. */
export function learningOutboxRepository(client: SupabaseClient): LearningOutboxRepository {
  const receipt = (data: unknown, id: string): MaterializationReceipt => {
    const r = data as Partial<MaterializationReceipt> | null;
    if (
      !r ||
      r.observation_id !== id ||
      !["captured", "pending", "excluded", "cancelled"].includes(String(r.state))
    )
      throw new LearningOutboxError("outbox_unavailable");
    return {
      observation_id: id,
      state: r.state!,
      ...(r.reason ? { reason: r.reason } : {}),
      ...(r.duplicate !== undefined ? { duplicate: r.duplicate } : {}),
    };
  };
  async function mutate(name: string, args: Record<string, unknown>, id: string) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(10_000));
    if (error)
      throw new LearningOutboxError(
        error.code === "23505" ? "observation_conflict" : "outbox_unavailable",
      );
    return receipt(data, id);
  }
  return {
    async load(id) {
      const { data, error } = await client
        .from("musicdna_learning_outbox")
        .select(
          "observation_id,feedback_id,source_key,environment,receiver_tenant_id,state,projection",
        )
        .eq("observation_id", id)
        .abortSignal(AbortSignal.timeout(10_000))
        .maybeSingle();
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
          tenantId: data.receiver_tenant_id,
        },
        state: data.state,
        projection: data.projection,
      } as CaptureRecord;
    },
    materialize: (id, canonical) =>
      mutate(
        "materialize_musicdna_learning_observation",
        { p_observation_id: id, p_canonical_envelope: canonical },
        id,
      ),
    exclude: (id) => mutate("exclude_musicdna_learning_capture", { p_observation_id: id }, id),
  };
}
