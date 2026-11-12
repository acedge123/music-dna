# Final reading payoff: identity, dimensions, receipts, invitation

## Goal
Six picks should end in a revelation, not a recap. Keep Sol's voice, but wrap it in a clear Music DNA payoff and a reason to keep going.

## What the listener sees (in order)
1. **The reveal** — label "Your Music DNA", then either:
   - **Confirmed archetype** (e.g. "The Atmospherist") only when the match clears today's confidence bar, or
   - **Emerging signature** — a short Sol-written name (e.g. "Polish With Teeth") plus a one-line hook, clearly marked as early.
   Sol's opening line and full prose follow underneath, unchanged in spirit.
2. **Your dimensions** — the three strongest leanings as simple bars: plain-English pole ("Refinement over rawness"), count ("3 of 4 choices") and a confidence word (Clear / Leaning / Early). Split traits are listed briefly as "Still undecided".
3. **The receipts** — 3 picks max: two that built the pattern, one contradiction ("the pick that gives you character"), each one sentence, tied to actual songs.
4. **The invitation** — honest about what's missing ("We've only heard you through hip-hop"), then user-chosen options:
   - Explore a decade (existing decade picker; no auto-routing)
   - Play six more matchups to sharpen your signature
   - Push back / chat with the Critic (existing)
   Undecided traits are named as the hook ("Danger or release? Still a coin flip.").

## Rules kept
- Dimensions, counts, confidence, receipts and archetype status come from the deterministic evidence ledger only; Sol never invents numbers.
- Still one Sol write + one Terra review. Sol adds two fields: signature name and hook. Terra checks they're supported by the ledger without flattening tone.
- Confirmed archetype only above existing thresholds; otherwise "emerging". Old saved readings stay as they were (they show the new data panels, since those are computed from frozen evidence, but no new prose).
- Matchups stay mysterious before picks; this only appears after the reading.

## "Six more" run
A new "refine" run linked to the finished reading: six more picks in the same lanes, preferring traits still undecided or early, then an updated reading saved as a new version comparing before/after. Discover routing for first runs is untouched. (Decade runs already exist and are reused.)

## Order of work
1. Data panels + receipts + invitation on web (no AI change) — fastest visible win.
2. Sol signature name/hook fields with Terra check; emerging vs confirmed label.
3. "Six more" refine run.
4. Same payload exposed to Flutter via the v1 reading/reveal response; documented in the contract.
5. Replay her six-pick reading as the acceptance case; tests for confidence wording, archetype gating, and "never invent counts".

## Technical notes
- Ledger summary from `buildLedger`/`evaluateClaim`; archetype gating via `assignArchetype` flags (score floor 0.5, margin 0.05).
- Synthesis schema adds `signature_name`, `signature_hook`; saved in the same result version; missing on old versions = render without.
- Refine run modeled like decade explore (`mode=refine`, `parent_session_id`), selector bias toward low-evidence axes, behind its own default-off flag until tested.
- v1 reveal gains `dna_summary { dimensions[], undecided[], receipts[], archetype { status, name } , signature }` under the experience header only.
