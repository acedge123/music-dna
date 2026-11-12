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
  tension: { hi: "danger", lo: "release" },
  texture: { hi: "refinement", lo: "rawness" },
  transformation: { hi: "takes you somewhere", lo: "holds its shape" },
};
