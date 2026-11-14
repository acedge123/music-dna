// Approved "greatest hits" lines are style references for the writer only.
// They never enter evidence, claims, routing or saved readings.
export type Exemplar = { id: string; text: string; why_it_works?: string | null };

export const EXEMPLAR_LIMIT = 5;

function words(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
}

/** Deterministic rotation so each session sees a different small set. */
export function pickExemplars(all: Exemplar[], seed: string, limit = EXEMPLAR_LIMIT): Exemplar[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const sorted = [...all].sort((a, b) => a.id.localeCompare(b.id));
  if (sorted.length <= limit) return sorted;
  const start = h % sorted.length;
  return Array.from({ length: limit }, (_, i) => sorted[(start + i) % sorted.length]);
}

export function exemplarVoiceBlock(list: Exemplar[]): string | null {
  if (!list.length) return null;
  const lines = list.map((e) => `- "${e.text}"${e.why_it_works ? ` (works because: ${e.why_it_works})` : ""}`);
  return `VOICE REFERENCE — approved past lines that landed. Learn their craft (compression, turn, specificity, swagger). Do NOT reuse their wording, images or structure verbatim; every claim must still come only from this listener's evidence.\n${lines.join("\n")}`;
}

/** True when output copies an exemplar: a shared run of 5+ consecutive words. */
export function copiesExemplar(output: string, list: Exemplar[], run = 5): boolean {
  const out = words(output);
  const grams = new Set<string>();
  for (let i = 0; i + run <= out.length; i++) grams.add(out.slice(i, i + run).join(" "));
  return list.some((e) => {
    const w = words(e.text);
    if (w.length < run) return out.join(" ").includes(w.join(" "));
    for (let i = 0; i + run <= w.length; i++) if (grams.has(w.slice(i, i + run).join(" "))) return true;
    return false;
  });
}
