# Music DNA × Agent Brain Integration Analysis

**Date:** 2026-07-25
**Status:** Analysis complete, integration plan drafted
**Repositories:**
- Agent Brain: `github.com/The-Gig-Agency/agent-brain`
- Music DNA: `github.com/acedge123/idea-builder` (src/musicdna/)

---

## Executive Summary

This document analyzes how the **Agent Brain** cognitive router can enhance the **Music DNA** preference inference service. Both systems solve related problems:

- **Agent Brain** routes problems to the right *search regime* (explore, prune, compound, coordinate) based on terrain analysis
- **Music DNA** infers music taste through adaptive A/B choices, implicitly making regime-like decisions

The integration opportunity: make Music DNA's implicit routing decisions **explicit, tunable, and learnable** through Agent Brain's regime selection framework.

---

## Part 1: Agent Brain Architecture

### What It Does

Agent Brain is a **cognitive router** that selects the appropriate *thinking strategy* for a given problem. It does NOT select ML models — it selects **search regimes**.

### The Four Regimes

| Regime | When to Use | Algorithm Inspiration |
|--------|-------------|----------------------|
| **Explore** | High uncertainty, need to learn before committing | Bayesian Optimization, Multi-Armed Bandits |
| **Prune** | Many options, need to narrow down | Branch and Bound, hypothesis elimination |
| **Compound** | Signal exists, time to deepen and scale | Momentum, exploitation phases |
| **Coordinate** | Multi-agent/adversarial, incentives matter | Game Theory, Mixture of Experts |

### The 12 Terrain Dimensions

```typescript
type TerrainProfile = {
  feedback_latency: "fast" | "medium" | "slow";
  reversibility: "high" | "medium" | "low";
  uncertainty: "low" | "medium" | "high";
  branching_factor: "low" | "medium" | "high";
  adversariality: "none" | "some" | "high";
  ruggedness: "low" | "medium" | "high";
  local_minima_risk: "low" | "medium" | "high";
  information_cost: "low" | "medium" | "high";
  coordination_load: "low" | "medium" | "high";
  environment_stability: "stable" | "shifting";
  time_horizon: "one_shot" | "iterative";
  mode_pressure: "explore" | "prune" | "compound" | "escape" | "coordinate" | "create";
};
```

### Scoring Mechanism

The scoring is **deterministic** — a weighted lookup table:

```typescript
const DIMENSION_WEIGHTS = {
  feedback_latency: {
    fast: { explore: 2, prune: 1 },
    medium: { explore: 1, prune: 1, compound: 1 },
    slow: { coordinate: 1, compound: -1, explore: -1 },
  },
  uncertainty: {
    low: { compound: 2, prune: 1, explore: -1 },
    medium: { prune: 2, explore: 1, coordinate: 1 },
    high: { explore: 3, coordinate: 1, compound: -2 },
  },
  // ... 12 dimensions total
};
```

Each terrain dimension adds/subtracts points per regime. Highest score wins.

### Transition Rules

Agent Brain includes rules for when to switch regimes mid-task:

```typescript
const TRANSITION_RULES = [
  {
    candidate: "prune",
    when: (profile, topRegime) =>
      topRegime === "explore" &&
      profile.uncertainty !== "high" &&
      profile.branching_factor === "high",
  },
  {
    candidate: "compound",
    when: (profile, topRegime) =>
      topRegime === "prune" &&
      profile.uncertainty === "low" &&
      profile.environment_stability === "stable",
  },
  // ...
];
```

### API Surface

```
POST /v1/recommend        — Structured terrain → regime recommendation
POST /v1/intake-recommend — Messy text → inferred terrain + recommendation
GET  /health              — Liveness
GET  /ready               — Readiness
```

### What Agent Brain Does NOT Do

- Does NOT use ML models underneath
- Does NOT execute the search — only recommends the strategy
- Does NOT learn from outcomes (yet — AB-6 planned)

---

## Part 2: Music DNA Architecture

