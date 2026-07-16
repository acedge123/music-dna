// MusicDNA Engine — factory + public surface.
//
// One entry point for callers (web server-fns, /api/v1 routes, tests, future
// Flutter admin tools). `createEngine(deps)` returns bound methods that
// compose the pure engine modules. Deps are injected via ports — no direct
// Supabase / LLM / clock / rng access here.
//
// The heavy `*Impl` glue in src/lib/musicdna.functions.ts stays where it is
// (transport-layer I/O + event logging), but every deterministic decision
// inside it already flows through these primitives, so there is exactly one
// implementation of the domain logic.

import type { Clock, EngineDeps, Rng, SupabaseGateway, LLMGateway } from "./ports";
import { buildStartSessionSeed, type BuildStartSessionInputs, type StartSessionSeed } from "./session";
import {
  selectPairing,
  shouldStop,
  assertWithinLane,
  type PairingCandidate,
  type SelectPairingInput,
  type SelectPairingResult,
} from "./pairing";
import { applyChoice, type ApplyChoiceInput } from "./choice";
import { assignArchetype, type ArchetypeCatalogEntry } from "./archetypes";
import { buildPublicReveal, type PublicRevealInput } from "./reveal";
import { seedVectorFromPriors } from "./priors";
import { deriveDescriptors } from "./descriptors";
import { EngineErrorException } from "./errors";

export type MusicDNAEngine = {
  deps: EngineDeps;
  buildStartSessionSeed(input: Omit<BuildStartSessionInputs, "rng">): StartSessionSeed;
  selectPairing<P extends PairingCandidate>(
    input: Omit<SelectPairingInput<P>, "rng">,
  ): SelectPairingResult<P>;
  shouldStop: typeof shouldStop;
  assertWithinLane: typeof assertWithinLane;
  applyChoice(input: ApplyChoiceInput): ReturnType<typeof applyChoice>;
  evaluateProbe(input: EvaluateProbeInput): ReturnType<typeof evaluateProbe>;
  assignArchetype(
    vector: Parameters<typeof assignArchetype>[0],
    catalog: ArchetypeCatalogEntry[],
  ): ReturnType<typeof assignArchetype>;
  buildPublicReveal(input: PublicRevealInput): ReturnType<typeof buildPublicReveal>;
  seedVectorFromPriors: typeof seedVectorFromPriors;
  deriveDescriptors: typeof deriveDescriptors;
};

export function createEngine(deps: EngineDeps): MusicDNAEngine {
  return {
    deps,
    buildStartSessionSeed: (input) => buildStartSessionSeed({ ...input, rng: deps.rng }),
    selectPairing: (input) => selectPairing({ ...input, rng: deps.rng }),
    shouldStop,
    assertWithinLane,
    applyChoice,
    evaluateProbe,
    assignArchetype: (v, catalog) => assignArchetype(v, catalog),
    buildPublicReveal,
    seedVectorFromPriors,
    deriveDescriptors,
  };
}

// Default deps for prod-ish callers that don't inject their own.
export function systemClock(): Clock {
  return { now: () => new Date() };
}
export function mathRng(): Rng {
  return { next: () => Math.random() };
}

// Deterministic Rng for tests / golden fixtures. Mulberry32.
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next: () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function fixedClock(iso: string): Clock {
  const d = new Date(iso);
  return { now: () => d };
}

export { EngineErrorException } from "./errors";
export type { EngineDeps, SupabaseGateway, LLMGateway, Clock, Rng } from "./ports";
