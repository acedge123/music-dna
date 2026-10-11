# 2000–2026 catalog coverage — scope (CAT06–CAT08)

Status: scoping draft, Oct 11 2026. Inventory taken from the live connected database (active rows only), not seed CSVs.

## Inventory snapshot

| Lane | Active songs | Pre-2000 | 2000–09 | 2010–19 | 2020–26 | Active pairings | Pairings with a 2000+ song |
|---|---|---|---|---|---|---|---|
| alternative | 179 | 179 | 0 | 0 | 0 | 16 | 0 |
| general | 107 | 89 | 9 | 5 | 4 | 31 | 20 |
| pop | 53 | 7 | 6 | 28 | 12 | 17 | 15 |
| classic_rock | 40 | 40 | 0 | 0 | 0 | 18 | 0 |
| electronic | 39 | 27 | 8 | 4 | 0 | 11 | 3 |
| hip_hop | 39 | 19 | 8 | 12 | 0 | 14 | 12 |
| **Total** | 457 | 361 | 31 | 49 | 16 | 107 | 50 |

No active country, R&B, metal, Latin or indie-modern lane songs.

## Gaps, by severity

1. **Pairings, not songs, are the bottleneck.** A six-answer session needs room for repeat tests, counterexamples and skip/retest. Most lanes have 11–18 pairings total; modern pools are thinner still.
2. **Alternative has zero songs after 1999** despite being the largest lane. A listener opening with 2000s indie / 2010s alt gets routed to a lane with nothing they know.
3. **Hip-hop and electronic stop at 2019.** No 2020s at all.
4. **Missing territories:** R&B/soul, country, Latin, metal (seed was removed), K-pop/global pop. Each needs a backend lane decision before curation (within-lane rule: no cross-lane equivalence).
5. Pop is the only lane already modern-weighted.

## Proposed targets (first pass)

Per covered lane, per decade bucket (2000–09, 2010–19, 2020–26): ~15 songs and ~8 pairings, different artists, max 2 songs per artist per bucket.

| Phase | Work | Rough size |
|---|---|---|
| A | Alternative, hip-hop, electronic modern buckets | ~120 songs, ~65 pairings |
| B | Pop 2000s top-up; general lane cleanup | ~25 songs, ~15 pairings |
| C | New lanes (R&B, country first) — needs lane decision + routing in shadow | ~45 songs/lane, ~24 pairings/lane |

## Per-candidate record (unchanged schema)

Title, artist, original release year/version, metadata source + access date, sub-lane, subculture slugs, editorial rationale, ten-axis scores (calibrated against existing reviewed anchors), declared tests per pairing, review status. Factual metadata kept separate from subjective scores. 2026 releases confirmed released.

## Acceptance

- Deterministic fixtures per era/lane, mixed-era openers, unfamiliar modern tracks, same-artist concentration — run through the real selector.
- Completed sessions keep frozen evidence after catalog edits; challenges keep their pairing set.
- Staged via existing catalog admin; D01 thresholds never lowered.
- Measured with real listeners: opener routing, skip rate, pool exhaustion, result specificity.

## Decisions (Oct 11 2026)

1. **Pilot:** Alternative lane, 2000–2026, end-to-end (draft → review → stage → fixtures → listener check) before Phase A expands.
2. **Curation:** AI drafts candidates and scores calibrated to reviewed alternative anchors; Alan reviews and approves before anything is activated.
3. **New lanes, in order:** R&B/soul, then country. Each needs a lane/routing decision with backend first; routing stays in shadow.

## Next step

Draft ~45 alternative candidates (15 per decade bucket) plus ~24 pairings as an inactive review sheet. Nothing goes live without approval.
