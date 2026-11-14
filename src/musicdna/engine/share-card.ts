// Instagram-ready share card rendered as SVG from frozen, published content only.
export type CardInput = { headline: string; archetype?: string | null; traits: string[]; url: string };
export type CardFormat = "story" | "square";
export const CARD_SIZE: Record<CardFormat, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function wrap(text: string, max: number, maxLines: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if ((line + " " + w).trim().length > max) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, "") + "…"; }
  return out;
}

export function renderShareCard(input: CardInput, format: CardFormat): string {
  const [w, h] = CARD_SIZE[format];
  const story = format === "story";
  const lines = wrap(input.headline, story ? 20 : 24, story ? 7 : 5);
  const size = story ? 84 : 68;
  const top = story ? 560 : 300;
  const head = lines.map((l, i) => `<text x="90" y="${top + i * size * 1.15}" font-family="Georgia, serif" font-size="${size}" fill="#f4efe6">${esc(l)}</text>`).join("");
  const after = top + lines.length * size * 1.15 + 60;
  const arch = input.archetype ? `<text x="90" y="${after + 40}" font-family="monospace" font-size="34" letter-spacing="6" fill="#e8b04a">${esc(input.archetype.toUpperCase())}</text>` : "";
  const traits = input.traits.slice(0, 3).map((t, i) => `<text x="90" y="${after + 120 + i * 56}" font-family="Georgia, serif" font-size="40" fill="#c9c2b6">— ${esc(t)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#14110f"/><rect x="60" y="60" width="${w - 120}" height="${h - 120}" fill="none" stroke="#e8b04a" stroke-width="3"/><text x="90" y="170" font-family="monospace" font-size="34" letter-spacing="8" fill="#e8b04a">MUSICDNA · THE CRITIC'S READ</text>${head}${arch}${traits}<text x="90" y="${h - 110}" font-family="monospace" font-size="32" fill="#c9c2b6">${esc(input.url)}</text></svg>`;
}
