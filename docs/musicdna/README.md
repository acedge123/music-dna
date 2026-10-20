# MusicDNA

Local working folder for the MusicDNA product thesis, ontology, diagnostic canon, and future pairing graph.

## Current catalog handoff

Start with the [CAT06 independent recheck and next Lovable instructions](cat06-recheck-2026-10-20.md). At the 2026-10-20 recheck, 31 songs and 23 pairings were active; six songs and seven pairings remained held. The revised scores pass the checked numeric rules. Remaining priorities are active axis coverage and 17 older active Alternative pairings with no declared tests.

The [original inactive catalog review](inactive-catalog-review-2026-10-20.md) records the initial 37-song/23-pairing audit and correction workflow. [Lovable's recalibration report](cat06-recalibration-2026-10-20.md) and the versioned data describe the pre-activation review. Treat these as dated snapshots; re-query current data before applying proposals.

For current axis definitions use [catalog-expansion-spec.md](catalog-expansion-spec.md) and [`src/musicdna/engine/axes.ts`](../../src/musicdna/engine/axes.ts). Legacy ontology and scoring documents contain obsolete dimension lists; their axis lists must not drive new scoring. The six-component diagnostic-power formula remains useful.

## Principle

We are not building a catalog of songs. We are building a catalog of revealing decisions.

The pairing is the IP. MusicDNA should not begin by generating thousands of mediocre pairings. It should begin by building a strong ontology, a focused diagnostic anchor set, and a smaller set of highly revealing matchups.

The app is not learning songs. It is learning tradeoffs.

`immersion` is an active diagnostic dimension: immediacy vs slow reveal. Example: choosing `Breaking Into Heaven` over `She Bangs the Drums` may reveal immersion over immediacy, journey over anthem, and atmosphere over hook.

## Lane Contract

MusicDNA separates routing lanes from diagnostic sub-lanes:

- `songs.primary_lane` is the top-level route: `alternative`, `pop`, `hip_hop`, `electronic`, `classic_rock`, or `general`.
- `songs.lane` is the granular catalog lane, such as `post_punk_new_wave`, `goth_darkwave`, `shoegaze_dreampop`, or `manchester_indie_dance`.
- `pairings.lane` matches the top-level route and should be validated against both songs' `primary_lane`.

This means `Ceremony` can remain `post_punk_new_wave`, `A Forest` can remain `goth_darkwave`, and their pairings can still correctly route through `alternative`.

## Current Structure

- `docs/musicdna/catalog-expansion-spec.md`: current ten-axis song and pairing curation contract.
- `docs/musicdna/cat06-recheck-2026-10-20.md`: independent post-update review, active coverage findings, and next Lovable instructions.
- `docs/musicdna/cat06-recalibration-2026-10-20.md`: Lovable's pre-activation recalibration report.
- `docs/musicdna/inactive-catalog-review-2026-10-20.md`: original dated CAT06 audit and correction workflow.
- `docs/musicdna/ontology.md`: historical 15-dimension ontology and product thesis; its dimension list is superseded.
- `docs/musicdna/project_learnings_v1.md`: living synthesis of the project thesis, major discoveries, and MVP assumptions.
- `docs/musicdna/canon_workflow.md`: step-by-step curation process.
- `docs/musicdna/lovable_product_notes.md`: Lovable-facing notes for diagnostic tradeoff implementation.
- `docs/musicdna/lovable_lane_engine_prompt.md`: decision-complete Lovable prompt for the multi-lane engine MVP.
- `docs/musicdna/diagnostic_scoring_algorithm.md`: six-component DPS model and historical pairing guidance; its active-axis list is superseded.
- `docs/musicdna/product_gotchas.md`: standing risk checklist to keep product, data, and inference claims honest.
- `docs/musicdna/multi_lane_pairings_seed.md`: notes for the Pop, Hip-Hop, Electronic, and Classic Rock pairing seed.
- `docs/musicdna/intelligence_layer.md`: evidence-first AI reasoning framework for Analyst and Critic layers.
- `docs/musicdna/engine-integration.md`: how to wire `createEngine(deps)` into a new transport and how to build a new adapter for a port.
- `docs/musicdna/engine-migration.md`: status log for the extraction from `musicdna.functions.ts` into `src/musicdna/engine/`.
- `tools/musicdna/generate_alternative_canon.cjs`: deterministic seed-canon generator.
- `tools/musicdna/validate_canon.cjs`: CSV-aware canon validator.
- `data/musicdna/alternative_diagnostic_canon_seed.csv`: generated Alternative/Post-Punk diagnostic canon seed.
- `data/musicdna/diagnostic_axis_anchors.tsv`: cross-lane anchor songs organized by diagnostic axis.
- `data/musicdna/diagnostic_song_scoring_template.tsv`: curator scoring template for DPS components and canon score.
- `data/musicdna/multi_lane_pairings_seed.tsv`: 20 diagnostic pairings each for Pop, Hip-Hop, Electronic, and Classic Rock.

## Next Step

Current catalog handoff: follow [the independent recheck's next correction pass](cat06-recheck-2026-10-20.md#lovables-next-correction-pass). The older `lovable_lane_engine_prompt.md` describes the original multi-lane engine MVP and must be reconciled with current engine contracts before reuse.
