/** learning-deletion.v1, canonical owner acedge123/music-dna. Synthetic lifecycle only. */
export type LearningDeletionV1 = {
  schema_version: "learning-deletion.v1";
  source: "music-dna" | "music-dna-staging";
  environment: "production" | "staging";
  subject_ref: string;
  deletion_id: string;
  reason: "withdrawal" | "deletion" | "retention";
};
export type LearningDeletionReceiptV1 = {
  ok: true;
  deletion_id: string;
  status: "completed";
  completed_at: string;
  purged_count: number;
  duplicate: boolean;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validateLearningDeletionV1(value: unknown): LearningDeletionV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (
    Object.keys(b).sort().join(",") !==
      "deletion_id,environment,reason,schema_version,source,subject_ref" ||
    b.schema_version !== "learning-deletion.v1" ||
    !(
      (b.source === "music-dna-staging" && b.environment === "staging") ||
      (b.source === "music-dna" && b.environment === "production")
    ) ||
    typeof b.subject_ref !== "string" ||
    !/^s_[0-9a-f]{64}$/.test(b.subject_ref) ||
    typeof b.deletion_id !== "string" ||
    !uuid.test(b.deletion_id) ||
    !["withdrawal", "deletion", "retention"].includes(String(b.reason))
  )
    return null;
  return b as LearningDeletionV1;
}
/** Explicit projection drops private store fields; sender also binds its own request ID. */
export function validateLearningDeletionReceiptV1(
  value: unknown,
  expectedId?: string,
): LearningDeletionReceiptV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Partial<LearningDeletionReceiptV1>;
  if (
    r.ok !== true ||
    r.status !== "completed" ||
    typeof r.deletion_id !== "string" ||
    !uuid.test(r.deletion_id) ||
    (expectedId !== undefined && r.deletion_id !== expectedId) ||
    typeof r.completed_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      r.completed_at,
    ) ||
    !Number.isFinite(Date.parse(r.completed_at)) ||
    !Number.isSafeInteger(r.purged_count) ||
    r.purged_count! < 0 ||
    typeof r.duplicate !== "boolean"
  )
    return null;
  return {
    ok: true,
    deletion_id: r.deletion_id,
    status: "completed",
    completed_at: r.completed_at,
    purged_count: r.purged_count!,
    duplicate: r.duplicate,
  };
}
