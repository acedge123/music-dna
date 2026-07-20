// MusicDNA Engine — critic voice helpers (pure).
//
// The Analyst produces evidence; the Critic wraps it in voice. These are the
// deterministic pieces of that wrapping — hedge ladder, hesitation copy,
// hash-stable variant picking — extracted so they can be regression-tested
// and reused by any client (web, Flutter, admin tools) that renders a
// running-thesis beat.

export const HEDGES = [
  "Interesting.",              // round 1
  "I think I see a pattern.",  // round 2
  "Early read:",               // round 3
  "Starting to believe:",      // round 4
  "Fairly confident:",         // round 5
  "I'm convinced:",            // round 6+
] as const;

export const HESITATION_BUCKETS: ReadonlyArray<{ max: number; lines: readonly string[] }> = [
  { max: 500,      lines: [
    "Instinct.", "Reflex.", "No thought required.", "That was pre-loaded.", "Zero hesitation.",
    "Muscle memory.", "Already answered before I asked.", "Prewired.", "You didn't even read it.",
    "That was a twitch, not a choice.", "Cocked and loaded.", "Answered in the eyebrows.",
  ] },
  { max: 1200,     lines: [
    "Immediate.", "Instant call.", "That wasn't a decision.", "Snap verdict.", "You didn't blink.",
    "Faster than the page loaded.", "Half a heartbeat.", "No wind-up.", "Straight through.",
    "Confident tap.", "That came out of your fingers, not your head.",
  ] },
  { max: 2500,     lines: [
    "No debate.", "Quick call.", "Clean pick.", "You knew.", "That landed fast.",
    "Barely a pause.", "Easy.", "Wasn't a coin flip.", "Short work.", "You were ready for that one.",
    "In and out.", "You already had a favorite.",
  ] },
  { max: 5000,     lines: [
    "Had to think.", "You took a second there.", "Interesting pause.", "That wasn't automatic.",
    "You weighed it.", "You did the math.", "Not instinct — deliberation.", "A real beat.",
    "You checked yourself.", "You listened before you answered.", "Not a reflex answer.",
    "You gave it a look.",
  ] },
  { max: 8000,     lines: [
    "That one wasn't obvious.", "You weighed both.", "That was close.", "You almost switched.",
    "No instant answer there.", "You gave that some respect.", "You sized it up.",
    "That took real weighing.", "You did some negotiating.", "You looked at both of them properly.",
    "You had a version where the other one won.", "You cared about that one.",
  ] },
  { max: Infinity, lines: [
    "You really wrestled with that one.", "You stared this one down.", "That was a battle.",
    "You took the long look.", "That one earned its answer.", "You lived inside that decision.",
    "You didn't want to pick.", "You made me wait for that.", "That one hurt a little.",
    "Neither one felt like a loss you wanted to take.", "You almost refused to answer.",
    "That was a slow burn of a choice.",
  ] },
];

// Words that leak internal vocabulary into user copy. Dev-only guard —
// callers can scan reveal strings for any of these tokens.
export const FORBIDDEN_TOKENS = [
  "becoming",
  "witness",
  "posture",
  "axis",
  "dimension",
] as const;

export function pickByHash<T>(arr: readonly T[] | undefined, seed: number): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  const i = ((seed % arr.length) + arr.length) % arr.length;
  return arr[i];
}

export function hesitationFor(ms: number | null, seed: number): string {
  if (ms == null) return "";
  const bucket = HESITATION_BUCKETS.find((b) => ms < b.max);
  return pickByHash(bucket?.lines, seed) ?? "";
}

export function hedgeForRound(round: number): string {
  return HEDGES[Math.min(Math.max(round, 1) - 1, HEDGES.length - 1)];
}

export function dimSeed(dim: string): number {
  let s = 0;
  for (let i = 0; i < dim.length; i++) s += dim.charCodeAt(i);
  return s;
}
