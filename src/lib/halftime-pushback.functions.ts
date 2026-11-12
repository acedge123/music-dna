import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordHalftimePushbackImpl } from "@/musicdna/adapters/halftime-pushback";

// Halftime pushback is self-report; see adapters/halftime-pushback.ts.
export const halftimePushback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        message: z.string().trim().min(1).max(500),
        mutationId: z.string().min(8).max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await recordHalftimePushbackImpl(context.supabase, supabaseAdmin, context.userId, {
      sessionId: data.sessionId,
      text: data.message,
      mutationId: data.mutationId ?? crypto.randomUUID(),
    });
    return { reply: r.reply };
  });
