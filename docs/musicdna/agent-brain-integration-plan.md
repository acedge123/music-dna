# MusicDNA × Agent Brain Integration Plan

**Status:** design, not started. Four decisions are open; one is a hard blocker.
**Verified against:** `acedge123/music-dna@ef3d6b6` and `The-Gig-Agency/agent-brain` (`src/cognitive-router/`).
**Scope:** wire Agent Brain's regime selection into MusicDNA's pairing selection, without changing the evidence layer or the critic voice.

This document supersedes all earlier drafts. Earlier versions were written against `acedge123/idea-builder`, which is a materially different codebase; where those drafts disagree with this one, this one is correct. Appendix B lists what changed and why.

---

## Summary

The integration is smaller than it first appeared, and one product fact constrains the whole thing: **the shipped web session is 6 rounds**, not the 12–18 earlier drafts assumed. Six rounds is a tight budget for the `compound` regime's confidence bar, so V1 should be planned as an explore/prune integration unless a query over historical `vector_after` data proves compound is actually reached.

The useful version of this work is:

1. Regime drives the **scoring knobs inside `selectPairing`** — not the `SelectionMode`, which is effectively constant per session.
2. Regime shapes **selection only**. It never touches evidence gating, `shouldStop`, or the critic.
3. Telemetry ships first, through `event_log`, which already has the columns needed.

Everything else is sequencing and guardrails.

---

## Shipped so far

- **Step 0 (2026-07-25).** Shadow router live under `src/musicdna/router/*`. `nextPairingImpl` emits fire-and-forget `regime_recommended` events on every successful pick (bootstrap and normal). Selector untouched. 11 mapper/scorer unit tests green.
- **Step 1 (2026-07-25).** Admin → Shadow Router tab (`adminShadowRouter` server fn + `ShadowRouterPanel`) surfaces the Step 1 baselines against real `regime_recommended` / `choice_scored` / `pairing_skipped` / `sessions.vector` rows: regime mix, avg confidence, per-round drift, feature distribution, empirical compound-reachability (D1 rubric — bucketed peak count of confident axes), axis coverage, and empty-reveal rate. Read-only; window selector 7/14/30/90 days. Waiting on session volume to populate D1.
- **Steps 2 + 3 + 3.5 (2026-07-25).** Mapper reachability pinned via `reachability.test.ts`; `PairingKnobs` struct + `regimeToKnobs` mapping introduced; `fork_filter` promoted to a first-class knob (`hard`/`soft`/`off`) so `explore` can prefer leaning axes without excluding the rest of the pool; `vector_confidence` corrected to count axes with `|v| >= 30`; round budget reconciled to 6. Byte-identical `selection_reason` verified via golden snapshots across all three selection modes.
- **Step 4 (2026-07-25).** Shadow control live. `nextPairingImpl` now consults `recommendForSession` once per pick, translates the regime to knobs via `regimeToKnobs`, runs a parallel `selectPairing` on the same pool, and logs `shadow_pick` = `{ pick_id, agrees, knobs, selection_reason }` on the `regime_recommended` event. User-facing selection unchanged unless `MUSICDNA_ROUTING_MODE=live` (default is `shadow`; `legacy` disables the extra call entirely). Selection safeguards — same-artist exclusion, recognition floor with fallback, lane invariant — remain untouched. Waiting on session volume before promoting `live` behind a canary.

## Refinements adopted from review (2026-07-25)

Nine weaknesses were identified in the prior draft during review. Each is now reflected in the plan; this section records them explicitly so downstream readers (and Agent Brain) can see what changed and why.

1. **Constants before weights.** Prior draft de-weighted `mode_pressure` in isolation, which silently removed `compound` as a reachable regime. Fix: correct `information_cost` and `reversibility` from `low`/`high` to `medium` first, *then* set `mode_pressure = +2`. See D2.
2. **`mode_pressure = +2`, not `+1`.** `+1` ties compound with prune after the constants are fixed and hands every decision back to the constant baseline. `+2` keeps compound winnable with a 1-point margin while halving `mode_pressure`'s dominance. See D2 tuning table.
3. **Compound reachability is empirical, not asserted.** Prior draft asserted compound was unreachable in 6 rounds by arithmetic. Replaced with a SQL query over `event_log.props.vector_after` and a three-branch action table; the pairing corpus decides. See Part 1 / "Settling compound reachability empirically."
4. **`delta_vector` sourcing.** Prior draft proposed a `choices.delta_vector` column migration up front. Fix: `event_log.props.raw_delta` is already persisted on every `choice_scored` event; shadow reads from there. Column promotion is deferred to Step 5, gated on hardening the fire-and-forget emit so a dropped event doesn't flatten `recentDeltas` into false "not volatile." See D4.
5. **Skip is a first-class routing signal.** Prior draft omitted skips. `skipPairingImpl` advances `round` without moving the vector — treating that as "no signal" biases ruggedness low. Fix: the mapper counts skips in the last 3 rounds as high-uncertainty observations feeding `ruggedness` and `uncertainty`. See Part 3.
6. **Regime does not gate `shouldStop` in V1.** Keeps average-rounds a clean rollout metric — regime cannot be changing the very thing being measured. See D3.
7. **Reuse `finalizeSession`'s derived signals.** Artist bias (`n >= 3` per artist) and snap-decision rate (`ms_to_decide < 2000` at ≥60%) are already computed in `finalizeSession`. The mapper consumes those definitions rather than re-deriving them, preventing drift between reveal and router. See Part 3.
8. **Probe cadence follows lane confidence, not round number.** Softens the "Compound disables probes" rule so a high-confidence early session isn't starved of probes and a low-confidence late one isn't flooded. Round-indexed rules were tautological given the 6-round budget. See Part 3.
9. **Convergence metric: `archetype_margin`.** Gap between the #1 and #2 archetype scores is the primary shadow-analysis convergence readout; raw confidence alone hides ties where two archetypes co-lead. See Step 0 telemetry rubric.

---

## Part 1 — What is actually true today

