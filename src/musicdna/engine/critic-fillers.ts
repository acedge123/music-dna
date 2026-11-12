// Shared stalling lines shown while the Critic's read is pending (web + Flutter).
// Not evidence: never name a trait, never hint at the next test. Each wait uses its own
// index, so no line repeats within an interview (each pool covers opening + 6 picks).

/** While the pick saves (~1s), before we know how it landed. */
export const FILLER_NEUTRAL = [
  "Noted.",
  "Writing that down.",
  "Filing that away…",
  "Somewhere, a music critic is clearing their throat.",
  "A jury of one. Harsh, but efficient.",
  "One tap. Several wounded opinions.",
  "I'll save the dramatic gasp for later.",
  "Congratulations, you just offended an imaginary record-store clerk.",
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
    "A little awkward for my theory, but I'll survive.",
    "Somebody's favorite song just lost. Let's be discreet.",
    "I was so close to being smug about this.",
    "My notes and my ego will need a moment apart.",
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
  ["Dig it. We'll let you cook."],
  ["You might be my favorite interview today.", "Don't let it go to your head."],
  ["That was inconveniently persuasive."],
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
/** Both skipped songs are pre-2000; playful wording, not an age inference. */
export const SKIP_YOUNG = "What? No {artist}? Alright, youngin', I'll grab a new one.";
/** Compatibility field for clients using the recent-song skip branch; no age label. */
export const SKIP_OLD = "My fault. Let me find something you'll know.";

export type Hunch = keyof typeof FILLER_REACTION;

const at = <T,>(list: readonly T[], i: number) => list[Math.max(0, i) % list.length];

/** Lines for one wait. Before `hunch` is known only the neutral line shows. */
/** Era quips, used when both songs in the matchup share a decade. Pop-history jokes, no traits. */
export const FILLER_DECADE: Record<string, readonly string[]> = {
  "1970s": [
    "The liner notes would like to weigh in.",
    "There is absolutely a twelve-minute version of this argument.",
    "I'll spare you the lecture about what counts as real music.",
    "Let's call that settled before somebody adds a guitar solo.",
    "Somewhere a lava lamp just approved.",
    "Hold on, flipping the 8-track.",
    "Let me blow the dust off this one.",
    "Very Bicentennial of you.",
    "Shag carpet energy. I'm into it.",
    "Somebody check if this is on vinyl.",
  ],
  "1980s": [
    "The other song is demanding a remix.",
    "I heard a little studio reverb around that decision.",
    "Let's not make a whole music video out of this.",
    "I'll pretend I didn't already have a favorite.",
    "I can hear the hairspray.",
    "Pretty sure this was on MTV when MTV played music.",
    "Shoulder pads are back in the building.",
    "This is a mixtape decision. Respect.",
    "Neon approves.",
  ],
  "1990s": [
    "The other song has been quietly removed from the mixtape.",
    "I'm resisting the urge to call anything here authentic.",
    "You know this would become a three-hour dorm-room debate.",
    "Hold on, my CD is skipping.",
    "Flannel detected.",
    "Very TRL of you.",
    "Dialing up. Give me a second.",
    "As if. Kidding. Mostly.",
    "Let me page someone about this.",
  ],
  "2000s": [
    "Somewhere, a music blog is calling this a defining moment.",
    "That would have started a strangely personal comment war.",
    "My imaginary indie-radio host is judging us both.",
    "Updating your MySpace Top 8.",
    "Hold on, this ringtone cost me $2.99.",
    "Frosted tips are trembling.",
    "Burning this onto a mix CD as we speak.",
    "That's an away-message lyric.",
    "LimeWire says this file is totally safe.",
  ],
  "2010s": [
    "The algorithm would like to explain your choice. It can't.",
    "Someone is preparing a seventeen-part thread about this.",
    "That could launch three reaction videos before lunch.",
    "Adding a filter to that choice.",
    "That's a playlist-cover choice.",
    "Hold on, the aux cord is fighting me.",
    "Vine would've looped that.",
    "That choice has its own hashtag.",
    "Checking if this went platinum or just viral.",
  ],
  "2020s": [
    "The algorithm is typing. I've muted it.",
    "Let me check if this trended on TikTok.",
    "That's a sped-up-version choice.",
    "Very main-character of you.",
    "I'm keeping the hot takes in a separate folder.",
    "No skips. Well, one skip. Maybe.",
    "That pick is giving.",
    "Screenshotting that for the group chat.",
    "Logging off. Logging back on. Okay.",
  ],
};

/** The shared decade of a matchup, e.g. "1980s"; null when songs span decades or years are missing. */
export function matchupDecade(songs: ReadonlyArray<{ year?: number | null }>): string | null {
  const ds = songs.map((x) => (typeof x.year === "number" ? Math.floor(x.year / 10) * 10 : null));
  if (ds.length === 0 || ds.some((d) => d === null) || new Set(ds).size !== 1) return null;
  const key = `${ds[0]}s`;
  return FILLER_DECADE[key] ? key : null;
}

export function fillerLines(wait: number, hunch?: Hunch | null, decade?: string | null): string[] {
  const era = decade ? FILLER_DECADE[decade] : undefined;
  const person = [...at(FILLER_PERSON, wait)];
  const middle = hunch ? [at(FILLER_REACTION[hunch], wait)] : [];
  return [at(FILLER_NEUTRAL, wait), ...middle, ...(era ? [at(era, wait)] : []), ...(era && hunch ? [] : person)];
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
