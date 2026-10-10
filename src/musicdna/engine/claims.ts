// Common claim policy (D01). Editorial thresholds, not validated probabilities.
// A supported tendency needs >= 3 distinct supporting pairings, directional
// consistency >= 0.65, and support strictly exceeding contradiction.
// 3–1 → qualified claim; 2–2 never qualifies; 2 supports stays provisional.

export const CLAIM_POLICY_VERSION = "d01-v1";
export const CLAIM_MIN_SUPPORT = 3;
export const CLAIM_MIN_CONSISTENCY = 0.65;

export type ClaimStatus = "supported" | "qualified" | "provisional" | "mixed" | "insufficient";

export function evaluateClaim(
  supporting: number,
  contradicting: number,
): {
  status: ClaimStatus;
  eligible: boolean;
  consistency: number;
} {
  const directional = supporting + contradicting;
  const consistency = directional > 0 ? supporting / directional : 0;
  if (directional === 0) return { status: "insufficient", eligible: false, consistency };
  if (supporting <= contradicting) return { status: "mixed", eligible: false, consistency };
  if (supporting < CLAIM_MIN_SUPPORT)
    return { status: "provisional", eligible: false, consistency };
  if (consistency < CLAIM_MIN_CONSISTENCY) return { status: "mixed", eligible: false, consistency };
  return { status: contradicting > 0 ? "qualified" : "supported", eligible: true, consistency };
}