### What It Does

Music DNA is a **preference inference engine** that discovers music taste through adaptive A/B choices between songs.

### Core Session Flow

```
1. User names 5 songs they love
       ↓
2. LLM classifies lane (alternative, hip_hop, etc.) + initial dimension estimates
       ↓
3. Loop: Show song pair → User chooses → Update vector → Generate commentary
       ↓
4. Stop when confidence threshold reached (typically 12-15 rounds)
       ↓
5. Assign archetype via cosine similarity → LLM generates final interpretation
```

### The 10 Taste Dimensions

```typescript
const DIMS = [
  "movement",       // forward motion ←→ stillness
  "atmosphere",     // immersive mood ←→ statement
  "immersion",      // slow reveal ←→ immediacy
  "scale",          // vast ←→ intimate
  "community",      // communal ←→ solitary
  "perspective",    // witness ←→ feeling
  "confidence",     // command ←→ vulnerability
  "tension",        // danger ←→ release
  "texture",        // refinement ←→ rawness
  "transformation", // takes you somewhere ←→ holds shape
];
```

### Where LLMs Are Used

| Stage | LLM Role | Deterministic Logic |
|-------|----------|---------------------|
| Opening classification | Extract lane + dimensions from 5 songs | — |
| Pairing selection | — | Weighted scoring on uncertainty + hypothesis challenge |
| After each choice | Micro-reaction commentary | Vector update, probe evaluation |
| Final synthesis | 2-4 sentence interpretation | Archetype assignment (cosine) |
| Chat | Ongoing conversation | Critic profile adaptation |

### Pairing Selection Logic (Current)

From `src/musicdna/engine/pairing.ts`:

```typescript
function selectPairing(input: SelectPairingInput): SelectPairingResult {
  // 1. Filter out already-used pairings
  let pool = input.pool.filter((p) => !used_ids.has(p.id));

  // 2. Hypothesis-challenging filter: prefer pairings that test strongest axes
  const leaningAxes = new Set(
    dims
      .map((d) => ({ d, v: Math.abs(vector[d] ?? 0) }))
      .filter((x) => x.v >= 15)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => x.d),
  );

  // 3. Score by axis need (inverse of current confidence)
  const need = (dim: string) => 1 / (1 + Math.abs(vector[dim] ?? 0));
  const scored = pool.map((p) => {
    const axisNeed = tests.reduce((s, d) => s + need(d), 0) / tests.length;
    const challengesHypothesis = tests.some((t) => leaningAxes.has(t));
    const challengeBoost = challengesHypothesis ? 1.5 : 1;
    return { p, w: axisNeed * challengeBoost };
  });

  // 4. Weighted random selection
  return weightedPick(scored, rng);
}
```

### Stopping Logic

```typescript
function shouldStop(input: {
  round: number;
  vector: Vector;
  dims: readonly string[];
}): { done: boolean; confidence: number } {
  const minRounds = 12;
  const confThresh = 0.6;
  const axisConf = 30;

  const confident_axes = dims.filter(
    (d) => Math.abs(vector[d] ?? 0) >= axisConf,
  ).length;

  const confidence = confident_axes / dims.length;
  return {
    done: round >= minRounds && confidence >= confThresh,
    confidence
  };
}
```

### Probe System (Lane Exploration)

Music DNA probes alternative lanes at specific rounds to see if the user might belong elsewhere:

```typescript
const PROBE_ROUNDS = new Set([4, 9, 14]);
// At probe rounds, inject a pairing from a candidate lane
// Track win rate and cosine alignment
// If probe lane wins consistently, flip the user's lane
```

### Key Insight: Implicit Regime Decisions

Music DNA is already making regime-like decisions, but they're **hard-coded**:

