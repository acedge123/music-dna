import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assignInterviewFlow, type InterviewFlow } from "@/musicdna/engine/checkpoints";

/**
 * Web flow lookup. No session → the flow a new web interview would get. With a session →
 * owner-only saved flow; failures throw (never substitute the current flag).
 */
export const getInterviewFlow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId?: string | null } | undefined) => ({
    sessionId:
      typeof d?.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(d.sessionId) ? d.sessionId : null,
  }))
  .handler(async ({ data, context }): Promise<{ flow: InterviewFlow }> => {
    if (!data.sessionId)
      return {
        flow: assignInterviewFlow({ flag: process.env.MUSICDNA_CRITIC_CHECKPOINTS, client: "web" }),
      };
    const { sessionFlowImpl } = await import("@/lib/musicdna.functions");
    return { flow: await sessionFlowImpl(context.supabase, context.userId, data.sessionId) };
  });
