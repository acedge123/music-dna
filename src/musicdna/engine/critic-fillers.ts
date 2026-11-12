// Shared stalling lines shown while the Critic's read is pending (web + Flutter).
// They are not evidence: never name a song, trait or finding, never hint at the next test.
export const CRITIC_FILLERS = [
  "Hm. Interesting.",
  "Hold on. Let me listen to that again.",
  "That's not the one I expected.",
  "Filing that away…",
  "Okay. Okay. Give me a second.",
  "You didn't even hesitate.",
  "Let me sit with that.",
  "Turning that one over…",
] as const;

/** Rotation without repeats: deterministic offset per session so reloads stay calm. */
export function fillerAt(seed: string, tick: number): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CRITIC_FILLERS[(h + tick) % CRITIC_FILLERS.length];
}
