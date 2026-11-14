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
  // Story: keep text out of the top/bottom ~260px Instagram covers with its own UI.
  const size = story ? 118 : 84;
  const lines = wrap(input.headline, story ? 14 : 18, story ? 5 : 4);
  let y = story ? 420 : 250;
  const parts: string[] = [];
  parts.push(`<text x="90" y="${y}" font-family="monospace" font-size="${story ? 34 : 28}" letter-spacing="8" fill="#e8b04a">MUSICDNA · THE CRITIC'S READ</text>`);
  y += story ? 190 : 140;
  for (const l of lines) { parts.push(`<text x="90" y="${y}" font-family="Georgia, serif" font-size="${size}" fill="#f4efe6">${esc(l)}</text>`); y += size * 1.12; }
  y += story ? 90 : 50;
  if (input.archetype) {
    parts.push(`<rect x="90" y="${y - 6}" width="${w - 180}" height="2" fill="#e8b04a"/>`);
    y += story ? 80 : 60;
    parts.push(`<text x="90" y="${y}" font-family="monospace" font-size="${story ? 30 : 24}" letter-spacing="6" fill="#c9c2b6">MUSIC DNA</text>`);
    y += story ? 90 : 66;
    parts.push(`<text x="90" y="${y}" font-family="Georgia, serif" font-size="${story ? 76 : 56}" fill="#e8b04a">${esc(input.archetype)}</text>`);
    y += story ? 60 : 30;
  }
  if (input.traits.length) {
    y += story ? 70 : 50;
    parts.push(`<text x="90" y="${y}" font-family="monospace" font-size="${story ? 30 : 24}" letter-spacing="6" fill="#c9c2b6">THE EVIDENCE</text>`);
    for (const t of input.traits.slice(0, 3)) { y += story ? 72 : 52; parts.push(`<text x="90" y="${y}" font-family="Georgia, serif" font-size="${story ? 46 : 34}" fill="#f4efe6">${esc(t)}</text>`); }
  }
  const foot = story ? h - 330 : h - 110;
  parts.push(`<text x="90" y="${foot}" font-family="Georgia, serif" font-style="italic" font-size="${story ? 52 : 38}" fill="#f4efe6">What's yours?</text>`);
  parts.push(`<text x="90" y="${foot + (story ? 66 : 48)}" font-family="monospace" font-size="${story ? 38 : 28}" letter-spacing="3" fill="#e8b04a">${esc(input.url)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#14110f"/><rect x="0" y="0" width="18" height="${h}" fill="#e8b04a"/>${parts.join("")}</svg>`;
}
