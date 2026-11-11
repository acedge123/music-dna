// GET /api/v1/sessions — list the caller's sessions (history).
//
// Returns most-recent-first summaries so the mobile app can render a
// history screen and pick up an in-progress session. RLS scopes rows to
// the caller; no user_id filter needed on the query.

import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { loadReadingHistory, parseReadingCursor } from "@/musicdna/adapters/reading-history";

export const Route = createFileRoute("/api/v1/sessions")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request }) => {
        try {
          const { supabase, userId } = await verifyBearer(request);
          const url = new URL(request.url);
          const rawLimit = Number(url.searchParams.get("limit") ?? "20");
          const limit = Math.max(
            1,
            Math.min(100, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20),
          );

          let cursor: ReturnType<typeof parseReadingCursor>;
          try {
            cursor = parseReadingCursor(url.searchParams.get("cursor"));
          } catch {
            return errorResponse("INVALID_INPUT", "Invalid reading-history cursor", 400);
          }
          return jsonResponse(await loadReadingHistory(supabase, userId, limit, cursor));
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
