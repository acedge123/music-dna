# Earn the archetype: "why this score" + archetypes on today's 10 traits

## What I confirmed in the live data
- 886 songs, all scored. 429 have a written note, and at least 165 of those only describe the process ("editorial estimate, validation pending"), not why the song scores that way.
- There are 10 archetypes, not 12. All 10 are still defined on an older 15-trait system (energy, groove, darkness, verbal cleverness...). Only 4 of those (movement, atmosphere, community, transformation) exist in today's 10 traits, and every value is 0–100, so "the opposite" of a trait can't be expressed.
- Result: archetype matching can't see texture, tension, confidence, perspective, scale or immersion, the traits driving readings now. That's why your daughter's refinement lean got a weak Atmospherist match.

## Step 1: stop false archetypes now (small, safe)
- Until the new archetype profiles are approved, the final reading always shows the emerging signature (Sol's name and hook) and never a "confirmed archetype".
- Saved readings are untouched.

## Step 2: archetypes on the 10 current traits (your approval needed)
- For each archetype, store a new versioned profile:
  - 3–4 core traits with a direction and weight (e.g. Architect: refinement, command)
  - weaker supporting traits
  - what separates it from its closest neighbor
  - a note when part of its meaning is thematic (Seeker, Believer), so we don't fake a number
- Start from the draft map in your notes. I'll put it on an admin page for you to approve or edit before it goes live.
- Matching uses the signed traits and requires enough relevant comparisons, a clear gap to the runner-up, and more than one genre. The old profiles stay for history.
- The reading can then say why: "Leaning Architect — Still D.R.E. and California Love support it; Bodak Yellow complicates it."

## Step 3: "Why this score?" for songs
- For each song, only its 2–3 most distinctive traits: score, what you can hear, what it means, confidence, scoring version.
- Sol drafts, an independent reviewer checks musical accuracy, and everything starts as "pending review". Admin approval comes first for the most-picked songs.
- Only approved explanations reach the Critic. They're frozen with each pick like song facts, so old readings never change, and they never count as listener evidence.
- Admin view: coverage by lane/decade, a review queue, and an approve/edit/reject flow.

## Order
1. Step 1 now.
2. Step 2 data model + admin review page; you approve the 10 profiles; then switch matching over.
3. Step 3 explanations, starting with the 100 most-picked songs; then let the Critic and chat use approved ones.

## Technical notes
- New tables `archetype_profiles` (archetype_id, version, core/supporting signed weights over the current traits, distinguishers, thematic_note, status) and `song_trait_explanations` (song_id, axis, score_at_write, audible_evidence, interpretation, confidence, status, scoring_version, reviewer). Admin-only writes; approved rows readable.
- `assignArchetype` gets a v2 scorer over signed weights using ledger support; it runs behind a default-off flag until profiles are approved.
- Explanations attach to `choices.evidence` at vote time (approved only), following the song-facts pattern.
