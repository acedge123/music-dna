import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { setSharePublication } from "@/musicdna/adapters/share-publication";

export const setShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        publish: z.boolean(),
        resultVersion: z.number().int().min(1).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    setSharePublication(
      context.supabase,
      context.userId,
      data.sessionId,
      data.publish,
      data.resultVersion,
    ),
  );
