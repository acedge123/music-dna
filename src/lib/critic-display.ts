// Presentation only: never creates claims or mutates the saved reading.
function reactionDisplayMessage(effect: string): string {
  switch (effect) {
    case "harder_pairing":
      return "Fine. Try these.";
    case "retest_pairing":
      return "Fair. Let's try another.";
    case "no_alternative":
      return "No other matchup available right now. Your call on these two stands.";
    default:
      return "Heard you. Let's keep going.";
  }
}

export function criticDisplayLine(text: string): string {
  return text.replace(/\s*\(\d+ supporting(?: choices)?, \d+ against\)/g, "").trim();
}

export function readingLead(text: string): string {
  const paragraph = text.trim().split(/\n\s*\n/)[0] ?? "";
  const first = paragraph.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? paragraph;
  return criticDisplayLine(first);
}
