// Shared stalling lines shown while the Critic's read is pending (web + Flutter).
// They are not evidence: never name a song or trait, never hint at the next test.
// Each wait uses its own three lines (thinking → tension → neutral), so no line repeats in an interview.
export const FILLER_THINKING = [
  "Hold on. Let me listen to that again.",
  "Turning that one over…",
  "Let me sit with that.",
  "Running that back in my head.",
  "Give me a second with this one.",
  "Cross-referencing. Don't rush me.",
  "Okay. Thinking.",
  "Putting the needle back on that one.",
] as const;
export const FILLER_TENSION = [
  "That's not the one I expected.",
  "Now that's a choice.",
  "Oh, you're going to make this interesting.",
  "Bold. Very bold.",
  "Hm. That changes things.",
  "You didn't even hesitate.",
  "Well. That's a plot twist.",
  "Interesting. Very interesting.",
] as const;
export const FILLER_NEUTRAL = [
  "Filing that away…",
  "Noted.",
  "Okay. Okay.",
  "Writing that down.",
  "Got it. Almost there.",
  "One more beat…",
  "Hang tight.",
  "Nearly have it.",
] as const;

/** Wait 0 = opening, 1–6 = after each pick, 7 = spare. Rotates within its own three lines. */
export function fillerFor(wait: number, tick: number): string {
  const i = Math.max(0, wait) % FILLER_THINKING.length;
  const set = [FILLER_THINKING[i], FILLER_TENSION[i], FILLER_NEUTRAL[i]];
  return set[tick % set.length];
}
