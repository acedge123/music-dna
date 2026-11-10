import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadReadingFeedback } from "@/musicdna/adapters/reading-feedback";
export const getReadingFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({ sessionId: z.string().uuid(), resultVersion: z.number().int().positive() })
      .parse(value),
  )
  .handler(({ data, context }) => loadReadingFeedback(context.supabase, context.userId, data));
