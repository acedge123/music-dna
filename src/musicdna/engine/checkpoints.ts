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

/** Capability header mobile builds send to opt in to checkpoints on session creation. */
export const INTERVIEW_FLOW_HEADER = "x-musicdna-interview-flow";
export const CHECKPOINTS_CAPABILITY = "checkpoints-v1";

/**
 * Flow assigned to a new interview. Web may use checkpoints when the flag is on; mobile only
 * when it advertises `checkpoints-v1`, so shipped builds without the capability stay per_pick.
 */
export function assignInterviewFlow(input: {
  flag: string | undefined;
  client: "web" | "mobile";
  capability?: string | null;
}): InterviewFlow {
  if (!checkpointsEnabled(input.flag)) return "per_pick";
  if (input.client === "web") return "checkpoints";
  const caps = (input.capability ?? "").split(",").map((c) => c.trim().toLowerCase());
  return caps.includes(CHECKPOINTS_CAPABILITY) ? "checkpoints" : "per_pick";
}

/** Saved flow from the start event; interviews started before flows were saved ran per_pick. */
export function savedFlowFromProps(props: unknown): InterviewFlow {
  const f = (props as { flow?: unknown } | null)?.flow;
  return f === "checkpoints" ? "checkpoints" : "per_pick";
}
