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
export const FILLER_PERSON: ReadonlyArray<readonly string[]> = [
  // One beat per wait: a setup → punchline pair, or a single line that stands alone.
  ["I'm starting to like you.", "Don't make it weird."],
  ["Bold move.", "I'll allow it."],
  ["Somebody raised you right.", "Or you rebelled perfectly."],
  ["Taste. Actual taste.", "I'm as surprised as you are."],
  ["Music is in your blood.", "Possibly a little too much."],
  ["Dig it. We'll let you cook."],
  ["You might be my favorite interview today.", "Don't let it go to your head."],
  ["Okay, you're good at this.", "Suspiciously good, actually."],
];

/** After a skip: the Critic owns the miss. {artist} is a song shown in the skipped matchup. */
export const FILLER_SKIP = [
  "Ah, my bad. Let me try a new angle.",
  "Not a {artist} person? Noted. Next.",
  "Fair. I'll dig deeper in the crates.",
  "Okay, that one's on me.",
  "Tough crowd. Pulling another record.",
  "{artist}? Never mind. Moving on.",
  "My fault. Let me find something you'll know.",
  "Swing and a miss. Mine, not yours.",
] as const;
/** Both skipped songs are pre-2000: listener is probably younger. */
export const SKIP_YOUNG = "What? No {artist}? Alright, youngin', I'll grab a new one.";
/** Both skipped songs are 2020+: listener is probably older. */
export const SKIP_OLD = "Don't know {artist}? OK boomer, I'll grab something older.";

export type Hunch = keyof typeof FILLER_REACTION;

const at = <T,>(list: readonly T[], i: number) => list[Math.max(0, i) % list.length];

/** Lines for one wait. Before `hunch` is known only the neutral line shows. */
export function fillerLines(wait: number, hunch?: Hunch | null): string[] {
  if (!hunch) return [at(FILLER_NEUTRAL, wait)];
  return [at(FILLER_NEUTRAL, wait), at(FILLER_REACTION[hunch], wait), ...at(FILLER_PERSON, wait)];
}

export function skipLine(
  skipIndex: number,
  songs: ReadonlyArray<{ artist: string; year?: number | null }>,
): string {
  const years = songs.map((x) => x.year).filter((y): y is number => typeof y === "number");
  const known = years.length === songs.length && songs.length > 0;
  const pick = (from: typeof songs) => from[skipIndex % from.length].artist;
  if (known && Math.max(...years) < 2000) return SKIP_YOUNG.replace("{artist}", pick(songs));
  if (known && Math.min(...years) >= 2020) return SKIP_OLD.replace("{artist}", pick(songs));
  return at(FILLER_SKIP, skipIndex).replace("{artist}", pick(songs));
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
