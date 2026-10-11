# Evidence-Bounded Claim Language

TGA-304, stacked on TGA-303. D01 thresholds remain unchanged (`d01-v1`).
Language/rendering version: `claim-language-v1`. Deployed and editorial acceptance pending.

## Ceilings

| Evidence | Maximum Language |
| --- | --- |
| One valid directional choice | Observation about that choice, never a pattern |
| Two agreeing choices | Tentative, explicitly not supported |
| Provisional direction with contradiction | Contested, with actual counts |
| Balanced or insufficiently consistent evidence | Mixed, no supported directional lean |
| At least 3 distinct supports, support > contradiction, consistency >= .65 | Supported tendency within these choices |
| Supported with contradiction, including 3-1 | Qualified tendency with named exception |
| Unknown/invalid historical or catalog evidence | Explicitly unavailable, never invented |

Contrast magnitude never changes directional consistency. A cosine match is archetype
fit, not the probability a claim is true; finalization uses the engine's existing fit tiers.
The profile uses support/test counts rather than percent confidence. Opener lane estimates
are labeled estimates. The older five-song opener retains valid candidates as untested
priors only; it no longer grants stable claims from an independent song-count rule.

## Generation Boundary

The model selects eligible claim/direction/choice IDs. The application validates every
reference and renders deterministic, evidence-bounded clauses. Free prose, invented IDs,
duplicate claims/supports, a contradiction cited as support, and noneligible claims are
rejected. The renderer cannot drop a qualification or exception. Invalid generation and
narrator failure have separate statuses and fall back to the same ledger; they are not
misreported as insufficient evidence. No model call is needed for insufficient evidence.

This intentionally narrows V1 creative freedom. Final synthesis, final reasoning and
round insights use this boundary. Chat selects grounded claims and a bounded follow-up
question; acknowledgement quotes the listener's own words as self-report, never as added
pairing support. Repeated claim text is suppressed. Review this conservative voice with
ACE before accepting the web reference (TGA-314). Richer generated prose requires a
separate evaluated validation contract; a prompt alone cannot verify arbitrary prose.

Vote acknowledgements describe only the selected songs. Tap timing and round number
cannot unlock personality or decisiveness claims. Timing remains diagnostic metadata.

## Running Read Persistence

`projectRead` is pure. The server records its complete result with language/ledger/policy
versions in trusted `read_shown` evidence, and sequential replay at the same answer count
returns that exact result. Persistence errors propagate rather than pretending resume
evidence was saved. Concurrent multi-request replay/order guarantees still need the
TGA-305/306 integration acceptance; this is not a new atomic read RPC.

Existing saved results stay frozen and replay unchanged. Old result wording is not
silently rewritten. Explicit historical/version migration requires separate approval.
New synthesis saves the same captured ledger used to render it, never a later reload.
New vote history uses frozen titles/metadata and original A/B orientation. Legacy history
keeps its existing display joins for compatibility but labels them `legacy_unavailable`;
those rows cannot support a claim in the authoritative ledger. The un-applied TGA-303
migration gains original A/B IDs as additive snapshot metadata in this stacked change.
No Flutter DTO port, production migration/deployment, live routing or Railway calls.

## Tests And Remaining Acceptance

Tests exercise 1/2/3-support ceilings, 2-2 with extreme contrast magnitude, qualified 3-1,
directional references, conflicting/sparse/invalid evidence, narrator rejection/failure,
self-report separation, repetition and actual revision examples. TGA-303's database
harness remains required. Full migration-chain, authenticated staging routes, deployed
result replay and human voice/device acceptance remain pending.
