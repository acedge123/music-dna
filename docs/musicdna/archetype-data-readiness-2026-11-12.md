# Archetype + song-dimension data readiness (build12)

Read-only diagnostics, 2026-11-12 (explicit READ ONLY transaction, 10s timeout, aggregates only).

## Verified
- Profiles: Anthemist, Atmospherist, Hedonist, Romantic, Transformer, Witness **approved v1**; Architect, Believer, Seeker, Storyteller **draft v1**.
- Saved results carrying `archetype_v2`: **0**. No reading has a frozen identity yet, so nothing saved can disagree after an edit.
- Song Whys: 64 approved explanations covering 22 of 852 active songs (~2.6%).
- Recent migrations present: 20261111051921, 20261111052728, 20261111062106, 20261111062251, 20261112050403, 20261112051619, 20261112051748, 20261112053405.

## Provenance (decided)
- Archetype is matched **once at save time** (`computeArchetypeV2` in `finalSynthesisCore`) and frozen in result v1 `content.archetype_v2` with `profile_version` and `profile_core`. `dnaSummaryFor` reads only that frozen value; it does not rematch on read.
- Editing a profile's weights now bumps `version`, so a later frozen match names a different version than older readings.
- Report envelope separates `frozen` (prose, signature, saved archetype) from `annotations` (deterministic panel recomputed from frozen choices).
- `confirmed` requires ≥4 **distinct** matchups across the core traits (a pairing testing several traits counts once), ≥2 core traits, score/margin floors, >1 genre, no thematic requirement. Draft/retired profiles are never matched.

## Not verified / not done
- `MUSICDNA_ARCHETYPE_V2` on Vercel production: no access from here — unverified.
- Song explanations are **not yet** fed into the vote snapshot, Critic or chat. Wiring must freeze explanation id + `score_at_write` into `choices.evidence` behind a default-off flag; never reread current text for old choices.
- Coverage gap: ~830 active songs have no approved explanation; no bulk generation authorised in this ticket.
- Deployment, signed-in and Flutter acceptance are separate checks.
