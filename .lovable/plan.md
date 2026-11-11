# Explore Your DNA — decade exploration mode

Yes, same page. The six-pick interview ("Discover your DNA") stays exactly as it is. Decades are a separate, after-reading mode ("Explore your DNA"): the decade is the setting, your traits are the experiment.

## What listeners see
1. After a completed reading, a new "Explore your DNA" panel lists decades: '70s, '80s, '90s, 2000s, 2010s, 2020s. Each decade only appears if it has enough playable matchups.
2. Picking a decade starts a short run: six choices by default, with the option to stop after four, same as the interview. The matchups mix genres from that era, keeping each matchup inside one genre and staying near your opening genres where possible.
3. Matchups lean toward your strongest traits from the original reading, with roughly one in three chosen to surprise you (a trait you haven't been tested on, or one that could cut against your read).
4. At the end, the Critic writes a short decade read, such as "Inside the '70s, your pull toward rawness got louder, and immersion went quiet." It compares against your original reading but never changes it.
5. Signed-in listeners keep every decade run on their account (the "Me" page) under the original reading. Guests can play, but have to sign in to save.

## What stays untouched
- The main interview, its matchup picker, the Critic prompts and models, saved readings, sharing, learning and export.
- The original reading is frozen. A decade run is its own saved session that points back to it.

## Catalog coverage report
- A new admin view shows playable matchups by decade × trait (not song counts), with a ready/thin/empty status for each cell.
- A decade unlocks at roughly 10 or more live matchups covering at least 6 traits (both numbers are adjustable).
- Era rules apply: no Electronic or Hip-hop before 1980, Classic Rock before 1990 with Metal after it, Disco in the '70s, Punk from the '70s to the '90s. A year of leeway is allowed (1979 counts as the '80s).

## Build order
1. Coverage report (admin), so we can see which decades are ready.
2. Decade session: create, pick matchups, record choices, all reusing today's retry-safe vote pipeline.
3. Decade read: one Critic call at the end, with the same reviewer and fallback rules.
4. Web screens: the Explore panel after the reading, the decade run, and the decade read, plus a history list on the Me page.
5. Tests for the rules: decade bounds, the one-in-three surprise picks, the original reading never changing, sign-in required to save.

## Technical details
- `sessions` gets nullable `mode` ('discover' | 'explore'), `decade`, `parent_session_id`. Existing rows read as discover. The migration is additive, applied after approval.
- The decade picker filters the pool to pairings where both songs fall in the decade window (±1 year), then calls `selectPairing` with the parent's frozen vector as a prior and `fork_filter: "soft"`, plus an exploration slot every third pick. The main-interview call sites are unchanged.
- The evidence ledger and claims come from the decade session's own frozen choices. The comparison to the parent uses the parent's saved `session_results` v1 only.
- REST/Flutter: an opt-in `POST /api/v1/session/:id/explore {decade}` behind the experience header, added after web acceptance.
- Prepared reads and the reaction pool stay off for explore mode at first, which keeps cost and risk down.

## Open question
- Should a guest who explores and then signs in keep their decade runs? That needs the safe account-linking work that's already pending. Proposed for v1: guests can play but nothing is saved.
