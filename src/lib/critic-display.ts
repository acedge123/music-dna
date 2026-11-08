// Presentation only: never creates claims or mutates the saved reading.
export function criticDisplayLine(text: string): string {
  return text.replace(/\s*\(\d+ supporting(?: choices)?, \d+ against\)/g, "").trim();
}

export function readingLead(text: string): string {
  const paragraph = text.trim().split(/\n\s*\n/)[0] ?? "";
  const first = paragraph.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? paragraph;
  return criticDisplayLine(first);
}