Facts verified in the current codebase. Several contradict earlier drafts.

### Pairing selection

`selectPairing` (`src/musicdna/engine/pairing.ts`) is a filter-then-weighted-sample pipeline. In order: drop used and same-artist pairings, apply a recognition floor, hard-filter to the "fork pool" of pairings testing the axes the vector already leans on, then score and sample.

Its behavior is governed by seven hard-coded literals:

| Knob | Current value | Where |
|---|---|---|
| Recognition blend | `0.6` / `0.4` / `0` | `recogBlend`, derived from `mode` |
| Canon floor | `0` / `45` / `55` | `RECOGNITION_FLOORS` (0–100 scale) |
| Challenge boost | `1.5` | `challengeBoost` |
| Leaning-axis threshold | `15` | `leaningAxes` filter |
| Leaning-axis count | top `3` | `.slice(0, 3)` |
| Axis-need blend | `0.4 + 0.6 * axisNeed` | weight formula |
| Fork filter | always on when any axis > 15 | `forkPool` |

It returns a `selection_reason` object with the full scoring rationale, already documented in `docs/musicdna/instrumentation.md` and already carried in `pairing_shown.props`.

### Selection mode

`SelectionMode` is chosen in `nextPairingImpl` (~line 579) from lane, not round:

```typescript
const mode: SelectionMode =
  sessionLane === "general"
    ? "recognition_first"
    : laneConfidence < 0.6
      ? "recognition_boost"
      : "diagnostic_first";
```

**Mode is constant after bootstrap, and constant for the whole of a normal lane session.** It changes at most once, and only for sessions that open as `general`.

The one mechanism that moves it is bootstrap lane promotion in `recordChoiceImpl`. After two `is_bootstrap` choices whose winners agree on a lane, the session is promoted:

```typescript
if (aLane && bLane && aLane === bLane && aLane !== "general") {
  nextLane = aLane as Lane;
  nextLaneConfidence = 0.65;   // written to sessions.lane_confidence
}
```

Cross-lane probes, the other mechanism that used to move it, are quarantined.

Two consequences worth noting:

- Promotion sets confidence to `0.65`, which is just above the `0.6` mode threshold. A promoted session therefore jumps straight from `recognition_first` to `diagnostic_first`, **skipping `recognition_boost` entirely.** Whether that is intended is a product question this integration surfaces but does not answer.
- For a session that opens in a real lane, mode never changes at all.

Either way the conclusion stands: one possible transition per session, at a fixed point, is far too coarse to carry adaptive per-round routing.

### Cross-lane probes are off

`src/musicdna/engine/experiments/cross-lane-probes.ts` is quarantined with documented reactivation criteria. `PROBE_ROUNDS = {4, 9, 14}` is `void`ed, and `nextPairingImpl` throws if `probe_state.pending` is non-empty. Consequences: `probe_state.probes_shown` and `probe_state.flips` are always empty, and there is no probe schedule to tune.

### Skip is a live signal

`skipPairingImpl` handles "I don't know either of these." It adds the pairing to `probe_state.skipped_pairing_ids`, sets `wants_wider_probe`, and emits `pairing_skipped`. Skipped pairings are folded into `usedIds`, so **a skip advances `round` without moving the vector**.

### Round budget — three conflicting numbers

| Location | Limit | Reality |
|---|---|---|
| `src/routes/onboarding.tsx:35` | `MAX_ROUNDS = 6` | **This is the shipped web experience** |
| `pairing.ts` `shouldStop` | `min_rounds = 12` | Unreachable from web; the UI finalizes first |
| `src/routes/api/v1/e2e.test.ts:33` | `MAX_ROUNDS = 12` | Test harness disagrees with the product |

Six is deliberate. From `finalizeSession`:

> `// Tuned for 6-round adaptive test: 2 supporting choices on an axis is enough to call a tendency ... 0.55 keeps out pure noise without demanding 12 rounds.`

Knock-on effects, all verified:

- **`compound` is likely rare, and its reachability must be measured, not assumed.** It requires `confidence > 0.7` — 7 of 10 axes at `|value| >= 30`. Six rounds is a tight budget for that, but it is *not* impossible: `seedVectorFromPriors` starts axes at up to `0.35 × 100 = 35` before any choice, which already clears the threshold, and `applyChoice` moves every axis in a pairing's `tests` array at once, by up to `100 × diagnostic_weight`. `prior-weighting.md` notes pairing deltas "accumulate ~90–200 on the dominant axis." So a well-seeded session testing 2–3 axes per round can plausibly get there. See below for how to settle this empirically.
- **`STABILITY_CHECKPOINTS = {8, 10, 12, 14}` never fire**, so the `archetype_ranking_snapshot` event described in `instrumentation.md` is never written for web sessions.
- Any escape valve at round 15 with a cap at 18 is dead code — 2.5–3× the whole session.

### Settling compound reachability empirically

This does not need a simulation. `choice_scored.props.vector_after` already records the exact vector after every choice in every real session, so the answer is a query over historical data:

```sql
-- What share of real sessions ever reach compound's confidence bar?
WITH per_choice AS (
  SELECT
    session_id,
    (props->>'round')::int AS round,
    (SELECT COUNT(*) FROM jsonb_each_text(props->'vector_after') AS kv(k, v)
      WHERE ABS(v::numeric) >= 30) AS confident_axes
  FROM event_log
  WHERE event_type = 'choice_scored'
)
SELECT
  MAX(confident_axes)                                    AS peak_confident_axes,
  COUNT(*) FILTER (WHERE confident_axes >= 7) > 0        AS reached_compound
FROM per_choice
GROUP BY session_id;
```

Run this before Step 2 and report the distribution of `peak_confident_axes`. Three possible answers, each with a different consequence:

| Result | Meaning | Action |
|---|---|---|
| A meaningful share reach 7+ | Compound is reachable | Keep it in V1; calibrate against the observed distribution |
| Peak clusters at 4–6 | Compound is *empirically* unreachable at the current bar | Either lower the bar to match reality, or ship V1 as explore/prune |
| Peak clusters at 0–3 | The vector barely moves in 6 rounds | A larger finding than this integration — escalate |

