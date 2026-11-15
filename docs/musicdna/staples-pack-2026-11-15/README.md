# Decade staples — first review gate

Prepared 2026-11-15. **Review-only: no paid AI calls, catalog writes, activation, migrations, flags or application changes.**

## What is ready

`candidates.json` holds 160 unique sourced candidates at the approved shortlist targets: 10 / 25 / 25 / 25 / 25 / 50. These are editorial selections from chart evidence, not official decade rankings. Existing songs count toward the targets.

The connected catalog readback contains **886 songs, 852 active**. `catalog-baseline.json` pins identities, years, lanes, availability and active-pair counts; it contains no listener inputs or account information. It does not claim to pin full score vectors or frozen reading bytes: obtain those pins before any approved write.

| Initial exact-identity audit | Candidates |
|---|---:|
| Already active | 43 |
| Already inactive | 2 |
| Same-title/normalized-title records needing identity review | 9 |
| No exact identity found | 106 |

**106 is not an approved insert count.** Some may be alternate title spellings, chart credit variants or alternate recordings. No fuzzy match is automatically linked. Exact catalog matches also remain pending independent original-release verification; none is marked ready for paid scoring.

## Recent opener examples

- **True — Spandau Ballet:** active Pop, catalog year 1983; source chart rank 92 in 1983. Preserve existing scores.
- **Little Red Corvette — Prince:** chart rank 25 in 1983; absent from the connected catalog readback. Original recording/year and lane still require verification before scoring.
- **Roxanne — The Police:** absent from the readback, separate high-priority listener-driven candidate. Not forced into the 160-song chart shortlist without a retrieved rank source. Verify original 1978 recording; do not conflate it with Arizona Zervas’ different song.
- **Dreams — Fleetwood Mac:** active Classic Rock, catalog year 1977; no rescore needed. Dreams by another artist is not an interchangeable identity.

## Source limitations and holds

- Billboard’s requested **1991–2005** year-end pages returned the **2006** winner “Bad Day.” Those misleading responses were discarded. Selected 1991/1992/1995/1998 ranks instead use separately retrieved archive/search excerpts, explicitly labelled in each record. Direct source retrieval and recording metadata verification are still required before promotion.
- Some older publisher pages omit ranks. Observed ranks are preserved exactly; entries are never renumbered to close gaps.
- The 2000s shortlist currently skews to **2006–2009** because earlier publisher responses were wrong. The 1990s shortlist draws from five source years. Both need broader year/artist review before the pack is considered balanced.
- Current 2020s candidates use completed **2021–2025** charts, weighted toward 2024–2025. No trustworthy provisional 2026 chart was retrieved, and none is represented as a completed 2026 list. Verify a current dated source before adding/replacing 2026 candidates.
- Chart year is not original release year. Unknown originals stay null/pending, including remixes and duet credits; strict release-decade checks apply once originals are verified.
- Three exact shortlist matches have zero active pairs: **Beautiful Things**, **Ordinary** (currently inactive) and **Too Sweet**. Other identity-held records need resolution before their pairing counts can be interpreted. This audit is active-pair inventory, not selector eligibility or dimension coverage.
- This baseline does not measure onboarding hit rate, live eligible near-era depth, decade × lane × dimension coverage, or any improvement percentage. Those are later acceptance work, not inferred from song counts.

## Next gate

Review this shortlist and its year/identity holds before spending on scoring. Broaden the early-2000s sources and verify original release metadata, then run a small explicit OpenAI batch **only for verified missing recordings**. Current `scoringReady` returns false for every pending candidate.

After exact-draft human review, prepare same-lane pairing proposals, score/coverage pins and an idempotent inactive-insert artifact. Present exact IDs/counts for separate approval before production writes or activation. Never place chart candidates in the listener submission table or inflate demand.

## Checks

`tools/musicdna/staples-review.test.ts` covers exact shortlist counts, duplicate rejection, provisional-2026 labelling, identity/year scoring gates and original-release decade conflicts. Run with `bunx vitest run tools/musicdna/staples-review.test.ts`.

No running user interface changed, so browser interview acceptance is not implied by these artifact checks. Guest/registered web, REST and Flutter checks belong to the later approved activation gate.