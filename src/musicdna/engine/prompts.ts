// Next-question prompts (READ04 / CAT04). Derived from the pairing that was
// actually selected, so the critic never promises a test the next matchup
// doesn't run. Neutral by design: names the question, never the expected
// answer, the pole being tested, or curator notes.

const AXIS_QUESTION: Record<string, string> = {
  movement: "This one's about whether a song has to move you forward.",
  atmosphere: "This one's about mood versus message.",
  immersion: "This one's about how long you'll wait for a song to open up.",
  scale: "This one's about how big a song should feel.",
  community: "This one's about singing alone or singing with a crowd.",
  perspective: "This one's about feeling it versus watching it.",
  confidence: "This one's about swagger versus exposure.",
  tension: "This one's about whether you want the edge or the exhale.",
  texture: "This one's about rough edges versus polish.",
  transformation: "This one's about songs that stay put versus songs that travel.",
};

export function nextPromptFor(
  tests: readonly string[] | null | undefined,
  leadAxis?: string | null,
): string {
  const t = (tests ?? []).filter((a) => AXIS_QUESTION[a]);
  if (leadAxis && t.includes(leadAxis))
    return "Same question, different songs. Let's see if it holds.";
  if (t.length === 0) return "Next one. Go with your gut.";
  return AXIS_QUESTION[t[0]];
}