Until this is run, the plan should say **"compound is empirically unverified"** rather than asserting it is impossible. The pairing corpus determines the answer, not arithmetic.

### Evidence gating

`finalizeSession` gates every user-visible claim:

```typescript
const MIN_SUPPORT = 2;       // supporting choices on an axis
const MIN_CONFIDENCE = 0.55;
```

When nothing clears the bar, the reveal falls back to *"Nothing cleared the evidence threshold this round."* With 6 rounds the ledger has very little slack — roughly three axes clear it in a good session.

`finalizeSession` also already derives two signals this integration would otherwise duplicate: artist bias (`n >= 3` winning songs by one artist) and snap-decision rate (`ms_to_decide < 2000`, flagged at ≥60% of choices).

> The "≥3 supporting, 0 contradicting" rule is a **different surface** — it governs `ShippedClaim` in the decade/subculture flow, not the main reveal.

### Agent Brain's scoring

`scoreTerrain` (`src/cognitive-router/scoring.ts`) sums a weight table over 12 terrain fields. Two properties matter here.

**`mode_pressure` is the heaviest single weight (+4).** A mapper that computes `mode_pressure` itself is therefore largely deciding the outcome before scoring runs.

**Nine of the twelve fields would be hard-coded constants for MusicDNA**, and those constants alone produce a fixed baseline before any session data is read:

| Constant field | explore | prune | compound | coordinate |
|---|---|---|---|---|
| `feedback_latency: fast` | +2 | +1 | | |
| `reversibility: high` | +2 | +1 | | |
| `adversariality: none` | | +1 | +1 | |
| `information_cost: low` | +2 | +1 | | |
| `coordination_load: low` | | +1 | +1 | |
| `environment_stability: stable` | | +1 | +2 | |
| `time_horizon: iterative` | +2 | | +1 | |
| **Baseline** | **+8** | **+5** | **+5** | **0** |

Explore starts +3 ahead. In practice `explore` can reach a margin of 13 (confidence clamps to 1.0) while `prune` and `compound` top out near margin 2 (confidence ≈ 0.56), so any confidence-gated logic is biased toward explore.

**Three of four transition rules cannot fire** with this terrain:

| Rule | Blocked by |
|---|---|
| `explore → prune` | needs `branching_factor: "high"`, which only holds for `round < 5` |
| `prune → compound` | works |
| `compound → explore` | needs `local_minima_risk: "high"`, but compound is only selected when artist bias is *absent* — mutually exclusive |
| `→ coordinate` | needs adversariality or coordination load, both constant at `none`/`low` |

The unreachable `compound → explore` rule is the safety valve for a user locked into compounding.

---

## Part 2 — Decisions to settle before writing code

> **Current positions (2026-07-25).** D1: keep the 6-round experience; treat V1 as explore/prune unless the reachability query proves compound viable. D2: correct the two constants, then reduce `mode_pressure` from `+4` to `+2` — not to `+1`. D3: regime does not touch `shouldStop` in V1. D4: `event_log.raw_delta` for telemetry; control-grade before live routing. These are agreed pending the Step 0 data.

### D1. The round budget (blocker)

Reconcile `onboarding.tsx` (6), `shouldStop` (12), and `e2e.test.ts` (12) to a single number, then re-scale every regime threshold to it.

If the answer is 6, say plainly that this is an **explore-vs-prune integration** and drop the three-regime lifecycle framing. If the intent is a longer session, that is a product change that must land before the mapper, not after.

Prefer expressing thresholds as fractions of the session budget so they survive a future change.

### D2. Is Agent Brain deciding, or confirming?

Given the `mode_pressure` weight and the constant-field baseline, `scoreTerrain` will largely echo whatever the mapper puts in `mode_pressure`. Two candidate fixes:

- **(a)** de-weight `mode_pressure` so it acts as a tiebreaker rather than the decision, and let `uncertainty` / `ruggedness` / `local_minima_risk` carry the result
- **(b)** stop hard-coding the nine constants and derive at least `information_cost`, `reversibility`, and `environment_stability` from real session data

**These are coupled. Doing (a) alone silently removes `compound` entirely.**

Scored against the "high-confidence settled session" — the exact case where compound *should* win:

| `mode_pressure` weight | Current constants | With `reversibility: medium`, `information_cost: medium` |
|---|---|---|
| `+4` (today) | compound 12 — **wins** | compound 13 — **wins** |
| `+3` | compound 11 — **wins** | compound 12 — **wins** |
| `+2` | compound 10, prune 10 — **prune wins on tie** | compound 11 — **wins** |
| `+1` (tiebreaker) | compound 9, prune 10 — **prune wins** | compound 10, prune 10 — **prune wins on tie** |

The `+8 / +5 / +5` constant baseline is what does this: strip `mode_pressure` down and the structural lead decides every case before session data is considered. **Fix the constants first, then de-weight.**

**Landing point: correct the two constants, then set `mode_pressure` to `+2`.** That keeps compound winnable with a 1-point margin while cutting `mode_pressure`'s dominance in half. Going to `+1` is too far — it ties with prune even after the constants are fixed, so the mapper would lose its say entirely.

Two of the constants are also just wrong for this product, independent of the tuning argument:

- `information_cost: "low"` — a pairing consumes one of only six rounds. That is not cheap. `"medium"` is defensible.
- `reversibility: "high"` — within a fixed 6-round budget you cannot un-ask a pairing. `"medium"` is defensible.

Correcting those two moves the baseline from `explore 8 / prune 5 / compound 5` to `explore 5 / prune 6 / compound 6`, which is both more honest and leaves room for `mode_pressure` to be de-weighted safely.

Whichever path is taken, record the **predicted regime distribution** before shipping so shadow data can be checked against it.

### D3. May regime influence `shouldStop`?

Currently unspecified. If yes, "average rounds" stops being a clean rollout metric, because regime would be changing the very thing being measured. Recommend **no** for the first pass.

