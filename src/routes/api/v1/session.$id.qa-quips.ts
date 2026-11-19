import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyBearer, HttpError } from "./_auth";
import { jsonResponse, errorResponse, preflightResponse } from "./_cors";
import { QuipObservation } from "@/lib/mcp/quip-observations";
import { telemetryAllowed, recordObservation } from "@/lib/mcp/quip-telemetry";
import { McpError } from "@/lib/mcp/access";
const body = QuipObservation.omit({ session_id: true });
export const Route = createFileRoute("/api/v1/session/$id/qa-quips")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request, params }) => {
        try {
          const sid = z.string().uuid().parse(params.id),
            { supabase } = await verifyBearer(request);
          return jsonResponse({ allowed: await telemetryAllowed(supabase, sid) });
        } catch (e) {
          return failure(e);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const session_id = z.string().uuid().parse(params.id),
            { supabase } = await verifyBearer(request);
          const data = body.parse(await limitedJson(request));
          return jsonResponse(await recordObservation(supabase, { ...data, session_id }));
        } catch (e) {
          return failure(e);
        }
      },
    },
  },
});
function failure(e: unknown) {
  if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
  if (e instanceof z.ZodError)
    return errorResponse("INVALID_INPUT", "Invalid QA observation.", 400);
  if (e instanceof McpError)
    return errorResponse(
      e.code === "FORBIDDEN"
        ? "FORBIDDEN"
        : e.code === "IDEMPOTENCY_CONFLICT"
          ? "CONFLICT"
          : e.code === "INVALID_INPUT"
            ? "INVALID_INPUT"
            : "UNAVAILABLE",
      "QA observation was not confirmed.",
      e.code === "FORBIDDEN"
        ? 403
        : e.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : e.code === "INVALID_INPUT"
            ? 400
            : 503,
    );
  return errorResponse("UNAVAILABLE", "QA telemetry unavailable.", 503);
}

async function limitedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("INVALID_INPUT", 400, "Missing QA observation.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      void reader.cancel();
      throw new HttpError("INVALID_INPUT", 413, "QA observation too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError("INVALID_INPUT", 400, "Invalid QA observation.");
  }
}
