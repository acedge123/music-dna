import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rpc } from "./access";
import { QuipObservation } from "./quip-observations";
import { telemetryAllowed, recordObservation } from "./quip-telemetry";
export const qaQuipTelemetryAllowed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ session_id: z.string().uuid() }).strict().parse(raw))
  .handler(async ({ data, context }) => ({
    allowed: await telemetryAllowed(context.supabase as SupabaseClient, data.session_id),
  }));
export const recordQaQuip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => QuipObservation.parse(raw))
  .handler(async ({ data, context }) =>
    recordObservation(context.supabase as SupabaseClient, data),
  );