### D4. How to obtain `delta_vector`

**It is already persisted.** `emitChoiceDiagnostics` writes it to `event_log.props.raw_delta` on every `choice_scored` event, alongside `vector_before` and `vector_after` — documented in `instrumentation.md`. No migration is needed for shadow mode; read it back from `event_log`.

One caveat before it becomes a live control input: the emit is deliberately fire-and-forget, wrapped in a `try/catch` that only warns.

```typescript
// recordChoiceImpl — diagnostics are "an observability channel, not a product invariant"
try {
  await emitChoiceDiagnostics(...);
} catch (e) {
  console.warn("[musicdna] emitChoiceDiagnostics failed:", ...);
}
```

That is correct for telemetry and wrong for a control loop: a dropped event would silently flatten `recentDeltas`, which reads as "not volatile," which pushes the regime toward compound. **For shadow, use `event_log`. Before Step 5, either promote the delta to a `choices.delta_vector` column or make the mapper explicitly handle missing deltas as unknown rather than as zero.**

---

## Part 3 — The design

### Principle

> **Regime is a weight source for the existing selector. It shapes selection only — never evidence gating, never `shouldStop`, never the critic voice.**

This mirrors the framing already used in `instrumentation.md`: the engine's math is untouched.

### Regime → knobs

Regime drives the seven literals from Part 1, with defaults that are exactly today's values:

```typescript
export type PairingKnobs = {
  mode: SelectionMode;              // existing lever, preserved
  recog_blend: number;              // 0..1
  canon_floor: number;              // 0..100 — same scale as RECOGNITION_FLOORS
  challenge_boost: number;          // default 1.5
  leaning_axis_threshold: number;   // default 15
  leaning_axis_count: number;       // default 3
  axis_need_floor: number;          // default 0.4
  axis_need_span: number;           // default 0.6
  fork_filter: "hard" | "soft" | "off";
};

// Defaults MUST be derived from the mode. A single constant cannot preserve
// today's behavior, because recog_blend and canon_floor are functions of mode
// in the shipped code — pinning them to 0/0 would silently turn every
// recognition_first and recognition_boost session into diagnostic_first.
export function legacyKnobsForMode(mode: SelectionMode): PairingKnobs {
  return {
    mode,
    // mirrors `recogBlend` in selectPairing
    recog_blend:
      mode === "recognition_first" ? 0.6 :
      mode === "recognition_boost" ? 0.4 : 0,
    // mirrors RECOGNITION_FLOORS — 0..100 scale
    canon_floor: RECOGNITION_FLOORS[mode],   // 0 / 45 / 55
    // mode-independent literals
    challenge_boost: 1.5,
    leaning_axis_threshold: 15,
    leaning_axis_count: 3,
    axis_need_floor: 0.4,
    axis_need_span: 0.6,
    fork_filter: "hard",
  };
}
```

The call site keeps deriving `mode` exactly as it does today, then asks for that mode's legacy knobs:

```typescript
const mode = regimeToSelectionMode(regime, sessionLane, laneConfidence);
const knobs = input.knobs ?? legacyKnobsForMode(mode);
```

The golden test must cover **all three modes**, not just the default one. A single-object default would pass a `diagnostic_first` fixture and quietly break the other two.

`fork_filter: "soft"` — weighting the fork pool instead of hard-filtering to it — is the highest-value explore lever, because the current hard filter collapses the pool as soon as any axis exceeds 15.

There is deliberately **no `probe_weight`**. Cross-lane probes are quarantined; a knob controlling a switched-off mechanism is noise.

### Selection mode mapping

Mode stays lane-driven. Regime only gets a say once the lane is settled:

```typescript
function regimeToSelectionMode(
  regime: SearchRegime,
  sessionLane: Lane,
  laneConfidence: number,
): SelectionMode {
  // Preserved: general-lane users need songs they recognize
  if (sessionLane === "general") return "recognition_first";
  if (laneConfidence < 0.6) return "recognition_boost";
  return regime === "explore" ? "recognition_boost" : "diagnostic_first";
}
```

### Terrain mapper

Lives in Agent Brain at `src/cognitive-router/integrations/musicdna/`, so it stays co-versioned with the scoring engine and serves as the reference implementation for future integrations.

```typescript
const DIMS = [
  "movement", "atmosphere", "immersion", "scale", "community",
  "perspective", "confidence", "tension", "texture", "transformation",
] as const;

export type MusicDNASessionState = {
  session_id: string;
  round: number;                    // = usedIds.size (choices + skips)
  vector: Record<string, number>;
  lane: string;
  lane_confidence: number;
  skipped_pairing_ids: string[];
  artist_frequency: Record<string, number>;  // derived, not a column
};

export type MusicDNATerrainInput = {
  session: MusicDNASessionState;
  recentDeltas?: Array<Record<string, number>>;
  recentChoices?: Array<{ ms_to_decide: number | null }>;
  config?: MapperConfig;
};
```

Signals. Thresholds marked *(shared)* must reuse the definitions already in `finalizeSession` rather than redeclaring them.

