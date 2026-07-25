// Phase 4: translate a regime recommendation into PairingKnobs.
//
// Small, opinionated, and boring on purpose. Each regime tweaks 2-3 knobs;
// everything else falls back to DEFAULT_PAIRING_KNOBS. We are improving the
// engine, not rebuilding the car — the goal is that shadow diffs are
// interpretable, not maximally aggressive.
//
//   explore   → widen the field. Soft fork filter so leaning axes are a
//               preference, not a wall. Push the axis-need slope up so
//               under-tested axes pull harder.
//   prune     → today's behaviour. Hard fork filter, standard boost.
//   compound  → exploit the leaning read. Hard fork filter, lower the
//               axis-need slope so we're not force-visiting cold axes when
//               the picture is already sharp.
//   coordinate→ treat like prune (no-op safety; the mapper rarely emits it
//               here and we don't have a distinct handling worth inventing).
//
// `mode` and `canon_floor` are intentionally NOT overridden. Recognition
// gating stays a function of lane confidence — the regime shouldn't force
// obscure pairings on a general-lane user just because it wants to explore.

import type { PairingKnobs } from "@/musicdna/engine/pairing";
import type { Regime } from "./scoring";

export type RegimeKnobs = Partial<PairingKnobs>;

export function regimeToKnobs(regime: Regime): RegimeKnobs {
  switch (regime) {
    case "explore":
      return {
        fork_filter: "soft",
        challenge_boost: 1.8,
        axis_need_slope: 0.75,
      };
    case "compound":
      return {
        fork_filter: "hard",
        challenge_boost: 1.2,
        axis_need_slope: 0.4,
      };
    case "coordinate":
    case "prune":
    default:
      return {
        fork_filter: "hard",
        challenge_boost: 1.5,
      };
  }
}
