import type { Ledger, LedgerChoice } from "./evidence";
import { expectedCatalog } from "./evidence-snapshot";

// Fields that differ between a pre-pick hypothetical and the frozen vote but
// never reach the critic. Everything else must match exactly to reuse a draft.
const VOLATILE = new Set(["choice_id", "created_at", "catalog_revision"]);

/** Exact identity of everything the critic sees for a post-pick read. */
export function readFingerprint(ledger: Ledger, priorThesis: string | null | undefined, priorAnswered: number | null | undefined) {
  return JSON.stringify(
    { ledger, prior: priorThesis ?? null, priorAnswered: priorAnswered ?? null },
    (k, v) => (VOLATILE.has(k) ? undefined : v),
  );
}

/** The evidence a vote for `chosen` would freeze, built from the current catalog row. */
export function hypotheticalChoice(
  pairing: {
    id: string;
    updated_at?: string | null;
    tests: string[] | null;
    diagnostic_weight: number | null;
    user_facing_tradeoff?: string | null;
  },
  chosen: Record<string, unknown>,
  rejected: Record<string, unknown>,
): LedgerChoice {
  const c = expectedCatalog(pairing, chosen, rejected);
  const song = (s: typeof c.chosen) => ({
    ...s.values,
    id: s.id as string,
    title: s.title as string,
    artist: s.artist as string,
    year: s.year,
    lane: s.lane,
    primary_lane: s.primary_lane,
  });
  return {
    pairing_id: pairing.id,
    pairing_revision: c.pairing_revision,
    pairing_saying: pairing.user_facing_tradeoff ?? null,
    tests: c.tests,
    diagnostic_weight: c.diagnostic_weight,
    chosen: song(c.chosen),
    rejected: song(c.rejected),
    provenance: "pairing",
  };
}
