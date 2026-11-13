// Critic checkpoints (behind MUSICDNA_CRITIC_CHECKPOINTS=1). Pure rules shared by
// web, REST and the pre-drafting gate. Counts are answered choices; skips never count.

export type InterviewFlow = "per_pick" | "checkpoints";

export function checkpointsEnabled(env: string | undefined): boolean {
  return env === "1";
}

/** 1 after the second answered choice, 2 after the fourth, otherwise null. */
export function checkpointIndex(answered: number): 1 | 2 | null {
  if (answered === 2) return 1;
  if (answered === 4) return 2;
  return null;
}

/** Answered counts that get a written Critic read (checkpoints only; 6 is the final reading). */
export function writesCriticRead(flow: InterviewFlow, answered: number): boolean {
  if (flow === "per_pick") return answered > 0;
  return checkpointIndex(answered) !== null;
}

/** Pre-drafting is only worth it for the pick that lands on a checkpoint or the final pick. */
export function shouldPrepareForPick(flow: InterviewFlow, nextAnswered: number): boolean {
  if (flow === "per_pick") return true;
  return checkpointIndex(nextAnswered) !== null || nextAnswered >= 6;
}

/** Buttons offered on a checkpoint screen. */
export function checkpointActions(index: 1 | 2, nextAvailable: boolean): Array<"continue" | "finish"> {
  if (index === 1) return nextAvailable ? ["continue"] : ["finish"];
  return nextAvailable ? ["finish", "continue"] : ["finish"];
}
