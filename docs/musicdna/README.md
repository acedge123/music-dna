# MusicDNA

Local working folder for the MusicDNA product thesis, ontology, diagnostic canon, and future pairing graph.

## Principle

We are not building a catalog of songs. We are building a catalog of revealing decisions.

The pairing is the IP. MusicDNA should not begin by generating thousands of mediocre pairings. It should begin by building a strong ontology, a focused diagnostic anchor set, and a smaller set of highly revealing matchups.

The app is not learning songs. It is learning tradeoffs.

The current strongest candidate dimension expansion is `immersion`: immediacy vs slow reveal. Example: choosing `Breaking Into Heaven` over `She Bangs the Drums` may reveal immersion over immediacy, journey over anthem, and atmosphere over hook.

## Lane Contract

MusicDNA separates routing lanes from diagnostic sub-lanes:

- `songs.primary_lane` is the top-level route: `alternative`, `pop`, `hip_hop`, `electronic`, `classic_rock`, or `general`.
- `songs.lane` is the granular catalog lane, such as `post_punk_new_wave`, `goth_darkwave`, `shoegaze_dreampop`, or `manchester_indie_dance`.
- `pairings.lane` matches the top-level route and should be validated against both songs' `primary_lane`.

This means `Ceremony` can remain `post_punk_new_wave`, `A Forest` can remain `goth_darkwave`, and their pairings can still correctly route through `alternative`.

## Current Structure

- [Flutter backend parity requirements](flutter-backend-parity-requirements.md):
  verified integration gaps, Lovable-owned chat/feedback/publication requirements,
  proposed contract additions, and cross-client acceptance gates.

- `docs/musicdna/ontology.md`: 15-dimension taste ontology, candidate dimension expansion, and pairing standards.
- `docs/musicdna/project_learnings_v1.md`: living synthesis of the project thesis, major discoveries, and MVP assumptions.
- `docs/musicdna/canon_workflow.md`: step-by-step curation process.
- `docs/musicdna/lovable_product_notes.md`: Lovable-facing notes for diagnostic tradeoff implementation.
- `docs/musicdna/lovable_lane_engine_prompt.md`: decision-complete Lovable prompt for the multi-lane engine MVP.
- `docs/musicdna/diagnostic_scoring_algorithm.md`: scoring model for diagnostic songs, axes, pairings, and future lane generation.
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

Next implementation handoff: use `docs/musicdna/lovable_lane_engine_prompt.md` to have Lovable build the multi-lane engine MVP.
