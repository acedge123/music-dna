import type { SelectionMode } from "./pairing";
import type { AxisLabels } from "./claim-language";

export function reactionSelectionMode(
  mode: SelectionMode,
  steer?: "harder" | "not_quite",
): SelectionMode {
  return steer === "harder" ? "diagnostic_first" : mode;
}

export function choiceObservation(
  axis: string | null | undefined,
  delta: number,
  labels: AxisLabels,
  round: number,
) {
  const poles = axis ? labels[axis] : null;
  if (!poles || !Number.isFinite(delta) || delta === 0)
    return "One pick. I'm listening, not declaring a pattern.";
  const preferred = delta > 0 ? poles.hi : poles.lo;
  const other = delta > 0 ? poles.lo : poles.hi;
  const lines = [
    `This time, ${preferred} beat ${other}. One pick—not your whole story.`,
    `${preferred} gets this round. The reason is still yours to tell.`,
    `A point for ${preferred}, not a verdict on you.`,
    `${preferred} over ${other}, here. That's a choice, not a tattoo.`,
    `This one went to ${preferred}. I'm keeping the receipts, not writing your biography.`,
    `${preferred} wins this matchup. The motive doesn't come printed on the record.`,
  ];
  return lines[Math.max(0, round - 1) % lines.length];
}

export function reactionAcknowledgement(
  kind: "thats_me" | "harder" | "not_quite",
  replaced: boolean,
  completed: boolean,
  priorThesis = "",
) {
  if (completed)
    return kind === "thats_me"
      ? "Heard you. The reading stays; the argument can keep going."
      : "The picks are finished. Bring that objection to the reading—I'm not done listening.";
  if (kind === "thats_me") return "That landed. Still not letting one good line close the case.";
  if (!replaced)
    return "No other matchup available right now. I'm not calling that a tougher test.";
  const earlier = priorThesis
    .trim()
    .split(/\n|(?<=[.!?])\s/)[0]
    ?.slice(0, 160);
  if (kind === "not_quite")
    return earlier
      ? `You pushed back on “${earlier}”. Fair—I'll keep the claim on trial. Pick again.`
      : "Fair objection. The read isn't gospel. Pick again.";
  return "Alright, no victory lap. Another matchup—your call.";
}