```typescript
// Axis confidence — mirrors shouldStop's axis_confidence_threshold of 30
export function sessionConfidence(vector: Record<string, number>) {
  const confident = DIMS.filter((d) => Math.abs(vector[d] ?? 0) >= 30).length;
  return { confidence: confident / DIMS.length, confident_axes: confident };
}

// (shared) finalizeSession flags artist bias at n >= 3
export function detectArtistBias(freq: Record<string, number>, threshold = 3) {
  const [top] = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return top && top[1] >= threshold
    ? { biased: true, top_artist: top[0], count: top[1] }
    : { biased: false, top_artist: null, count: 0 };
}

// Ruggedness proxy — probes are quarantined, so use vector volatility
export function detectVectorVolatility(deltas: Array<Record<string, number>>, threshold = 15) {
  if (deltas.length < 3) return { volatile: false, avgMagnitude: 0 };
  const mags = deltas.map((d) => Object.values(d).reduce((s, v) => s + Math.abs(v), 0));
  const avgMagnitude = mags.reduce((a, b) => a + b, 0) / mags.length;
  return { volatile: avgMagnitude > threshold, avgMagnitude };
}

// (shared) finalizeSession treats < 2000ms as a snap decision
export function detectSnapPicks(choices: Array<{ ms_to_decide: number | null }>) {
  const valid = choices.filter((c) => c.ms_to_decide != null);
  if (!valid.length) return { snap_rate: 0, snapping: false };
  const snap = valid.filter((c) => c.ms_to_decide! < 2000).length;
  const snap_rate = snap / valid.length;
  return { snap_rate, snapping: snap_rate >= 0.6 };
}

// Recognition failure — the strongest signal the product has
export function detectSkipPressure(skipped: string[], round: number) {
  const skip_count = skipped.length;
  const skip_rate = round > 0 ? skip_count / round : 0;
  return { skip_count, skip_rate, recognition_failing: skip_count >= 2 || skip_rate > 0.25 };
}
```

Terrain construction. Note that skip pressure is what makes the `compound → explore` transition reachable, by driving `environment_stability`:

```typescript
export function sessionToTerrain(input: MusicDNATerrainInput): TerrainProfile {
  const { session, recentDeltas = [], recentChoices = [] } = input;
  const { confidence } = sessionConfidence(session.vector);
  const bias = detectArtistBias(session.artist_frequency);
  const volatility = detectVectorVolatility(recentDeltas);
  const skips = detectSkipPressure(session.skipped_pairing_ids, session.round);

  return {
    feedback_latency: "fast",
    adversariality: "none",
    coordination_load: "low",
    time_horizon: "iterative",

    // Per D2: "medium", not "high". Within a fixed 6-round budget you cannot
    // un-ask a pairing, and this also removes 2 points of explore's baseline.
    reversibility: "medium",

    uncertainty: confidence < 0.3 ? "high" : confidence < 0.7 ? "medium" : "low",
    branching_factor: session.round < 5 ? "high" : "medium",
    ruggedness: volatility.volatile ? "high" : "medium",
    local_minima_risk: bias.biased ? "high" : "medium",

    // Per D2: baseline "medium", not "low". A pairing consumes one of only six
    // rounds. Escalates to "high" when the user can't engage with what we serve.
    information_cost: skips.recognition_failing ? "high" : "medium",

    // Unblocks the compound → explore transition
    environment_stability: skips.recognition_failing ? "shifting" : "stable",

    mode_pressure: inferModePressure(input),
  };
}
```

`mode_pressure` is a terrain **input** (`explore | prune | compound | escape | coordinate | create`); `scoreTerrain` returns a `SearchRegime` **output** (`prune | explore | compound | coordinate`). They are different types and must not be conflated. `escape` is a first-class value and is the right way to express a stuck session — no bespoke branch needed.

```typescript
export function inferModePressure(input: MusicDNATerrainInput): ModePressure {
  const { session, recentDeltas = [], recentChoices = [] } = input;
  const { confidence } = sessionConfidence(session.vector);
  const bias = detectArtistBias(session.artist_frequency);
  const volatility = detectVectorVolatility(recentDeltas);
  const snap = detectSnapPicks(recentChoices);
  const skips = detectSkipPressure(session.skipped_pairing_ids, session.round);

  // Thresholds below are placeholders pending D1. They are written as
  // fractions of the session budget so they survive a change to it.
  const budget = input.config?.round_budget ?? 6;
  const escapeAt = Math.floor(budget * 0.7);

  if (session.round >= escapeAt && confidence < 0.3) return "escape";
  if (skips.recognition_failing) return "explore";
  if (bias.biased && bias.count >= 4) return "explore";
  if (volatility.volatile && confidence < 0.7) return "explore";
  if (snap.snapping && confidence < 0.3) return "explore";
  if (confidence < 0.3) return "explore";
  if (confidence > 0.7 && !bias.biased && !volatility.volatile) return "compound";
  return "prune";
}
```

> With `budget = 6`, the `compound` branch may rarely or never fire — see D1. If the reachability query shows sessions do cross the bar, keep it; if they cluster below, either lower the threshold to match observed behavior or ship V1 as explore/prune. Do not silently leave a branch that never executes.

### What does *not* change

`applyChoice`, `assignArchetype`, `shouldStop`, the `MIN_SUPPORT` / `MIN_CONFIDENCE` evidence gate, `assertWithinLane`, the bootstrap phase, and the critic prompt are all untouched. The bootstrap branch in `nextPairingImpl` returns before `selectPairing` is reached, so regime routing does not apply to bootstrap rounds.

Regime is **not** surfaced to the user. The critic voice already conveys the shift from early read to verdict; naming the regime would break that.

---

## Part 4 — Data plumbing

Three of the mapper's inputs do not currently exist at the call site.

| Input | Status | Work |
|---|---|---|
| `artist_frequency` | No column, no computation | Derive per round by joining `choices → songs` and tallying `chosen.artist` |
| `recentDeltas` | Already in `event_log.props.raw_delta` (D4) | Read from `event_log`; no migration for shadow |
| `ms_to_decide` | Column exists | `nextPairingImpl` currently selects only `pairing_id` — widen the query |
| Round counters | Conflated into one number | Separate — see below |

```typescript
// nextPairingImpl — current
supabase.from("choices").select("pairing_id").eq("session_id", id)

// nextPairingImpl — required
supabase.from("choices")
  .select("pairing_id, chosen_song_id, ms_to_decide, created_at")
  .eq("session_id", id)
  .order("created_at", { ascending: true })
```

### Separate shown, answered, and skipped

Today a single `round` conflates three different things:

```typescript
const usedIds = new Set(choices.map((c) => c.pairing_id));
for (const pid of probeState.skipped_pairing_ids ?? []) usedIds.add(pid);
const round = usedIds.size;   // = answered + skipped
```

Make all three explicit and pass them separately:

