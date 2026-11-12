export const DIMS = [
  "movement",
  "atmosphere",
  "immersion",
  "scale",
  "community",
  "perspective",
  "confidence",
  "tension",
  "texture",
  "transformation",
] as const;

/** Pole labels match public.axes verbatim so Critic, DB and reveal copy share one vocabulary. */
export const DIM_LABEL: Record<string, { hi: string; lo: string }> = {
  movement: { hi: "forward motion", lo: "stillness" },
  atmosphere: { hi: "immersive mood", lo: "statement" },
  immersion: { hi: "slow reveal", lo: "immediacy" },
  scale: { hi: "vast", lo: "intimate" },
  community: { hi: "communal", lo: "solitary" },
  perspective: { hi: "witness", lo: "feeling" },
  confidence: { hi: "command", lo: "vulnerability" },
  tension: { hi: "pressure", lo: "release" },
  texture: { hi: "refinement", lo: "rawness" },
  transformation: { hi: "takes you somewhere", lo: "holds its shape" },
};

/** Both poles, with the score on the side it leans toward: texture 85 → "Refinement 85 vs Rawness". */
export function poleScoreLabel(axis: string, score: number): string {
  const l = DIM_LABEL[axis] ?? { hi: axis, lo: axis };
  const hi = score >= 50;
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const [lead, other] = hi ? [l.hi, l.lo] : [l.lo, l.hi];
  return `${cap(lead)} ${Math.round(hi ? score : 100 - score)} vs ${cap(other)}`;
}
