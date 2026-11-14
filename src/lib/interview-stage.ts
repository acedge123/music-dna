export type InterviewStage = "pairing" | "wait" | "checkpoint" | "final" | "opening";

/** Presentation only: server completion and saved flow remain authoritative. */
export function interviewStage(input: {
  phase: string;
  busy: boolean;
  pairing: boolean;
  pendingPick: boolean;
  pendingSkip: boolean;
  checkpoint: boolean;
  finalWriting: boolean;
}): InterviewStage {
  if (input.finalWriting) return "wait";
  if (input.phase === "done") return "final";
  if (input.phase !== "playing") return "opening";
  if (input.busy && (input.pendingPick || input.pendingSkip || !input.pairing)) return "wait";
  if (input.checkpoint) return "checkpoint";
  return "pairing";
}