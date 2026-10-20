import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadSavedReading } from "@/musicdna/adapters/saved-reading";

export const getSavedReading = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        resultVersion: z.number().int().positive().optional(),
      })
      .parse(value),
  )
  .handler(({ data, context }) => loadSavedReading(context.supabase, context.userId, data));
