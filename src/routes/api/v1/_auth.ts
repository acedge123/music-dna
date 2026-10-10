// Bearer-token verification for /api/v1/* server routes.
//
// Server routes can't use the createServerFn `functionMiddleware` chain, so
// we mint an authenticated user-scoped Supabase client here — same shape the
// requireSupabaseAuth middleware produces. RLS applies as the caller.
//
// Result: routes get the same { supabase, userId } tuple the *Impl helpers
// in src/lib/musicdna.functions.ts already accept, so the engine layer sees
// one call signature whether the caller is web (server fn) or Flutter (REST).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  FALLBACK_SUPABASE_PUBLISHABLE_KEY,
  FALLBACK_SUPABASE_URL,
} from "@/integrations/supabase/config";

export type AuthedContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  email: string | null;
};

export class HttpError extends Error {
  constructor(
    public code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "UPSTREAM"
      | "INTERNAL",
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function verifyBearer(request: Request): Promise<AuthedContext> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError("UNAUTHORIZED", 401, "Missing bearer token");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new HttpError("UNAUTHORIZED", 401, "Empty bearer token");

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HttpError("INTERNAL", 500, "Supabase env not configured");
  }

  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new HttpError("UNAUTHORIZED", 401, "Invalid token");
  }
  return { supabase, userId: data.user.id, email: data.user.email ?? null };
}
