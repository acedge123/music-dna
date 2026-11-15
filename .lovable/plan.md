# Fix opening-era selection without changing interview policy

## Scope
Repair **#1 only**: loading the listener’s opening-song analysis so the existing era preference can actually run. No staging queue, AI scoring, catalog expansion or Flutter UI work.

## What the code currently shows
- Web and mobile’s next-matchup endpoint both use `nextPairingImpl`.
- That function requests `profiles!inner(...)` through `sessions`, then ignores the lookup error. The supplied schema has no direct sessions-to-profiles relationship, so this is a concrete suspected failure point—not evidence that mobile’s older matchup was random luck.
- With no opening analysis, both opener-era preference and opener-lane restrictions lose their inputs.

## Proposed repair
1. Reproduce the relationship lookup failure and confirm the owner’s profile can be read directly using the same caller-scoped access.
2. Read and validate the session first; fetch `profiles.opening_analysis_json` directly using that validated session’s `user_id`. Never accept an owner ID from the client or use privileged access.
3. Pass the returned analysis into the existing opener-lane and opener-era logic. Keep the current treatment of a genuinely missing profile or unmatched songs; report a real query failure rather than silently treating it as missing opener data.
4. Keep web and REST on the same implementation, with unchanged response shapes and no new feature flag.

## Rules that stay unchanged
- Three ranked opening songs, weighted 3–2–1.
- Soft era window: known opener years expanded by ten years; preference applies before three answered choices, only when at least three eligible near-era matchups remain.
- Skips exclude a matchup but do not count as answered choices.
- Existing lane restrictions, eligibility, randomness, wider-probe behavior and later-round selection remain intact. This does **not** promise identical pairs across sessions or exclusively ’80s songs.
- Discover, Explore/refine, Critic models/voice, checkpoints, scoring, evidence, frozen readings, sharing, analytics and learning settings are not redesigned.

## Regression checks
Add tests beside the existing selection/adapter tests, not just tests of the standalone era helper:
- A visible session loads its owner’s opening analysis directly; no unsupported relationship query is used.
- An inaccessible/nonexistent session never proceeds to another listener’s profile lookup.
- With only **True (1983)** matched, the calculated window is **1973–1993**; three eligible pairs inside that window exclude a 2002/2003 or 2024/2025 candidate during the opening choices.
- No matched years keeps the current fallback; fewer than three eligible near-era pairs also keeps the current fallback.
- At three answered choices the era preference fades; skipping alone does not advance that boundary.
- Profile query errors are distinguishable from a legitimate missing profile.
- Opener-lane filtering receives the recovered analysis; Explore/refine retain their separate selection paths.
- Web and REST consume the same result without changing v0/v1 contracts.

## Acceptance before calling it fixed
- Run the new regression tests and relevant existing era, pairing, session-access, decade/refine and client-contract tests; check preview compilation and errors.
- In a fresh preview interview, enter **True, Roxanne and Little Red Corvette**. Check the stored matched IDs/years and selected eligible pool, then confirm the displayed first matchup reflects the recovered preference. Do not count one randomly older matchup as proof.
- Verify reload and skip still work. Compare REST selection against the same controlled opener inputs where authenticated access is available.
- Report verified preview results separately from production/mobile results. Production requires the updated Vercel deployment; actual Flutter rendering remains Codex’s check.

## Boundaries and rollback
No database migration, data edits, environment changes or production activation. Keep the implementation diff restricted to the lookup repair and focused tests; reverting it restores the previous behavior without affecting saved data.

**Known separate issue:** opener analysis is currently stored on the account profile, not frozen per session. Another interview may overwrite it. Session-specific opener persistence is outside this repair and will not be claimed solved.

## Technical details
Primary change: `src/lib/musicdna.functions.ts` (`nextPairingImpl`). Reuse the existing era policy in `src/musicdna/engine/opener-era.ts`; add focused tests for the database-read wiring as well as concrete era outcomes. Preserve caller-scoped Supabase access and the existing web/REST entry points.