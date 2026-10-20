import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { loadPublishedRead } from "@/musicdna/adapters/published-read";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
export const Route = createFileRoute("/api/v1/share/$token")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ params }) => {
        const token = z.string().min(8).max(64).safeParse(params.token);
        if (!token.success) return errorResponse("INVALID_INPUT", "Invalid token", 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const read = await loadPublishedRead(supabaseAdmin, token.data);
          return read ? jsonResponse(read) : errorResponse("NOT_FOUND", "Session not found", 404);
        } catch {
          return errorResponse("UPSTREAM", "Could not load the published reading", 502);
        }
      },
    },
  },
});
