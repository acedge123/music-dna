export type OpeningSongContext = { title: string; artist: string; year: number | null };

export function parseOpeningSong(raw: string) {
  const text = raw.trim();
  const separator = /\s*[—–]\s*|\s+-\s+/.exec(text);
  return separator
    ? {
        title: text.slice(0, separator.index).trim(),
        artist: text.slice(separator.index + separator[0].length).trim() || null,
      }
    : { title: text, artist: null };
}

export function matchOpeningSong<T extends OpeningSongContext>(
  rows: T[],
  input: ReturnType<typeof parseOpeningSong>,
): T | null {
  const key = (s: string) => s.normalize("NFKC").trim().toLowerCase();
  const matches = rows.filter(
    (r) =>
      key(r.title) === key(input.title) && (!input.artist || key(r.artist) === key(input.artist)),
  );
  // Never resolve an ambiguous title or a mistyped artist to the first row.
  return matches.length === 1 ? matches[0] : null;
}

export function openingAcknowledgement(
  raw: string,
  index: number,
  song: OpeningSongContext | null,
) {
  return song
    ? `Added ${song.title} by ${song.artist} as your #${index + 1}.`
    : `Added “${raw.trim()}” as your #${index + 1}.`;
}
