# Post-choice sayings — critic expression v2.1

New votes freeze `pairings.user_facing_tradeoff` in the additive `choices.evidence.editorial` block (`pairing-saying-v1`), outside scoring/catalog fingerprints. The existing stale-catalog guard, atomic vote, immutable evidence and saved-response replay remain unchanged. Old evidence is not backfilled from mutable catalog sayings.

Verified snapshot parsing passes the frozen saying only when editorial/catalog pairing revisions match. The shared critic facts include `post_choice_saying` alongside declared tradeoffs with at least 20 points of contrast, `chosen_direction` (`hi`/`lo`) and chosen/rejected pole labels. Author and semantic reviewer receive the same context. All these choices have already been answered; next-pairing payloads still omit sayings and rationale.

Sayings are optional editorial inspiration, not new evidence. Clause order does not determine the winner. Literal musical claims, motives and tendencies still require existing factual/claim validation. Historical results and saved current reads replay unchanged; missing historical sayings remain null.

Web and REST current reads use the same authoring boundary; Flutter continues rendering returned read text. The immediate atomic `verdict`/`why` acknowledgement remains deterministic for replay safety; the following running read is the expressive surface. No new client-side prose or pre-pick disclosure was added.

Verification: 35 tests passed (critic boundary, snapshot compatibility, ledger), changed-file lint clean and preview build OK. Guest Yacht Rock opener → choice → round 2 succeeded. Database readback confirmed the selected saying (“Bassline with a grudge, or harmonies that let yesterday breathe?”), tested axes and chosen contrasts frozen on the new vote. In that run the semantic reviewer rejected generated prose and displayed the deterministic fallback; wiring is verified, consistent acceptance/voice quality is not. No validation was weakened to force a saying onto the screen.

The migration introduced no security findings; 43 pre-existing database lint findings remain as recorded in the catalog audit. Production deployment/Flutter display acceptance remain unverified.