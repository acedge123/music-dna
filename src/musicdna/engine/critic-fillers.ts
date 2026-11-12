// Shared stalling lines shown while the Critic's read is pending (web + Flutter).
// Not evidence: never name a trait, never hint at the next test. Each wait uses its own
// index, so no line repeats within an interview (8 lines per group covers opening + 6 picks).

/** While the pick saves (~1s), before we know how it landed. */
export const FILLER_NEUTRAL = [
  "Noted.",
  "Writing that down.",
  "Filing that away…",
  "Okay. Okay.",
  "Got it.",
  "One beat…",
  "Hang tight.",
  "Mm-hm.",
] as const;

/** How the pick landed against the listener's strongest prior lean (server `hunch`). */
export const FILLER_REACTION = {
  against: [
    "That's not the one I expected.",
    "Well. That's a plot twist.",
    "Huh. Didn't see that coming.",
    "Oh, you're going to make this interesting.",
    "Hm. That changes things.",
    "Now you're messing with my notes.",
    "Plot thickens.",
    "Okay, curveball.",
  ],
  with: [
    "Called it.",
    "Thought so.",
    "Right on cue.",
    "Yep. Saw that one coming.",
    "Consistent. I like it.",
    "That tracks.",
    "No surprises there.",
    "Exactly where I'd have bet.",
  ],
  early: [
    "Hm.",
    "Let me sit with that.",
    "Turning that one over…",
    "Running that back in my head.",
    "Putting the needle back on that one.",
    "Give me a second with this one.",
    "Okay. Thinking.",
    "Cross-referencing. Don't rush me.",
  ],
} as const;

/** About the person, claims nothing specific. Shown until the Critic's comment lands. */
export const FILLER_PERSON = [
  "Music is in your blood.",
  "Dig it. Let's keep cooking.",
  "You've got ears, I'll give you that.",
  "This is getting good.",
  "You don't make this easy. Good.",
  "I'm starting to like you.",
  "Somebody raised you right.",
  "Keep 'em coming.",
  "Taste. Actual taste.",
  "We're onto something.",
  "You and me, we're getting somewhere.",
  "Hold that thought.",
  "Almost got you figured out. Almost.",
  "Stay with me.",
  "Right. Here's what I'm hearing…",
  "Okay, the Critic has notes.",
] as const;

/** After a skip: the Critic owns the miss. {artist} is a song shown in the skipped matchup. */
export const FILLER_SKIP = [
  "What? No {artist}? Alright, youngin', I'll grab a new one.",
  "Ah, my bad. Let me try a new angle.",
  "Not a {artist} person? Noted. Next.",
  "Fair. I'll dig deeper in the crates.",
  "Okay, that one's on me.",
  "Tough crowd. Pulling another record.",
  "{artist}? Never mind. Moving on.",
  "My fault. Let me find something you'll know.",
] as const;

export type Hunch = keyof typeof FILLER_REACTION;

const at = <T,>(list: readonly T[], i: number) => list[Math.max(0, i) % list.length];

/** Lines for one wait. Before `hunch` is known only the neutral line shows. */
export function fillerLines(wait: number, hunch?: Hunch | null): string[] {
  if (!hunch) return [at(FILLER_NEUTRAL, wait)];
  return [at(FILLER_REACTION[hunch], wait), at(FILLER_PERSON, wait * 2), at(FILLER_PERSON, wait * 2 + 1)];
}

export function skipLine(skipIndex: number, artist: string): string {
  return at(FILLER_SKIP, skipIndex).replace("{artist}", artist);
}

/**
 * Did this pick go with or against the strongest prior lean on its top trait?
 * Pure, instant; computed inside the existing vote save. Weak leans stay "early".
 */
export function pickHunch(
  priorVector: Record<string, number>,
  dim: string,
  delta: number,
  round: number,
  minLean = 15,
): Hunch {
  const lean = priorVector[dim] ?? 0;
  if (round <= 1 || !delta || Math.abs(lean) < minLean) return "early";
  return Math.sign(lean) === Math.sign(delta) ? "with" : "against";
}
