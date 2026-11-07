/** Synthetic-only server use case. No routes, scheduling, keys, or live export. */
import {
  validateLearningDeletionReceiptV1,
  type LearningDeletionV1,
  type LearningDeletionReceiptV1,
} from "../contracts/learning-deletion-v1";
export type DeletionTask = Omit<LearningDeletionV1, "schema_version">;
export type RemoteDeletionReceipt = LearningDeletionReceiptV1;
export interface WithdrawalRepository {
  pending(source: string, environment: string, id: string): Promise<DeletionTask | null>;
  finish(
    task: DeletionTask,
    result: { receipt: RemoteDeletionReceipt } | { failure: "unavailable" | "rejected" },
  ): Promise<void>;
}
export interface DeletionTransport {
  send(task: DeletionTask): Promise<{ status: number; body: unknown }>;
}
/** A transport success is insufficient: only a matching durable completion is acked. */
export async function deliverLearningWithdrawal(
  scope: { source: string; environment: string; deletionId: string },
  repository: WithdrawalRepository,
  transport: DeletionTransport,
): Promise<"completed" | "pending" | "already_completed_or_missing"> {
  const task = await repository.pending(scope.source, scope.environment, scope.deletionId);
  if (!task) return "already_completed_or_missing";
  let response: { status: number; body: unknown };
  try {
    response = await transport.send(task);
  } catch {
    await repository.finish(task, { failure: "unavailable" });
    return "pending";
  }
  const r = validateLearningDeletionReceiptV1(response.body, task.deletion_id);
  if (response.status !== 200 || !r) {
    await repository.finish(task, { failure: response.status >= 500 ? "unavailable" : "rejected" });
    return "pending";
  }
  await repository.finish(task, { receipt: r });
  return "completed";
}
