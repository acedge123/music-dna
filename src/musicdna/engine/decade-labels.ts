// Plain-language pole names (mirrors the axes table: low → high).
const POLES: Record<string, [string, string]> = {
  movement: ["stillness", "forward motion"],
  atmosphere: ["statement", "immersive mood"],
  immersion: ["immediacy", "slow reveal"],
  scale: ["intimacy", "vastness"],
  community: ["solitude", "the singalong"],
  perspective: ["feeling", "witness"],
  confidence: ["vulnerability", "command"],
  tension: ["release", "pressure"],
  texture: ["rawness", "refinement"],
  transformation: ["holding its shape", "going somewhere"],
};

export function AXES_LABEL(axis: string, dir: "hi" | "lo" | null): string {
  const p = POLES[axis];
  if (!p) return axis;
  if (dir === "hi") return `${p[1]} over ${p[0]}`;
  if (dir === "lo") return `${p[0]} over ${p[1]}`;
  return `${p[0]} vs. ${p[1]}`;
}
