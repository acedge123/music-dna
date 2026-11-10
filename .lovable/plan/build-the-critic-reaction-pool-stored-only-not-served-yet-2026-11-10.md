# Build the Critic reaction pool (stored only, not served yet)

## Goal
Start building a library of witty, reviewer-approved Critic reactions for each matchup and song pick. Listeners won't see anything from it yet. Every reaction they see still comes from live Sol, exactly as now.

## What goes in the pool
Only reactions that stand on their own: about this matchup and this pick, with no reference to earlier picks, the earlier read, or anything else about the listener.

Where reactions come from:
1. **Unused drafts from the speed-up.** When a listener makes their first pick, the reaction for the song they didn't choose has already been written and approved. It gets saved to the pool. Drafts from picks 2 and later aren't saved, because they're written with the listener's earlier choices in view and may refer back to them.
2. **Optional fill-up script.** An operator-run script writes stand-alone reactions for matchups that don't have enough yet. It uses the same Sol writer and Terra reviewer and adds 3–5 variations per song pick. It runs only when you choose to run it, so it costs nothing unless used.

Nothing from chat, the final reveal, or listener feedback ever goes in.

## What each saved reaction records
- Matchup and winning song
- Stage it's meant for (picks 1–4 only for now)
- Critic writer and reviewer versions
- Approval status: approved, retired, or rejected
- An exact fingerprint of the evidence it was written from (song scores, tested traits, matchup line)
- Where it came from (unused draft or fill-up script) and when

## Safeguards built in now
- **Stale reactions are retired automatically.** If the songs, tested traits or matchup line change, the fingerprint no longer matches. If the Critic's rules change, the version no longer matches. Either way the reaction is retired. A check also lists and retires stale ones in bulk.
- **No listener details stored.** Saved reactions only ever hold the reaction text. They hold no listener ID, conversation, or personal conclusions.
- **"Already seen" list, ready for later.** A private list records which reaction each listener has seen. Nothing writes to it until we switch on serving. When we do, the rules will be: never show the same reaction to the same listener twice, rotate among approved versions, and use live Sol when earlier choices matter.
- **Server only.** Listeners can't read or change the pool.

## Admin view
A read-only Pool tab under Ontology shows:
- approved variations per matchup and song
- which matchups have no coverage
- how many reactions are stale or retired

## Not in this step
- Serving pooled reactions to anyone (web or Flutter)
- Any change to picks 5–6, the final reveal or chat (they stay live Sol)

## Technical notes
- New tables `critic_reaction_pool` and `critic_reaction_exposures`, both service-role only. No listener access policies. Exposures are keyed by user and pool entry, ready for the later serving step.
- Pool fingerprint: the single-choice ledger plus the writer and reviewer versions, with no earlier read. Saved only when the reviewer accepted the draft and it was a first pick (`answered === 1`).
- `prepareReadsImpl` saves the losing branch once the real vote is known. `currentReadImpl` does this best-effort after matching. A failed save never affects the listener.
- Fill-up script: `tools/musicdna/fill-reaction-pool.ts`, with dry-run by default and a cost cap.
- Tests: no pool entries from picks after the first, a fingerprint change retires the entry, and an unapproved draft is never saved.
