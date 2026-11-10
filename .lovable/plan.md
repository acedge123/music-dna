# Critic speed experiment: Current vs Faster (offline, no live changes)

Yes — this can run as a controlled side-by-side test without touching what listeners see. The live critic, its model, voice, review step and final reading stay exactly as they are. The experiment runs as a separate offline tool against frozen interviews; nothing it produces is saved to readings, shared, or sent to learning.

## What gets compared

| | Current critic | Faster critic |
|---|---|---|
| Model | Unchanged | Same model |
| Thinking effort | Current | Reduced for post-pick reactions only |
| Evidence sent | Complete | Compact: this pick's test, chosen/opposing song, saying, top supported claims, last 2 replies |
| Independent review | Required | Required (same reviewer, same rules) |
| Voice / editorial rules | Current | Same, plus one creative objective for post-pick: "Make one interesting observation about this specific choice the listener wouldn't have thought of themselves." No word cap. |
| Final reading | Current | Unchanged (identical) |
| Chat | Current | Effort scaled by question difficulty (simple follow-up = low, challenge/contradiction = current) |

## Scenarios
20 frozen interviews drawn from existing saved sessions (owner-QA first, then anonymized listener sessions), covering several lanes, 4- and 6-pick endings, and at least one chat challenge each. Both configurations get identical inputs per stage: each post-pick reaction, the reveal, and two chat turns.

## What gets measured (per configuration)
- First-pass acceptance rate (reviewer approves the first draft)
- Unsupported or incorrect claims (reviewer + evidence check)
- Repeated phrasing (overlap against prior replies and across scenarios)
- Wit/originality and entertainment (blind side-by-side scoring in admin, labels hidden; uses the existing five-score rubric)
- Median and 95th-percentile response time, split into writer, reviewer and retry time

## Decision rule
Adopt Faster only if it is meaningfully quicker (target: post-pick 3–5s, chat 5–8s) AND first-pass acceptance, unsupported-claim rate and originality are no worse. Otherwise keep Current. The switch, if approved, is a later separate step you sign off on.

## Safety
- No change to live routing, prompts, models, flags, learning/export, saved or shared readings.
- Experiment output is stored only as admin-only measurement records, marked experimental.
- Costs: roughly 20 scenarios x ~10 calls x 2 configs (~400 writer+reviewer calls) on the existing key; I'll report the actual spend.

## Technical details
- New offline runner `tools/musicdna/critic-speed-experiment.ts` that loads frozen evidence via `loadChoiceEvidence`/`buildLedger` and calls the existing writer/reviewer path through `llm-gateway.ts` with a per-run config override (effort, compact context builder, creative objective line). Production defaults untouched.
- Compact context builder lives beside the existing narrator as an opt-in function; not wired into live paths.
- Results written to existing `critic_quality_attempts` with an `experiment` tag, excluded from listener metrics; admin gets a blind A/B scoring view and a summary table (acceptance, claims, repetition, p50/p95 latency breakdown).
- Tests: config override cannot leak into live calls; final reading config identical in both arms.
