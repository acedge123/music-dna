# Engine rules

- Decade (`explore`) and `refine` runs are children of a finished reading; refine evidence is cumulative via `loadReadingEvidence`; discover routing untouched.
- Reading DNA panel comes only from `buildDnaSummary` (frozen evidence + stored archetype) — no unearned counts/archetypes.
- Archetype v2 (`archetype-v2.ts`) matches approved `archetype_profiles` at save time only (behind `MUSICDNA_ARCHETYPE_V2=1`) and freezes the match + profile version in result v1 `content.archetype_v2`; readings display only that frozen value, so later approvals never change a saved identity. Near-twin runner-ups are ignored; confirmation needs evidence on ≥2 core traits.
- Checkpoint flow (`checkpoints.ts`, flag `MUSICDNA_CRITIC_CHECKPOINTS=1`): Critic writes/pre-drafts only at answered 2, 4 (and final); flag off keeps per-pick flow as the instant revert. Flow is frozen per session via a server `interview_flow_assigned` event at start (`sessionFlowImpl`), so flag flips only affect new interviews.