| Counter | Definition | Used for |
|---|---|---|
| `rounds_answered` | choices recorded — the only rounds that move the vector | Confidence, evidence, volatility |
| `rounds_skipped` | `skipped_pairing_ids.length` | Recognition-failure signal |
| `rounds_shown` | `answered + skipped` — today's `round` | Budget accounting, `usedIds` exclusion |

**Confidence must be measured against `rounds_answered`, never `rounds_shown`.** A skip advances the budget without producing evidence, so a skip-heavy session currently reads as "stuck at low confidence" when the truth is "we have barely asked them anything."

**This connects directly to the evidence guardrail in Part 7.** Skips consume the 6-round budget — `onboarding.tsx` finalizes on `nr > MAX_ROUNDS`, where `nr` is `rounds_shown`. A user who skips three of six pairings reaches the reveal with three vector-moving choices, and `MIN_SUPPORT = 2` means almost nothing clears the evidence threshold. **Skip-heavy sessions are the most likely to produce an empty reveal**, and they are also the sessions where the mapper would push hardest toward explore. Any regime change that increases skips therefore degrades reveals through two paths at once. Track `rounds_skipped` against `empty_reveal_rate` from the first day of telemetry.

---

## Part 5 — Telemetry

**Use `event_log`. Do not add tables.** This follows the precedent in `instrumentation.md` ("Everything lands in `public.event_log.props`. No new tables.") and it already has the columns needed: `experiment_key`, `variant`, `session_id`, `pairing_id`, `choice_id`, `response_time_ms`, `props`, `client`.

```typescript
await recordEvent({
  event_type: "pairing_shown",
  session_id,
  pairing_id,
  experiment_key: "agent_brain_routing",
  variant: routingMode,           // "legacy" | "shadow" | "agent-brain"
  props: {
    terrain,
    mode_pressure_in,             // ModePressure — mapper's input
    regime_out,                   // SearchRegime — scoreTerrain's output
    scoring_agrees: regime_out === mode_pressure_in,
    knobs,
    selection_reason,             // already carried on this event today
  },
});
```

Two notes:

- `EVENT_TYPES` in `musicdna.functions.ts` is a `z.enum` allow-list. Reusing `pairing_shown` avoids touching it. Any genuinely new event type must be added there or `recordEvent` throws.
- Persist the arm on the session (`sessions.routing_mode`) at creation. Do **not** recompute it per request from a hash, or sessions will flip arms mid-run when the rollout percentage changes.

`scoring_agrees` is the metric that answers D2. If it is true ~100% of the time, Agent Brain is confirming the mapper's decision rather than making one.

### Analytics queries

Earlier drafts used `sessions.archetype_confidence` and `sessions.rounds`. **Neither column exists.** The real columns are `archetype_score`, `archetype_margin`, `archetype_flagged`, `archetype_top3`; round count comes from `choices`.

```sql
SELECT
  s.routing_mode,
  COUNT(*)                                                 AS sessions,
  AVG(s.archetype_margin)                                  AS avg_margin,
  AVG(s.archetype_score)                                   AS avg_score,
  AVG(c.n)                                                 AS avg_rounds,
  AVG((s.completed_at IS NOT NULL)::int) * 100             AS completion_rate,
  AVG(EXTRACT(EPOCH FROM (s.completed_at - s.started_at))) AS avg_duration_seconds
FROM sessions s
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS n FROM choices WHERE session_id = s.id
) c ON TRUE
WHERE s.started_at > NOW() - INTERVAL '14 days'
GROUP BY s.routing_mode;
```

`archetype_score` is a cosine similarity, not a probability, so "+10% confidence" is not a well-defined target. **Use `archetype_margin`** (winner minus runner-up) as the primary quality metric — it is what actually indicates a decisive read — and track `archetype_flagged` rate as a guardrail.

### If a table is added anyway

Every table in this project follows the same pattern: `GRANT` → `ENABLE ROW LEVEL SECURITY` → explicit policies. New tables must match it or they will be unreadable by `authenticated` and will trip the Supabase security linter. `regime_events` would need its own `user_id`, since it has no other ownership path:

```sql
CREATE TABLE public.regime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  round INT NOT NULL,
  regime TEXT NOT NULL,
  previous_regime TEXT,
  trigger TEXT NOT NULL,
  terrain_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_regime_events_session ON public.regime_events(session_id);

GRANT SELECT, INSERT ON public.regime_events TO authenticated;
GRANT ALL ON public.regime_events TO service_role;
ALTER TABLE public.regime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own regime events" ON public.regime_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own regime events" ON public.regime_events
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );
```

### SSR

Read environment variables **inside the handler**, never at module scope, or SSR prerender breaks. Same rule as `LOVABLE_API_KEY`.

```typescript
// Wrong — undefined during prerender
const AGENT_BRAIN_URL = process.env.AGENT_BRAIN_URL;

// Right
export async function recommendRegime(session) {
  const url = process.env.AGENT_BRAIN_URL ?? "http://localhost:7399";
}
```

---

## Part 6 — Sequencing

| Step | Scope | Gate |
|---|---|---|
| **−1. Round budget** | Resolve D1. Reconcile the three constants; re-scale thresholds | Blocks everything |
| **0. Data plumbing** | Widen the `choices` select; artist frequency; `sessions.routing_mode`; split the round counters. **No `delta_vector` column yet** — read `event_log.props.raw_delta` | — |
| **1. Telemetry** | Log terrain, `mode_pressure_in`, `regime_out`, `scoring_agrees`, knobs via `event_log`. Baseline `axis_coverage` and `empty_reveal_rate` | Step 0 |
| **2. Fix mapper** | Resolve D2. Real signals for the constant fields; reachable transitions; skip pressure | Steps −1, 1 |
| **3. Knobs refactor** | Replace the seven literals with `PairingKnobs`, defaults = today's values | Step 2 |
| **4. Shadow** | Compute knobs from terrain, log divergence, keep serving legacy | Step 3 gate green |
| **5. Canary 5% → A/B 50% → 100%** | Staged rollout. **Delta source must be control-grade first** — see below | Part 7 exit criteria |

