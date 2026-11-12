# Engine rules

- Decade (`explore`) and `refine` runs are children of a finished reading; refine evidence is cumulative via `loadReadingEvidence`; discover routing untouched.
- Reading DNA panel comes only from `buildDnaSummary` (frozen evidence + stored archetype) — no unearned counts/archetypes.
- Archetype matching v2 (`archetype-v2.ts`) uses only admin-approved `archetype_profiles` over the 10 current traits, behind `MUSICDNA_ARCHETYPE_V2=1`; when it is off, readings show no archetype — legacy profiles use an obsolete trait system.
