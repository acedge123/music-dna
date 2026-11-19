// Instagram-ready SVG from frozen, published content only. Fitting changes
// presentation (wrapping/explicit ellipses), never the underlying saved claims.
export type CardInput = {
  headline: string;
  archetype?: string | null;
  traits: string[];
  url: string;
};
export type CardFormat = "story" | "square";
export const CARD_SIZE: Record<CardFormat, [number, number]> = {
  story: [1080, 1920],
  square: [1080, 1080],
};
const WIDTH = 900;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

// Conservative advances fit both browser Georgia and native fallback fonts.
// Keep SVG to basic text: Flutter's renderer does not support textLength fitting.
function advance(text: string): number {
  return Array.from(text).reduce(
    (n, c) =>
      n +
      (/\s/.test(c)
        ? 0.35
        : /[ilI.,'’!:;|]/.test(c)
          ? 0.4
          : /[MW@]/.test(c)
            ? 1.15
            : /[mw]/.test(c)
              ? 0.95
              : /[A-Z]/.test(c)
                ? 0.85
                : /[a-z0-9]/.test(c)
                  ? 0.65
                  : 1.2),
    0,
  );
}
function linesFor(text: string, fits: (s: string) => boolean): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (line && fits(`${line} ${word}`)) {
      line += ` ${word}`;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    for (const c of Array.from(word)) {
      if (line && !fits(line + c)) {
        lines.push(line);
        line = "";
      }
      line += c;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function limitLines(lines: string[], count: number, fits: (s: string) => boolean): string[] {
  if (lines.length <= count) return lines;
  const kept = lines.slice(0, count);
  let last = Array.from(kept[count - 1]);
  while (last.length && !fits(last.join("") + "…")) last = last.slice(0, -1);
  kept[count - 1] = last.join("").trimEnd() + "…";
  return kept;
}
export function wrap(text: string, max: number, maxLines: number): string[] {
  const fits = (s: string) => Array.from(s).length <= max;
  return limitLines(linesFor(text, fits), maxLines, fits);
}

type Block = { lines: string[]; size: number; step: number; height: number };
function block(text: string, size: number, maxLines: number, maxHeight = Infinity): Block {
  // Fit complete text first; only the smallest readable size may be excerpted.
  const minimum = size * 0.7;
  let chosen = size;
  while (chosen > minimum) {
    const lines = linesFor(text, (s) => advance(s) * chosen <= WIDTH);
    if (lines.length <= maxLines && lines.length * chosen * 1.15 <= maxHeight) break;
    chosen = Math.max(minimum, chosen - 2);
  }
  const fits = (s: string) => advance(s) * chosen <= WIDTH;
  const count = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (chosen * 1.15))));
  const lines = limitLines(linesFor(text, fits), count, fits);
  return { lines, size: chosen, step: chosen * 1.15, height: lines.length * chosen * 1.15 };
}
export type CardLine = {
  text: string;
  x: number;
  y: number;
  size: number;
  width: number;
  font: string;
  color: string;
  role: string;
  italic?: boolean;
};
export function layoutShareCard(input: CardInput, format: CardFormat): CardLine[] {
  const story = format === "story";
  const lines: CardLine[] = [];
  const gap = story ? 44 : 28;
  const footer = story ? 1590 : 970;
  const bottom = story ? 1490 : 900;
  const headlineTop = story ? 440 : 160;
  const evidence = input.traits.slice(0, 3).map((t) => block(t, story ? 46 : 32, 2));
  const archetype = input.archetype ? block(input.archetype, story ? 76 : 56, 2) : null;
  const labelSize = story ? 28 : 20;
  const labelGap = story ? 24 : 18;
  const rowGap = story ? 18 : 12;
  const evidenceHeight = evidence.length
    ? labelSize +
      labelGap +
      evidence.reduce((n, b) => n + b.height, 0) +
      rowGap * (evidence.length - 1)
    : 0;
  const archetypeHeight = archetype ? labelSize + labelGap + archetype.height : 0;
  const headlineHeight =
    bottom -
    headlineTop -
    evidenceHeight -
    archetypeHeight -
    (evidence.length ? gap : 0) -
    (archetype ? gap : 0);
  const headline = block(input.headline, story ? 118 : 84, story ? 5 : 4, headlineHeight);
  const add = (
    text: string,
    y: number,
    size: number,
    role: string,
    mono = false,
    color = "#f4efe6",
    italic = false,
  ) =>
    lines.push({
      text,
      x: 90,
      y,
      size,
      role,
      italic,
      font: mono ? "monospace" : "Georgia, serif",
      color,
      width: Math.min(
        WIDTH,
        Math.max(1, (mono ? Array.from(text).length * 0.61 : advance(text)) * size),
      ),
    });
  const addBlock = (b: Block, top: number, role: string, color?: string) => {
    b.lines.forEach((text, i) => add(text, top + b.size + i * b.step, b.size, role, false, color));
  };
  add("MUSICDNA · THE CRITIC'S READ", story ? 360 : 100, story ? 34 : 28, "brand", true, "#e8b04a");
  addBlock(headline, headlineTop, "headline");
  let top = headlineTop + headline.height;
  if (archetype) {
    top += gap;
    add("MUSIC DNA", top + labelSize, labelSize, "label", true, "#c9c2b6");
    top += labelSize + labelGap;
    addBlock(archetype, top, "archetype", "#e8b04a");
    top += archetype.height;
  }
  if (evidence.length) {
    top += gap;
    add("THE EVIDENCE", top + labelSize, labelSize, "label", true, "#c9c2b6");
    top += labelSize + labelGap;
    for (const b of evidence) {
      addBlock(b, top, "evidence");
      top += b.height + rowGap;
    }
  }
  add("What's yours?", footer, story ? 52 : 38, "footer", false, "#f4efe6", true);
  // The canonical URL is short; custom long inputs are visibly excerpted too.
  const urlSize = story ? 38 : 28;
  const url = wrap(input.url, Math.floor(WIDTH / (urlSize * 0.61)), 1)[0] ?? "";
  add(url, footer + (story ? 66 : 48), urlSize, "url", true, "#e8b04a");
  return lines;
}
export function renderShareCard(input: CardInput, format: CardFormat): string {
  const [w, h] = CARD_SIZE[format];
  const text = layoutShareCard(input, format)
    .map(
      (l) =>
        `<text x="${l.x}" y="${l.y}" font-family="${l.font}" font-size="${l.size}"${l.italic ? ' font-style="italic"' : ""} fill="${l.color}">${esc(l.text)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#14110f"/><rect x="0" y="0" width="18" height="${h}" fill="#e8b04a"/>${text}</svg>`;
}
