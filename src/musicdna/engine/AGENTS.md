# Engine rules

- Decade (`explore`) and `refine` runs are children of a finished reading; refine evidence is cumulative via `loadReadingEvidence`; discover routing untouched.
- Reading DNA panel comes only from `buildDnaSummary` (frozen evidence + stored archetype) — no unearned counts/archetypes.
- Archetype v2 (`archetype-v2.ts`) matches approved `archetype_profiles` at save time only (behind `MUSICDNA_ARCHETYPE_V2=1`) and freezes the match + profile version in result v1 `content.archetype_v2`; readings display only that frozen value, so later approvals never change a saved identity. Near-twin runner-ups are ignored; confirmation needs evidence on ≥2 core traits.