### Delta source: staged, not one decision

D4 resolves differently at different stages, which earlier drafts conflated:

| Stage | Source | Rationale |
|---|---|---|
| Steps 0–4 (telemetry, shadow) | `event_log.props.raw_delta` | Already written on every choice. No migration. Gaps are acceptable — nothing is being controlled |
| Step 5 onward (canary and live) | Control-grade required | A dropped event flattens `recentDeltas`, reads as "not volatile," and pushes the regime toward compound |

"Control-grade" means either promoting the delta to a durable `choices.delta_vector` column, **or** making the mapper treat a missing delta as *unknown* rather than as zero — declining to assert a ruggedness signal it has no data for. Either is acceptable; silently defaulting to zero is not.

### Step 3 gate

The refactor is strictly "replace seven literals with `knobs.*`" — no restructuring, no reordering, no reinterpretation. An earlier draft proposed a rewrite that silently dropped shipped behavior; that must not happen again.

**Safeguards that must survive the refactor byte-for-byte:**

| Safeguard | Current behavior |
|---|---|
| Same-artist exclusion | `differentArtist` is **unconditional**. Same-artist matchups are "micro-comparisons inside one artist's catalog," not lane decisions |
| Recognition floor | `min_canon >= canonFloor` filter, **including** the "if the floor empties the pool, drop the floor" fallback |
| Recognition blend | `recogBlend` mixes `recognition_score` with `diagnostic_weight` per mode |
| Fork filter | Hard-filter to pairings testing the leaning axes, when any axis exceeds 15 |
| `selection_reason` | Returned on every pick; consumed by `pairing_shown.props` and the admin diagnostics views |
| Lane invariant | `assertWithinLane`, plus the general-lane retry fallback in `nextPairingImpl` |

Note the earlier draft made same-artist exclusion *conditional* on a diversity weight, which would have started serving same-artist pairings in compound regime. It also invented `isRecognizable()` and `isCanonSong()` helpers that do not exist — recognition arrives as a `Map<string, RecognitionRow>` hydrated from the `pairing_recognition` view, not as a property of the candidate.

**Tests that gate the merge:**

- `src/musicdna/engine/pairing.test.ts` — the direct `selectPairing` contract, including `drops same-artist pairings`
- `src/musicdna/engine/index.test.ts` — the golden fixture, self-described as catching pairing-selection changes
- **a new assertion** on byte-identical `selection_reason` across a seeded-RNG corpus, since the existing tests compare picked ids and would let a scoring shift through

`session.test.ts` is **not** the right gate — it only exercises `buildStartSessionSeed` and never calls `selectPairing`.

### Step 4 gate: prove every transition is reachable

Three of four transition rules are currently unreachable (Part 1). Rather than rediscovering this from shadow data, assert it directly in Agent Brain with a unit test that enumerates the terrain the mapper can actually emit and checks each rule fires at least once:

```typescript
it("every transition rule is reachable from MusicDNA terrain", () => {
  const reachable = enumerateMusicDNATerrains();   // cartesian product of mapper outputs
  const fired = new Set(
    reachable.map((t) => scoreTerrain(t).transition_candidate).filter(Boolean),
  );
  expect(fired).toContain("prune");
  expect(fired).toContain("compound");
  expect(fired).toContain("explore");   // fails today — see Part 1
});
```

This is cheap, it documents the constraint as an executable fact, and it catches regressions if the mapper's constants change later. A rule that cannot fire should either be made reachable or explicitly declared out of scope — not left silently dead.

### Rollback

Instant, no deploy: set `MUSICDNA_ROUTING_MODE=legacy` and `AGENT_BRAIN_ROLLOUT_PERCENT=0`. The legacy path stays intact through full rollout.

---

## Part 7 — Guardrails and exit criteria

### Shadow exit criteria

Defined up front so shadow mode cannot run indefinitely. Proceed only when **all** hold:

| Criterion | Threshold | Why |
|---|---|---|
| Errors in the recommendation path | `0` | Any exception means it is not production-ready |
| `mode_differs` rate | `15%–60%` | Below 15% regime adds nothing; above 60% the mapper is miscalibrated |
| `scoring_agrees` | `< 95%` | At ~100%, Agent Brain is confirming, not deciding (D2) |
| Regime distribution | every reachable regime ≥ 5% | If compound is 0%, D1 is the blocker |
| Divergences hand-reviewed | `≥ 30` cases | Someone must confirm different is *better* |
| Sessions in window | `≥ 200` | Below this the rates are noise |

**Abort and re-specify if** `mode_differs > 60%`, or hand review finds the divergent pick worse in most sampled cases.

### Evidence guardrails

Narrowing selection concentrates the axes being tested, which can starve the evidence ledger. With 6 rounds and `MIN_SUPPORT = 2` there is almost no slack, and the failure is user-visible.

| Metric | Definition | Action |
|---|---|---|
| `v_axis_independence` | **Existing view.** Distinct axes appearing in `choice_scored.supports` per session | Track per session; alert on regression |
| `allowed_claims_count` | `allowed_claims.length` | Track per session |
| `rounds_skipped` | `skipped_pairing_ids.length` | Track against the two above |
| `empty_reveal_rate` | share of sessions with `allowed_claims.length === 0` | **Hard rollback trigger** |

`v_axis_independence` already exists and measures exactly the concentration risk this integration introduces — no new metric is needed, just a `GROUP BY variant` over it.

`empty_reveal_rate` is not a metric to review later. Any increase means regime routing has starved the ledger and the reveal is degrading to *"Nothing cleared the evidence threshold this round."*

> **Two existing analytics surfaces are already dead at 6 rounds.** `v_session_stability` answers "did the round-8 winner survive to reveal?" using the `archetype_ranking_snapshot` events emitted at rounds 8/10/12/14 — none of which fire. Resolving D1 should include deciding whether to re-point those checkpoints at the real budget or retire the view.

### Success metrics

