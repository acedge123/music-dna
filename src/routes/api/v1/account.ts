// DELETE /api/v1/account — delete the caller's account and all their data.
//
// Required by Apple App Store guideline 5.1.1(v) for any app with account
// sign-up. Web and mobile share this endpoint.
//
// Flow: verify bearer → load admin client server-side → call
// supabase.auth.admin.deleteUser(userId). Every user-scoped table
// (profiles, sessions, choices, user_roles, …) is FK'd to auth.users with
// ON DELETE CASCADE, so a single deleteUser removes everything.

import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";

export const Route = createFileRoute("/api/v1/account")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      DELETE: async ({ request }) => {
        try {
          const { userId } = await verifyBearer(request);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (error) {
            return errorResponse("INTERNAL", error.message, 500);
          }
          return jsonResponse({ ok: true, deleted_user_id: userId });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
