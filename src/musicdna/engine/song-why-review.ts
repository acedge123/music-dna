import { z } from "zod";

export const songWhyReviewItem = z
  .object({
    axis: z.string(),
    verdict: z.enum(["pass", "fail", "uncertain"]),
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
          verdict: { type: "string", enum: ["pass", "fail", "uncertain"] },
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
1. Musical accuracy: assess concrete audible specifics for THIS recording. No audio is supplied; do not invent listening access. An inability to verify a recording-specific claim is uncertainty, not proof of an error.
2. Score alignment: does the audible evidence justify both the named pole AND the numerical magnitude? A correct direction alone does not justify an extreme score.
3. Axis confusion: identify when another attribute is doing the explanatory work. Restraint, intensity, distortion, loudness or artist reputation do not automatically establish Confidence (command versus vulnerability).
For example, Something in the Way at 95 Confidence warrants a challenge if vocal restraint is mistaken for defiance; 25 is only an illustrative suggestion, not a mandatory answer.
Verdict criteria:
FAIL: identify a clear contradiction, unsupported interpretation, axis confusion, or meaningful score mismatch. Explain the substantive problem. Unsupported interpretation means the stated evidence does not justify this attribute, NOT that you cannot verify the sound. Do not fail merely for generic wording, missing audio, or inability to verify instrumentation/production.
UNCERTAIN: a recording-specific claim cannot be independently verified and no identifiable substantive problem warrants failure. Specify what needs listening or an authoritative source.
PASS: explanation and score are coherent with no identifiable substantive problem; this is not verified listening.
If both uncertainty and a demonstrable substantive problem exist, use fail and explain both. Keep score disputes independent: missing audio/unverifiable detail alone must not dispute a score. Set score_disputed only for an identified score mismatch or attribute confusion; suggested_score is an advisory integer 0–100 only when justified, otherwise null and MUST be null when score_disputed=false. Never rescore or claim a proposed score is verified.`;

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
  return (
    row.score_disputed === true ||
    row.model_review_verdict === "fail" ||
    row.model_review_verdict === "uncertain"
  );
}
