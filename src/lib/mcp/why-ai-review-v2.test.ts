import { randomUUID } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import type { Actor } from "./access";
import {
  listWhyAiReviews,
  requestWhyAiReview,
  validateWhyReviewRates,
  whyAiRequestSchema,
  whyReviewRates,
} from "./why-ai-review";
import { WHY_AI_POLICY_VERSION, whyAiReviewPolicy } from "./why-ai-review-policy";
import { pageCursor, nextCursor } from "./pagination";
import manifest from "../../../.lovable/mcp/manifest.json";
const owner = randomUUID();
const policy = WHY_AI_POLICY_VERSION;
const sample = {
  policy_version: policy,
  requested: 5,
  completed: 4,
  pass: 1,
  fail: 1,
  uncertain: 2,
  unavailable: 1,
  failure_rate: 0.25,
  uncertainty_rate: 0.5,
  scope: "latest attempt per explanation within policy",
  denominator: "completed reviews only; unavailable attempts excluded",
};
function actor(data: unknown = sample, read = true) {
  return {
    userId: owner,
    capabilities: {
      catalog_read: read,
      catalog_propose: false,
      catalog_review: false,
      qa_read: false,
    },
    db: { rpc: vi.fn(async () => ({ data, error: null })) },
  } as unknown as Actor;
}
const request = {
  explanation_id: randomUUID(),
  expected_version: `why-v1:${"a".repeat(64)}`,
  expected_context_version: `why-v1:${"b".repeat(64)}`,
  mutation_id: randomUUID(),
  confirm_paid_review: true as const,
};
describe("MCP three-verdict reviewer contract", () => {
  it("pins current paid work to v2 while preserving older-client default and explicit confirmation", async () => {
    expect(whyAiRequestSchema.parse(request).expected_policy_version).toBe(policy);
    const a = actor();
    await expect(
      requestWhyAiReview(a, {
        ...request,
        expected_policy_version: "saved-song-why-review-v1",
      } as never),
    ).rejects.toThrow();
    expect(a.db.rpc).not.toHaveBeenCalled();
    expect(whyAiRequestSchema.safeParse({ ...request, confirm_paid_review: false }).success).toBe(
      false,
    );
    expect(whyAiReviewPolicy.criteria.uncertain).toContain("neither failure nor a score dispute");
  });
  it("advertises version, separate verdict filter and read-only rates in the extracted manifest", () => {
    expect(manifest.mcp.server.version).toBe("0.4.0");
    const paid = manifest.mcp.tools.find((t) => t.name === "song_whys_request_ai_review")!;
    expect(paid.inputSchema).toMatchObject({
      properties: { expected_policy_version: { const: policy, default: policy } },
    });
    expect(paid.description).toContain("Pass / Fail / Uncertain");
    const listing = manifest.mcp.tools.find((t) => t.name === "song_whys_list_ai_reviews")!;
    expect(listing.inputSchema).toMatchObject({
      properties: {
        verdict: { enum: ["pass", "fail", "uncertain"] },
        policy_version: { enum: ["saved-song-why-review-v1", policy] },
      },
    });
    expect(
      manifest.mcp.tools.find((t) => t.name === "song_whys_get_ai_review_rates")?.annotations
        ?.readOnlyHint,
    ).toBe(true);
  });
  it("passes policy and Uncertain filters to the saved-result query without model calls", async () => {
    const calls: unknown[][] = [];
    const query: Record<string, unknown> = {};
    for (const name of ["select", "lte", "order", "limit", "gt", "eq"]) {
      query[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return query;
      };
    }
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
    const a = actor();
    a.db.from = vi.fn(() => query) as never;
    expect(
      await listWhyAiReviews(a, { limit: 20, policy_version: policy, verdict: "uncertain" }),
    ).toMatchObject({ reviews: [], next_cursor: null });
    expect(calls).toContainEqual(["eq", "policy_version", policy]);
    expect(calls).toContainEqual(["eq", "result->>verdict", "uncertain"]);
    expect(a.db.rpc).not.toHaveBeenCalled();
    const state = pageCursor(undefined, owner, {
      tool: "song_whys_list_ai_reviews",
      policy_version: policy,
      verdict: "fail",
    });
    await expect(
      listWhyAiReviews(a, {
        limit: 20,
        policy_version: policy,
        verdict: "uncertain",
        cursor: nextCursor(owner, state, randomUUID()),
      }),
    ).rejects.toThrow("INVALID_CURSOR");
  });
});
describe("policy-separated outcome fractions", () => {
  it("keeps substantive failure, uncertainty and unavailable attempts separate", () => {
    expect(validateWhyReviewRates(sample, policy)).toEqual(sample);
    expect(
      validateWhyReviewRates(
        {
          ...sample,
          policy_version: "saved-song-why-review-v1",
          requested: 10,
          completed: 10,
          pass: 1,
          fail: 9,
          uncertain: 0,
          unavailable: 0,
          failure_rate: 0.9,
          uncertainty_rate: 0,
        },
        "saved-song-why-review-v1",
      ),
    ).toMatchObject({ failure_rate: 0.9, uncertainty_rate: 0 });
  });
  it("requires null rates for empty completed denominators", () => {
    const empty = {
      ...sample,
      requested: 1,
      completed: 0,
      pass: 0,
      fail: 0,
      uncertain: 0,
      unavailable: 1,
      failure_rate: null,
      uncertainty_rate: null,
    };
    expect(validateWhyReviewRates(empty, policy)).toEqual(empty);
    expect(() => validateWhyReviewRates({ ...empty, failure_rate: 0 }, policy)).toThrow(
      "REVIEW_RATES_UNAVAILABLE",
    );
  });
  it.each([
    { completed: 5 },
    { requested: 9 },
    { fail: 0 },
    { failure_rate: 0.75 },
    { uncertainty_rate: 0 },
    { policy_version: "saved-song-why-review-v1" },
    { pass: -1 },
    { completed: "4" },
    { failure_rate: null },
  ])("rejects inconsistent rates rather than reporting a healthy percentage: %j", (patch) => {
    expect(() => validateWhyReviewRates({ ...sample, ...patch }, policy)).toThrow(
      "REVIEW_RATES_UNAVAILABLE",
    );
  });
  it("does not mix policies, relabel old outcomes, or count more selected explanations than supplied", () => {
    expect(() => validateWhyReviewRates(sample, policy, 4)).toThrow("REVIEW_RATES_UNAVAILABLE");
    expect(() =>
      validateWhyReviewRates(
        { ...sample, policy_version: "saved-song-why-review-v1" },
        "saved-song-why-review-v1",
      ),
    ).toThrow("REVIEW_RATES_UNAVAILABLE");
  });
  it("reads a bounded explicit cohort with catalog-read only and no mutation", async () => {
    const ids = Array.from({ length: 5 }, () => randomUUID()),
      a = actor();
    expect(await whyReviewRates(a, policy, ids)).toEqual(sample);
    expect(a.db.rpc).toHaveBeenCalledExactlyOnceWith("musicdna_mcp_why_ai_review_rates", {
      p_policy: policy,
      p_ids: ids,
    });
  });
  it("denies a missing read capability before RPC and rejects an unbounded or invalid policy selection", async () => {
    const a = actor(sample, false);
    await expect(whyReviewRates(a, policy)).rejects.toThrow("FORBIDDEN");
    expect(a.db.rpc).not.toHaveBeenCalled();
    await expect(whyReviewRates(actor(), "invented-policy")).rejects.toThrow();
    await expect(
      whyReviewRates(
        actor(),
        policy,
        Array.from({ length: 51 }, () => randomUUID()),
      ),
    ).rejects.toThrow();
  });
});
