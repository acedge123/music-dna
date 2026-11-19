import { z } from "zod";

export const songWhyReviewItem = z
  .object({
    axis: z.string(),
    verdict: z.enum(["pass", "fail"]),
    note: z.string().trim().min(1).max(2000),
    score_disputed: z.boolean(),
    suggested_score: z.number().int().min(0).max(100).nullable(),
    reason: z.string().trim().min(1).max(2000),
  })
  .superRefine((item, ctx) => {
    if (!item.score_disputed && item.suggested_score !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Undisputed scores cannot have a replacement suggestion",
      });
    }
  });

export const SONG_WHY_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["axis", "verdict", "note", "score_disputed", "suggested_score", "reason"],
        properties: {
          axis: { type: "string" },
          verdict: { type: "string", enum: ["pass", "fail"] },
          note: { type: "string" },
          score_disputed: { type: "boolean" },
          suggested_score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
          reason: { type: "string" },
        },
      },
    },
  },
};

export const SONG_WHY_REVIEW_INSTRUCTIONS = `Independent music reviewer. Challenge the supplied score rather than rationalizing it. Evaluate each attribute within the recording's stated lane.
1. Musical accuracy: verify concrete audible specifics for THIS recording. Flag questionable specifics or uncertainty; do not invent listening access or facts.
2. Score alignment: does the audible evidence justify both the named pole AND the numerical magnitude? A correct direction alone does not justify an extreme score.
3. Axis confusion: identify when another attribute is doing the explanatory work. Restraint, intensity, distortion, loudness or artist reputation do not automatically establish Confidence (command versus vulnerability).
For example, Something in the Way at 95 Confidence warrants a challenge if vocal restraint is mistaken for defiance; 25 is only an illustrative suggestion, not a mandatory answer.
Fail explanations with absent sounds, generic descriptions, invented facts, unsupported scores or axis confusion. Independently set score_disputed when the score is questionable. suggested_score is an advisory integer 0–100 only when justified, otherwise null; it MUST be null when score_disputed=false. reason explains the score decision and uncertainty. Never rescore or claim a proposed score is verified.`;

export function parseSongWhyReview(value: unknown, axes: string[]) {
  const result = z.object({ items: z.array(songWhyReviewItem) }).parse(value);
  if (
    result.items.length !== axes.length ||
    new Set(result.items.map((i) => i.axis)).size !== axes.length ||
    result.items.some((i) => !axes.includes(i.axis))
  ) {
    throw new Error("Reviewer must return exactly one decision per requested attribute");
  }
  return result.items;
}

export function reviewStorageFields(review: z.infer<typeof songWhyReviewItem>) {
  return {
    status: "pending_review",
    model_review_verdict: review.verdict,
    review_note: review.note,
    score_disputed: review.score_disputed,
    suggested_score: review.suggested_score,
    score_dispute_reason: review.reason,
  };
}

export function requiresIndividualReview(row: {
  score_disputed?: boolean;
  model_review_verdict?: string | null;
}) {
  return row.score_disputed === true || row.model_review_verdict === "fail";
}
