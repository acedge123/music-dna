# Adopt review refinements + execute Step 0

Two parts: first, record the nine review findings **inside** `docs/musicdna/agent-brain-integration-plan.md` as an explicit "Refinements adopted" section so downstream readers (and Agent Brain) see what the plan weakened-and-fixed. Second, ship Step 0 — the read-only shadow mode over `event_log`. No selector behavior changes.

---

## Part A — Doc edit: "Refinements adopted from review"

Insert a new section right after the Summary, titled **"Refinements adopted from review (2026-07-25)"**. Each item names the weakness in the prior draft and the concrete fix now reflected downstream in the doc.

1. **Constants before weights.** Prior draft de-weighted `mode_pressure` in isolation, which silently removed `compound`. Fix: correct `information_cost` and `reversibility` to `medium` first, *then* set `mode_pressure = +2`. Landed in D2.
2. **`mode_pressure = +2`, not `+1`.** `+1` ties compound with prune after the constants are fixed and hands every decision back to the baseline. Landed in D2 with the tuning table.
3. **Compound reachability is empirical, not asserted.** Prior draft asserted compound was unreachable in 6 rounds. Replaced with a `vector_after` SQL query over `event_log` and a three-branch action table. Landed in Part 1 / "Settling compound reachability empirically."
4. **`delta_vector` sourcing.** Prior draft proposed a `choices.delta_vector` migration up front. Fix: shadow reads `event_log.props.raw_delta` (already persisted); promotion to a column is deferred until Step 5, gated on the fire-and-forget emit being hardened. Landed in D4.
5. **Skip is a first-class signal.** Prior draft omitted skips; they advance `round` without moving the vector and must feed ruggedness/uncertainty rather than be treated as no-ops. Add to the mapper contract in Part 3.
6. **Regime does not gate `shouldStop` in V1.** Keeps average-rounds a clean rollout metric. Landed in D3.
7. **Artist bias and snap-decision rate are already computed.** `finalizeSession` derives both. The mapper must consume them, not re-derive — prevents drift between reveal and router. Note in Part 3.
8. **Probe cadence follows lane confidence, not round number.** Softens the "Compound disables probes" rule so a high-confidence early session isn't starved of probes and a low-confidence late one isn't flooded. Note in Part 3.
9. **Convergence metric: `archetype_margin`.** Gap between #1 and #2 archetype scores is the primary convergence readout in shadow analysis; raw confidence alone hides ties. Add to the telemetry rubric in Step 0.

Each item is a two-liner in the doc. No structural rewrite of existing sections — the current positions already reflect items 1–4 and 6; items 5, 7, 8, 9 also get one-line callouts inline where they belong (mapper contract, Part 3 principle, Step 0 metrics).

---

## Part B — Execute Step 0 (shadow telemetry, read-only)

Goal: emit a `regime_recommended` event on every `nextPairingImpl` call, computed from live session state, with **no effect on selection**. Everything reads from `event_log`; nothing writes to `sessions` or `choices`.

Files:

- `src/musicdna/router/terrain.ts` *(new)* — pure mapper: `(session, recentChoices) → TerrainFeatures`. Consumes `vector_after`, `raw_delta`, `ms_to_decide`, `skipped_pairing_ids`, artist frequency, lane confidence. No I/O.
- `src/musicdna/router/scoring.ts` *(new)* — port of Agent Brain `scoreTerrain` with the corrected constants (`information_cost: medium`, `reversibility: medium`) and `mode_pressure` weight `+2`. Exports `recommendRegime(features) → { regime, confidence, margin, scores }`.
- `src/musicdna/router/index.ts` *(new)* — `recommendForSession(sessionId, supabase)`; loads the last N `choice_scored` rows from `event_log`, calls terrain + scoring, returns the recommendation.
- `src/musicdna/router/*.test.ts` — unit tests: constant-baseline table, mapper handles skips/missing deltas as unknown (not zero), predicted regime distribution snapshot.
- `src/lib/musicdna.functions.ts` — inside `nextPairingImpl`, after the pairing is selected, call the router and emit `regime_recommended` with `{ regime, confidence, margin, scores, features, selected_mode, pairing_id }`. Wrapped in try/catch, fire-and-forget. **Selector unchanged.**
- `docs/musicdna/instrumentation.md` — document the new event.

Explicitly out of scope for Step 0: `PairingKnobs` refactor, `sessions.routing_mode`, any change to `selectPairing`, any migration.

### Verification

- `bunx vitest run src/musicdna/router` — mapper + scoring tests green.
- `bun run build` — clean.
- Manual: run one session end-to-end locally, confirm `regime_recommended` rows appear in `event_log` with sane distributions and the selector's `pairing_shown` events are unchanged.
- Run the compound-reachability query from Part 1 against staging `event_log` and paste the peak-confident-axes distribution into a short note appended to the doc under D1.

---

## Technical details

- Terrain fields hard-coded to constants in v1 (documented in D2): `feedback_latency=fast`, `reversibility=medium`, `adversariality=none`, `information_cost=medium`, `coordination_load=low`, `environment_stability=stable`, `time_horizon=iterative`. Derived: `uncertainty` (from lane_confidence + evidence coverage), `ruggedness` (from recent |raw_delta| variance + skip rate), `local_minima_risk` (from artist bias share), `branching_factor` (from round position), `mode_pressure` (from bias/skip/uncertainty).
- Missing `raw_delta` on a choice → treat as `unknown`, not `0`. Explicit `null` propagates into ruggedness as "insufficient data" rather than "smooth."
- Skip weight in ruggedness/uncertainty: each skip in the last 3 rounds contributes as one high-uncertainty observation.
- No `PairingKnobs` yet — Step 0 only recommends; Step 1 (separate turn) introduces the type with defaults that reproduce today's behavior byte-for-byte, gated on the golden fixture test.
