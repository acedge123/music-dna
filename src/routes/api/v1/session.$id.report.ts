// GET /api/v1/session/:id/report?version=N — read-only saved report envelope.
// Zero model calls; see src/musicdna/adapters/report-envelope.ts.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { loadReportEnvelope } from "@/musicdna/adapters/report-envelope";

const UUID = z.string().uuid();
const VERSION = z.coerce.number().int().min(1).max(10000);

export const Route = createFileRoute("/api/v1/session/$id/report")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          const raw = new URL(request.url).searchParams.get("version");
          const v = raw === null ? null : VERSION.safeParse(raw);
          if (v && !v.success) return errorResponse("INVALID_INPUT", "Invalid result version", 400);
          const { supabase } = await verifyBearer(request);
          const res = await loadReportEnvelope(supabase, sid.data, v ? v.data : null);
          if (res.kind === "ok") return jsonResponse(res.body);
          if (res.kind === "error") return errorResponse("UNAVAILABLE", res.message, 503);
          if (res.kind === "no_result") return errorResponse("NO_RESULT", res.message, 404);
          if (res.kind === "version_not_found") return errorResponse("VERSION_NOT_FOUND", res.message, 404);
          return errorResponse("NOT_FOUND", res.message, 404);
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          return errorResponse("INTERNAL", e instanceof Error ? e.message : String(e), 500);
        }
      },
    },
  },
});
