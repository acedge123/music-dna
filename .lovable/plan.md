# Halftime pushback (proposal)

## Short answer
- Yes, we can offer pushback at halftime without breaking the six-pick test, as long as pushback is saved as the listener's own words and is never counted as a pick.
- Today, pushback does not change which matchups come next. Matchups are picked only from votes (the "challenge the emerging hypothesis" nudge uses vote scores, not what the listener says). After the reading, pushback is stored separately from the evidence. It shapes what the Critic says back and appears as a refinement, but it never rewrites the original reading or its scores.

## What we'd build
1. At halftime (after pick 3), add an optional "That's not me" / "Tell me more" reply under the halftime summary. It's skippable, and a "Keep going" button stays the main action.
2. The Critic answers in one or two lines. It acknowledges the pushback and makes it a question for the next picks to settle ("Fine — let's see if the next three agree with you").
3. Pushback is saved as a self-report with its pick number. It never becomes a vote and never moves scores.
4. Matchup selection stays as it is (default). Optionally, later and as an off-by-default experiment: let a disputed trait get one extra matchup so the picks can settle the argument.
5. At the final reading, the Critic can say whether the last three picks backed the listener up or backed the Critic up. Only the pick ledger can support a claim; the pushback is quoted as the listener's view.

## Risks
- Halftime reply adds a few seconds per Critic call; keep it short and skippable.
- Listeners could feel argued with mid-test; tone should stay playful.
- Flutter needs the same optional halftime field (shared API, opt-in).

## Technical notes
- Reuse the existing self-report event (`self_report`, written by the server) with `at_pick: 3`. No changes to `record_choice_atomic`, the ledger or the selector.
- The final synthesis prompt already separates self-report from votes (`self_report_separate`).
