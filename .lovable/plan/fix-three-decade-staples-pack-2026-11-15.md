# Fix three — decade staples pack

## Goal
Improve the chance that listeners’ three opening songs match known recordings, with verified years and lanes. Add useful same-lane matchups without changing the Critic, interview rules or saved readings.

## 1. Build a sourced shortlist before spending on scoring

Use published annual chart lists to assemble **160 distinct staple candidates total**:

| Release decade | Candidates |
|---|---:|
| 1970s | 10 |
| 1980s | 25 |
| 1990s | 25 |
| 2000s | 25 |
| 2010s | 25 |
| 2020s | 50 |

These are **per-decade shortlist targets, not that many songs from every year**. The recent pool covers 2020–2026, prioritizing the last few years; 2026 charts must be labelled provisional, not a completed year-end ranking.

- Record chart publisher, territory, chart year, actual rank, source URL and retrieval date. Use a consistent US mainstream chart baseline; label any supplemental lane-specific sources separately.
- Select recognizable recordings across years and artists; do not call an editorial shortlist an official “decade top 25.” Chart year does not substitute for original recording release year.
- Start by checking the latest catalog. Categorize every candidate as already active, already inactive, genuinely missing, or identity/release uncertain.
- Existing songs count toward the shortlist; **160 candidates does not mean 160 new inserts**. Never rescore existing songs to fill this pack.
- Include a specific audit of Roxanne, Little Red Corvette and the other recent unmatched opener examples.
- Deliver a candidate/coverage report first. No promised match-rate percentage: improvement must be measured.

## 2. AI-score only genuinely missing, verified recordings

- Reuse Song Intake’s scoring schema and the existing OpenAI scoring connection; no new paid provider or key on Vercel.
- Run explicit operator-requested small batches, with a displayed song count and bounded execution. No unattended job, onboarding model calls or automatic inference retries.
- Score the ten current dimensions within each song’s lane, using the current pole definitions, including Pressure ↔ Release.
- Keep recording identity, original year, lane, raw proposal, model/prompt version and review provenance together in a versioned pack.
- Human approval checks the musical reasoning and scores. Ambiguous recordings, uncertain years or invalid outputs remain held, not invented or silently replaced.
- Chart candidates must not masquerade as listener submissions or increase Song Intake demand counts. Keep this pack’s source/provenance separate from listener activity.
- Approved additions initially enter the catalog **inactive**. No automatic Song Whys approval, artwork substitution or enrollment into learning.

## 3. Make additions useful for matchups

- Audit pairing coverage for shortlisted songs, prioritizing those with no pairings; preserve existing song scores and pairings.
- Propose same-lane, reasonably familiar matchups with both songs near the intended era. Neighboring-year flexibility follows existing Explore rules, not new selection behavior.
- Each new pairing needs at least one declared current dimension with ≥20-point contrast, plus a specific unique pairing saying. Keep tests and sayings hidden before the choice.
- Report decade × lane × tested-dimension coverage, zero-pair songs, and how many eligible near-era offers remain after usage/skips. Do not force weak matchups to meet a numeric quota.
- Respect existing decade eligibility: no pre-1980 Electronic/Hip-hop; pre-1990 Classic Rock and later Metal for Explore; Disco in the 1970s; Punk in the 1970s–1990s. These are Explore rules, not permission to rewrite historical catalog lanes.
- Any lane or decade gaps that chart staples cannot repair remain explicit follow-up recommendations.

## 4. Review and activation gates

1. Review sourced shortlist, duplicate resolution and missing-song counts.
2. Review AI-scored drafts, proposed matchups and before/after coverage.
3. Run catalog validation and focused regression checks; hold all errors and activation-blocking warnings.
4. Present exact new-song and new-pairing IDs/counts for **separate activation approval**. Approval of this plan permits preparation, not production writes or switching songs on.
5. After approval, prepare a versioned, idempotent insert/activation artifact with source pins and a rollback limited to this pack. Any migration requires its own approval; no unrelated schema changes.
6. Verify database readback and fresh guest/registered web and REST interviews against the deployed revision. Flutter uses the shared catalog; Codex verifies the actual app.

## Regression and acceptance checks

- Shortlist counts are exactly 10/25/25/25/25/50; recording duplicates cannot inflate them, and provisional 2026 records remain identifiable.
- Identity collisions and alternate releases are held; rerunning an import never duplicates songs or unordered matchups.
- All scores are valid 0–100 values on the ten current axes. Pairings are same-lane and every declared test clears its 20-point contrast threshold.
- Existing catalog scores, saved choices, frozen evidence, readings and shares remain byte-for-byte unchanged.
- Guest and registered three-song onboarding still saves and restores; near-era preference retains its existing threshold/fade behavior, and skips never count as answered picks.
- Discover, Explore and refine eligibility/replay tests pass; song additions alone do not imply adequate pairing coverage.
- Readback confirms only approved pack rows became active; removing pack availability leaves historical evidence intact.
- Report catalog-match coverage on an anonymized aggregate of captured openers before/after, separating exact recording matches from ambiguous or artist-only matches. No export of listener inputs and no forecast presented as measured success.
- Report any unavailable authenticated or mobile acceptance honestly rather than treating local tests as deployed verification.

## Technical approach and boundaries

Store the sourced manifest, AI proposals, ID mapping, coverage report and reviewed write artifacts as a versioned catalog pack. Reuse `song-intake.ts`, the sole LLM gateway and `tools/musicdna/validate-catalog.ts`; resolve discrepancies in older expansion documents against current engine definitions. Keep bulk pack handling outside the listener capture trigger.

No changes to Critic voice/models, scoring of existing songs, Archetype profiles, opener weighting, era/lane expansion policy, checkpoint flags, API compatibility, sharing, analytics, consent, Agent Brain routing or learning/export settings. No catalog writes, migrations, paid scoring or deployment during this planning turn.