| Metric | Baseline | Target |
|---|---|---|
| `archetype_margin` (avg) | TBD | Improve — primary quality metric |
| `archetype_score` (avg) | TBD | Supporting context only — it is a cosine, not a probability |
| `v_axis_independence` (avg) | TBD | No regression — guardrail |
| `empty_reveal_rate` | TBD | No regression — hard trigger |
| Completion rate | TBD | No regression |
| `archetype_flagged` rate | TBD | No regression |

Baseline all six before Step 4.

---

## Part 8 — Surfaces that will drift

| Surface | Impact |
|---|---|
| `docs/musicdna/api-v1.md` | Adding `routing_mode` / `regime` to the pairing response is a contract change |
| `docs/musicdna/mobile_flutter_api_contract.md` | Same; confirm the Flutter client tolerates unknown fields |
| `docs/musicdna/instrumentation.md` | Should document the `experiment_key` / `variant` convention |
| `src/routes/api/public/test/$action.ts` | Agent test harness calls `*Impl` directly with a service-role client; new required args break it |
| `src/routes/api/v1/e2e.test.ts` | Needs a pinned `routing_mode` to stay deterministic |

No Flutter changes are required — the feature flag is entirely server-side.

---

## Appendix A — Findings log

Condensed record of what the review turned up, with locations, so the reasoning is auditable.

| # | Finding | Location |
|---|---|---|
| 1 | `SelectionMode` is constant per session; too coarse to carry the integration | `musicdna.functions.ts:~579` |
| 2 | `mode_pressure` (+4) plus a +8/+5/+5/0 constant baseline makes `scoreTerrain` a near pass-through | `cognitive-router/scoring.ts` |
| 3 | Three of four transition rules unreachable, incl. the `compound → explore` safety valve | `cognitive-router/scoring.ts` |
| 4 | Skip is a live, load-bearing signal that was absent from earlier drafts | `musicdna.functions.ts:1312` |
| 5 | `artist_frequency` not derived at the call site; delta lives in `event_log.props.raw_delta`, not on `choices` | `choices` schema, `emitChoiceDiagnostics` |
| 6 | Analytics SQL referenced non-existent columns; `archetype_score` is a cosine | `sessions` schema |
| 7 | `event_log` already provides `experiment_key` / `variant`; `EVENT_TYPES` is an allow-list | `musicdna.functions.ts:1893` |
| 8 | New tables need RLS, GRANTs, and an ownership path | `supabase/migrations/*` |
| 9 | Earlier draft's `selectPairing` rewrite silently dropped six shipped behaviors | `engine/pairing.ts` |
| 10 | `ModePressure` and `SearchRegime` were conflated; `escape` already exists | `cognitive-router/types.ts` |
| 11 | `shouldStop` interaction unspecified though it controls the rounds metric | `engine/pairing.ts:80` |
| 12 | API docs, test harness, e2e test, bootstrap early-return unaccounted for | various |
| 13 | **Three conflicting round budgets; the product is 6 rounds, putting compound's reachability in doubt** | `onboarding.tsx:35` |
| 14 | Regime can starve the evidence ledger; real gate is `2` / `0.55` | `musicdna.functions.ts:1643` |
| 15 | Golden fixture is `index.test.ts`, not `session.test.ts`; probe cadence is moot | `engine/*.test.ts` |
| 16 | Shadow exit criteria were undefined | — |

## Appendix B — What changed from earlier drafts

Earlier drafts were written against `acedge123/idea-builder` and carry errors that should not be copied forward.

| Earlier draft said | Correct |
|---|---|
| Sessions run 12–18 rounds; escape at 15, cap at 18 | Web ships **6 rounds**; those constants are dead code |
| `delta_vector` is never persisted; add a column | Already in `event_log.props.raw_delta` on every `choice_scored` |
| De-weighting `mode_pressure` is an independent fix | It **removes compound entirely** unless the constants are fixed first |
| `round` is a single number | Separate `rounds_answered` / `rounds_skipped` / `rounds_shown` |
| Add an `axis_coverage` metric | `v_axis_independence` already measures it |
| Compound is *mathematically* unreachable | Overstated. Priors seed axes to 35 and `applyChoice` moves several at once — it is **empirically unverified**, settle it with the `vector_after` query |
| `SelectionMode` never changes | It changes once, on bootstrap lane promotion (`confidence = 0.65`) |
| A single `LEGACY_KNOBS` constant preserves behavior | It cannot. Use `legacyKnobsForMode(mode)` — blend and floor are mode-derived |
| Compound fires late in the session | Compound is **unreachable** at 6 rounds |
| Probe flips indicate rugged terrain | Probes are **quarantined**; `flips` is always empty |
| Decay the probe schedule rather than disabling it | There is **no live probe schedule**; `probe_weight` removed |
| Recognition mode is implicit and would be dropped | It is a first-class `SelectionMode`, preserved |
| `min_canon_floor: 0.3` | Wrong scale — `RECOGNITION_FLOORS` are `0`/`45`/`55` on 0–100 |
| Regime maps to `SelectionMode` | Too coarse; regime maps to `PairingKnobs` |
| Gate the refactor on `session.test.ts` | That file never calls `selectPairing`; use `pairing.test.ts` + `index.test.ts` |
| Add `shadow_comparisons` and `regime_log` tables | Use `event_log` with `experiment_key` / `variant` |
| Track `archetype_confidence` and `rounds` | Neither column exists; use `archetype_margin` and a `choices` count |
| Evidence rule is "≥3 supporting, 0 contradicting" | That governs `ShippedClaim`; the reveal uses `2` / `0.55` |
| Bucket sessions per-request by hashing the id | Persist the arm on `sessions.routing_mode` at creation |

### Resolved product questions

- **Is the regime shown to the user?** No. It would break the critic illusion.
- **Per-lane regime weights?** Not initially. Ship one global table and learn from telemetry.
- **Does the LLM know the regime?** No. Regime confidence may feed the hedge selector, which is close to what `fit_tier` already does.