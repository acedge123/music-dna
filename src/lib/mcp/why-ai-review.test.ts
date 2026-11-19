import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { requestWhyAiReview, whyAiRequestSchema } from "./why-ai-review";
import type { Actor } from "./access";
import { runSavedWhyReview } from "./why-ai-review.server";
import { catalogTools } from "./tools";
vi.mock("./why-ai-review.server", () => ({ runSavedWhyReview: vi.fn() }));
const input = {
  explanation_id: randomUUID(),
  expected_version: `why-v1:${"a".repeat(64)}`,
  expected_context_version: `why-v1:${"b".repeat(64)}`,
  mutation_id: randomUUID(),
  confirm_paid_review: true as const,
};
function actor(replayed: boolean, reviewer = true) {
  const rpc = vi.fn(async () => ({ data: { request_id: "request", replayed }, error: null }));
  const row = { id: "request", display_state: "ambiguous", result: null };
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return {
    db: { rpc, from: () => query } as unknown as SupabaseClient,
    userId: randomUUID(),
    capabilities: {
      catalog_read: true,
      catalog_propose: false,
      catalog_review: reviewer,
      qa_read: false,
    },
  } satisfies Actor;
}
describe("explicit request MCP boundary", () => {
  it("requires literal confirmation, exact source/context versions and no injected verdict", () => {
    expect(whyAiRequestSchema.safeParse({ ...input, confirm_paid_review: false }).success).toBe(
      false,
    );
    expect(whyAiRequestSchema.safeParse({ ...input, result: { verdict: "pass" } }).success).toBe(
      false,
    );
    expect(
      whyAiRequestSchema.safeParse({ ...input, expected_context_version: "guess" }).success,
    ).toBe(false);
  });
  it("denies model/save access to a reader before any RPC", async () => {
    const a = actor(false, false);
    await expect(requestWhyAiReview(a, input)).rejects.toThrow("FORBIDDEN");
    expect(a.db.rpc).not.toHaveBeenCalled();
  });
  it("does not call the provider on ambiguous duplicate submissions", async () => {
    vi.mocked(runSavedWhyReview).mockClear();
    expect(await requestWhyAiReview(actor(true), input)).toMatchObject({
      replayed: true,
      review: { display_state: "ambiguous" },
    });
    expect(runSavedWhyReview).not.toHaveBeenCalled();
  });
  it("labels paid work as a write/external tool; saved results remain read-only", () => {
    const paid = catalogTools.find((t) => t.name === "song_whys_request_ai_review")!;
    expect(paid.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    for (const name of [
      "song_whys_get_ai_review",
      "song_whys_list_ai_reviews",
      "song_whys_run_audit",
    ]) {
      expect(catalogTools.find((t) => t.name === name)?.annotations?.readOnlyHint).toBe(true);
    }
  });
});