| Decision Point | Current Logic | Equivalent Regime |
|----------------|---------------|-------------------|
| Early rounds: maximize coverage | `need = 1 / (1 + confidence)` | **Explore** |
| Challenge strongest axes | `challengeBoost = 1.5` | **Prune** |
| Probe other lanes | `PROBE_ROUNDS = [4, 9, 14]` | **Explore** |
| Stop when confident | `confidence >= 0.6` | Transition to **Compound** (implicit) |

---

## Part 3: Integration Opportunity

### The Problem

Music DNA's routing decisions are:
- **Implicit** — scattered across multiple functions
- **Hard-coded** — thresholds like 15, 30, 0.6 are magic numbers
- **Not learnable** — no way to measure if different strategies work better

### The Solution

Use Agent Brain to make these decisions **explicit, tunable, and learnable**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MUSIC DNA SESSION                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User's 5 songs → LLM → Initial lane + dimensions                  │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              AGENT BRAIN TERRAIN ASSESSMENT                  │   │
│  │                                                              │   │
│  │  feedback_latency: "fast" (immediate A/B choice)            │   │
│  │  uncertainty: HIGH → MEDIUM → LOW (as vector solidifies)    │   │
│  │  branching_factor: "high" (many songs, 10 dimensions)       │   │
│  │  information_cost: "low" (each pairing is cheap)            │   │
│  │  environment_stability: "stable" (taste doesn't shift)      │   │
│  │  local_minima_risk: "medium" (could over-index on one band) │   │
│  │                              ↓                               │   │
│  │              REGIME RECOMMENDATION                           │   │
│  │                                                              │   │
│  │  Round 1-4:  EXPLORE (uncertainty high)                     │   │
│  │  Round 5-8:  PRUNE (challenge hypothesis, narrow)           │   │
│  │  Round 9-12: COMPOUND (deepen strongest signals)            │   │
│  │  Round 12+:  Consider stopping or EXPLORE more              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  Pairing Selection uses regime to weight strategy                  │
│                              ↓                                      │
│  LLM micro-reactions + final synthesis                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Regime-Driven Pairing Selection

```typescript
function selectPairingWithRegime(
  input: SelectPairingInput,
  regime: SearchRegime
): SelectPairingResult {
  switch (regime) {
    case "explore":
      // Maximize information gain
      // - Prefer pairings on weakest/untested dimensions
      // - Include probe lanes
      // - Accept higher variance in choices
      return selectForExploration(input);

    case "prune":
      // Challenge the hypothesis
      // - Prefer pairings that test strongest axes
      // - Filter out "easy wins" (same artist, obvious mismatches)
      // - Focus on discriminating pairings
      return selectForPruning(input);

    case "compound":
      // Deepen existing signal
      // - Prefer pairings that reinforce leading patterns
      // - Stop probing other lanes
      // - Accept narrower exploration
      return selectForCompounding(input);

    case "coordinate":
      // N/A for single-user taste inference
      return selectForExploration(input);
  }
}
```

### Terrain Mapper

```typescript
function sessionToTerrain(session: MusicDNASession): TerrainProfile {
  const confidentAxes = DIMS.filter(
    d => Math.abs(session.vector[d] ?? 0) >= 30
  ).length;
  const confidence = confidentAxes / DIMS.length;
  const hasProbeFlips = session.probe_state?.flips?.length > 0;
  const artistBias = detectArtistBias(session);

  return {
    feedback_latency: "fast",
    reversibility: "high",
    uncertainty: confidence < 0.3 ? "high"
               : confidence < 0.6 ? "medium"
               : "low",
    branching_factor: session.round < 5 ? "high" : "medium",
    adversariality: "none",
    ruggedness: hasProbeFlips ? "high" : "medium",
    local_minima_risk: artistBias ? "high" : "medium",
    information_cost: "low",
    coordination_load: "low",
    environment_stability: "stable",
    time_horizon: "iterative",
    mode_pressure: inferModePressure(session),
  };
}

function inferModePressure(session: MusicDNASession): ModePressure {
  const confidence = calculateConfidence(session);
  const round = session.round;

  if (round < 4) return "explore";
  if (confidence < 0.3) return "explore";
  if (confidence > 0.7) return "compound";
  return "prune";
}
```

---

## Part 4: Benefits of Integration

### 1. Explicit Strategy

Before:
```typescript
// Magic numbers scattered across codebase
const challengeBoost = 1.5;
const axisConf = 30;
const confThresh = 0.6;
```

After:
```typescript
// One place defines strategy
const regime = agentBrain.recommendRegime(sessionToTerrain(session));
// Strategy drives all downstream decisions
```

### 2. Tunable Parameters

Agent Brain's weight table becomes the single place to tune behavior:
- "We want more exploration early" → increase explore weights for high uncertainty
- "Users are getting bored" → increase compound weights earlier

### 3. Measurable Outcomes

With regime logging, you can measure:
- Which regime sequences produce highest archetype confidence?
- Does EXPLORE→PRUNE→COMPOUND outperform EXPLORE→EXPLORE→EXPLORE?
- Do probe flips correlate with better outcomes?

### 4. Transferable Framework

The same terrain→regime mapping could apply to:
- Other preference inference (movie taste, product recommendations)
- Diagnostic interviews (medical symptoms, tech support)
- Any multi-dimensional search under uncertainty

---

## Part 5: What Needs to Be Built

### In Agent Brain

| Component | Status | Work Required |
|-----------|--------|---------------|
| Terrain scoring | ✅ Built | None |
| Regime recommendation | ✅ Built | None |
| Transition rules | ✅ Built | None |
| HTTP API | ✅ Built | None |
| Outcome telemetry | ❌ Missing | AB-6 work item |
| Learning/calibration | ❌ Missing | Future work |

### In Music DNA

| Component | Status | Work Required |
|-----------|--------|---------------|
| Session → Terrain mapper | ❌ Missing | New module |
| Regime-aware pairing selection | ❌ Missing | Refactor `selectPairing` |
| Regime logging | ❌ Missing | Add to session state |
| Agent Brain client | ❌ Missing | HTTP client or direct import |
| Outcome recording | ❌ Missing | Post-session telemetry |

### Integration Layer

| Component | Status | Work Required |
|-----------|--------|---------------|
| Shared types | ❌ Missing | TypeScript definitions |
| Integration tests | ❌ Missing | Test session flows |
| Documentation | 🔄 In Progress | This document |

---

## Appendix A: Code References

### Agent Brain Key Files

```
src/cognitive-router/
├── types.ts           # TerrainProfile, SearchRegime, etc.
├── scoring.ts         # scoreTerrain(), DIMENSION_WEIGHTS
├── router-runner.ts   # Debugging world simulation
├── problem-ingestion.ts # Text → terrain inference
└── index.ts           # Public exports
```

### Music DNA Key Files

```
src/musicdna/
├── engine/
│   ├── types.ts       # Vector, Lane, Pairing, etc.
│   ├── scoring.ts     # cosine(), scoreArchetype()
│   ├── pairing.ts     # selectPairing(), shouldStop()
│   ├── choice.ts      # applyChoice(), evaluateProbe()
│   ├── priors.ts      # seedVectorFromPriors()
│   └── ports.ts       # SupabaseGateway, LLMGateway interfaces
├── adapters/
│   └── llm-gateway.ts # Lovable AI Gateway client
└── (lib/musicdna.functions.ts) # Server functions, LLM prompts
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Regime** | A search strategy (explore, prune, compound, coordinate) |
| **Terrain** | The structural properties of a problem (uncertainty, reversibility, etc.) |
| **Lane** | Music genre category (alternative, hip_hop, etc.) |
| **Vector** | 10-dimensional taste profile accumulated through choices |
| **Pairing** | Two songs presented for A/B choice |
| **Probe** | A pairing from a different lane to test if user might belong there |
| **Archetype** | Named taste profile (e.g., "The Archaeologist") assigned via cosine similarity |

---

## Document History

- **2026-07-25** — Initial analysis and integration opportunity identified
