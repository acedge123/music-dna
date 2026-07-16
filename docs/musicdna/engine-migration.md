# MusicDNA Engine — Migration Plan

The engine is being extracted from `src/lib/musicdna.functions.ts` into a
transport-agnostic service under `src/musicdna/engine/`. Web (via
`createServerFn`), the upcoming `/api/v1/*` REST layer (for Flutter and any
future client), and tests all call the **same** engine. No duplicate
implementations, ever.

## Layout

```
src/musicdna/
  engine/        pure domain — no Supabase/LLM/React imports
    types.ts     DTOs shared with adapters, routes, and clients
    ports.ts     SupabaseGateway, LLMGateway, Clock, Rng interfaces
    scoring.ts   ✅ migrated — pure vector math (dot, cosine, tiers)
    archetypes.ts ✅ migrated — assignment, margin, flag reasons, tier
    reveal.ts     ✅ migrated (public share) — buildPublicReveal DTO
    priors.ts     ✅ migrated — seedVectorFromPriors (opening-3 seeding)
    descriptors.ts ✅ migrated — deriveDescriptors (mood read off axes)
    voice.ts      ✅ migrated — hedges, hesitation, hash-stable variant picks
    critic.ts     ✅ migrated (voice constants) — CRITIC_PERSONA + CRITIC_VOICE_EDITORIAL
    pairing.ts    ✅ migrated — selectPairing (fork filter + weighted pick), shouldStop, assertWithinLane
    session.ts    ✅ migrated — buildStartSessionSeed (lane + confidence + probes + seed vector)
    choice.ts     ✅ migrated — applyChoice (vector math). Cross-lane probe flipping is quarantined in experiments/cross-lane-probes.ts (see docs/musicdna/experiments/cross-lane-probes.md) and is NOT exposed by createEngine().
    index.ts        ✅ createEngine(deps) factory + seededRng / fixedClock helpers
    errors.ts       ✅ EngineErrorException + code→status map for route envelopes
    testing.ts      ✅ InMemorySupabaseGateway + ScriptedLLMGateway for golden fixtures
  adapters/
    llm-gateway.ts  ✅ LLMGateway impl over Lovable AI Gateway
    supabase.ts     ✅ SupabaseGateway impl wrapping a SupabaseClient
```


## Rules for engine code

- No `import ... from "@/integrations/supabase/..."`.
- No `import ... from "@tanstack/react-start"`.
- No React, no DOM, no `process.env` reads.
- All I/O goes through a port. All time comes from `Clock`. All randomness
  comes from `Rng`.
- Failures are typed (`EngineError`); routes/server-fns translate them to
  HTTP or thrown `Error`s.

## Migration order (each step keeps web working)

1. ✅ Engine skeleton + `scoring.ts` + tests.
2. ✅ `archetypes.ts` + tests — pure assignment, margin, flag reasons.
3. ✅ `reveal.ts` (public share) + tests, and `GET /api/v1/share/:token`.
4. ✅ `share.functions.ts` and `finalizeSessionImpl` now import
   `buildPublicReveal` / `assignArchetype` from the engine — web and REST
   share one code path for scoring, margin, and public share DTOs.
5. ✅ REST v1 surface for the interactive loop: `POST /api/v1/session`,
   `GET /api/v1/session/:id/next`, `POST /api/v1/session/:id/choice`,
   `POST /api/v1/session/:id/reveal`. Routes verify Supabase bearer via
   `_auth.ts` and delegate to the same `*Impl` helpers the web server
   functions call. Zero duplicate implementation.
6. ✅ Extracted the deterministic reveal-time helpers into the engine:
   `priors.ts` (seedVectorFromPriors), `descriptors.ts` (mood read),
   `voice.ts` (hedge ladder, hesitation copy, `pickByHash`, `dimSeed`).
   `musicdna.functions.ts` re-exports from the engine — one implementation.
   Test count now 41 passing.
7. ✅ Extracted the critic voice + LLM transport:
   - `engine/critic.ts` owns `CRITIC_PERSONA` and `CRITIC_VOICE_EDITORIAL`
     (the IP — the exact strings that make the app sound like the app).
   - `adapters/llm-gateway.ts` implements the `LLMGateway` port over the
     Lovable AI Gateway. Only place that knows the URL, model default, and
     `LOVABLE_API_KEY`. `musicdna.functions.ts` `ai()` is a 1-liner over
     `callLovableAi`. Test count now 48 passing.
8. ✅ Extracted the interactive-loop math into pure engine modules:
   - `engine/session.ts` — `buildStartSessionSeed` produces lane,
     confidence, probe candidates, and seed vector from the opening
     analysis. `startSessionImpl` is now a 3-line wrapper around read →
     seed → insert.
   - `engine/pairing.ts` — `selectPairing` owns the fork-filter,
     axis-need scoring, and weighted random pick. `shouldStop` and
     `assertWithinLane` extracted alongside. `nextPairingImpl` reads the
     pool from Supabase and hands it to the engine.
   - `engine/choice.ts` — `applyChoice` owns the delta / weighted vector
     update / top-dim logic. `evaluateProbe` owns cosine alignment, probe
     tally updates, and the flip decision. `recordChoiceImpl` now delegates
     to both; event logging stays at the transport layer. Test count now
     **64 passing** (added session/pairing/choice suites).
9. ✅ Wrapped everything behind `createEngine(deps)` in `engine/index.ts`.
   `adapters/supabase.ts` implements the `SupabaseGateway` port over a real
   `SupabaseClient`. `engine/testing.ts` ships an in-memory gateway and a
   scripted LLM gateway. `engine/errors.ts` defines `EngineErrorException`
   with a code→HTTP-status map for the route envelope. Golden-fixture loop
   test (`engine/index.test.ts`) drives seed → pairing → choice → probe →
   archetype end-to-end with zero I/O. Test count now **68 passing**.



## Testing

`bun test` runs the engine + adapter test suite. Engine tests use
in-memory `SupabaseGateway` and scripted `LLMGateway` fakes — no network,
no DB. The LLM adapter test injects `fetchImpl` to stay offline.


