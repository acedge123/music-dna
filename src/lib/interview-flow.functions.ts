import { createServerFn } from "@tanstack/react-start";
import type { InterviewFlow } from "@/musicdna/engine/checkpoints";

/** Which flow an interview runs: frozen per session at start; no session → the current flag. No user data. */
export const getInterviewFlow = createServerFn({ method: "GET" })
  .inputValidator((d: { sessionId?: string | null } | undefined) => ({
    sessionId: typeof d?.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(d.sessionId) ? d.sessionId : null,
  }))
  .handler(async ({ data }): Promise<{ flow: InterviewFlow }> => {
    const { sessionFlowImpl } = await import("@/lib/musicdna.functions");
    return { flow: await sessionFlowImpl(data.sessionId) };
  });
