import { createServerFn } from "@tanstack/react-start";
import { checkpointsEnabled, type InterviewFlow } from "@/musicdna/engine/checkpoints";

/** Which interview flow the server runs. Read per request so flipping the flag needs only a redeploy. */
export const getInterviewFlow = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ flow: InterviewFlow }> => ({
    flow: checkpointsEnabled(process.env.MUSICDNA_CRITIC_CHECKPOINTS) ? "checkpoints" : "per_pick",
  }),
);
