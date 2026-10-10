# Roadmap — Product Requirements v1.0 parity

- [x] Copy: six matchups on landing and share page
- [x] D01 claim policy in final reasoning (engine/claims.ts); examples match claim direction
- [x] Honest insufficiency (no "broad taste" fallback)
- [x] D02 three consecutive skips stop
- [x] Re-point round 8/10/12/14 metrics → 2/4/6
- [x] Single versioned evidence ledger (engine/evidence.ts) for running read + final reasoning (chat reads its claims)
- [x] Public share card reads ledger claims instead of its own choice list
- [x] Reaction buttons use the matchup-based question
- [x] Revisions record prior claim + the pick that changed it (read_shown events)
- [x] Next prompt derived from the selected pairing (engine/prompts.ts)
- [x] Versioned experience contract, react endpoint, contract doc, fixtures
- [x] Mutation IDs + replay on choice/skip; full history on resume (REST v1)
- [x] catalog_exhausted completion reason; atomic choice+vector write (record_choice_atomic)
- [x] Web onboarding resume uses the full history
- [x] Persisted result versions; D04 chat self-report stored separately
- [ ] D03 explicit publish/revoke, token-only links, legacy inventory
- [ ] Fixed-sequence challenge from shared pairing set
- [ ] ACE web acceptance → Flutter parity
