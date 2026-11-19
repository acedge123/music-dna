/** Public operator contract only: no provider credentials or model invocation. */
export const WHY_AI_POLICY_VERSION = "saved-song-why-review-v2" as const;
export const WHY_AI_POLICY_VERSIONS = ["saved-song-why-review-v1", WHY_AI_POLICY_VERSION] as const;
export const WHY_AI_VERDICTS = ["pass", "fail", "uncertain"] as const;
export const whyAiReviewPolicy = {
  version: WHY_AI_POLICY_VERSION,
  verdicts: WHY_AI_VERDICTS,
  criteria: {
    pass: "Coherent explanation and score with no identified substantive issue; not verified listening.",
    fail: "Identified contradiction, unsupported interpretation, axis confusion or meaningful score mismatch.",
    uncertain:
      "Recording-specific detail needs verification without an identified substantive issue. Missing audio alone is neither failure nor a score dispute.",
  },
  score_advice: "Independent advisory integer 0–100 or null. No automatic correction.",
  rates:
    "Fail/completed and Uncertain/completed, separately per policy and latest attempt per explanation. Operational failures are unavailable attempts. Empty denominators are null. These are reviewer outcomes, not verified catalog error rates.",
  history: "Prior policy reviews remain unchanged; never relabel v1 results as v2.",
  paid_request:
    "Explicit selected-version/context confirmation and catalog_review permission required. No writer or automatic retry. Existing ten-new-requests-per-caller-per-rolling-hour limit remains in force.",
} as const;
