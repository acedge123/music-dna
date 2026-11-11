import { DIMS } from "./axes";

/** Minimum song-to-song score gap for a declared test to count (matches catalog validator + DB activation check). */
const MIN_TEST_CONTRAST = 20;

const GENERIC_SAYINGS = new Set([
  "which one stays with you?",
  "which one would you keep?",
  "which one?",
  "pick one.",
  "pick one",
  "which do you prefer?",
  "a or b?",
  "this or that?",
]);

type Scored = Record<string, unknown> | null | undefined;

/** Declared tests that are real traits with meaningful contrast between the two songs. */
export function validTests(tests: string[] | null | undefined, a: Scored, b: Scored): string[] {
  if (!a || !b) return [];
  return [...new Set(tests ?? [])].filter((t) => {
    if (!(DIMS as readonly string[]).includes(t)) return false;
    const x = a[t];
    const y = b[t];
    return typeof x === "number" && typeof y === "number" && Math.abs(x - y) >= MIN_TEST_CONTRAST;
  });
}

/** Diagnostic integrity: at least one valid tested trait with meaningful contrast. */
export function hasDiagnosticIntegrity(p: {
  tests?: string[] | null;
  song_a?: Scored;
  song_b?: Scored;
}): boolean {
  return validTests(p.tests, p.song_a, p.song_b).length > 0;
}

/** Editorial quality: a specific saying, not generic, not reused by another live matchup. */
export function sayingProblem(
  saying: string | null | undefined,
  otherLiveSayings: Iterable<string | null | undefined> = [],
): null | "missing" | "generic" | "duplicate" {
  const s = (saying ?? "").trim().toLowerCase();
  if (s.length < 12) return "missing";
  if (GENERIC_SAYINGS.has(s)) return "generic";
  for (const o of otherLiveSayings) if ((o ?? "").trim().toLowerCase() === s) return "duplicate";
  return null;
}
