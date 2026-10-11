// POST /api/v1/session/:id/share   { "publish": true | false }
// Explicit publish / revoke for a completed reading (D03). Revoke rotates the
// token, so previously copied links stop working.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { setSharePublication } from "@/musicdna/adapters/share-publication";

const UUID = z.string().uuid();
const Body = z.object({ publish: z.boolean() });

export const Route = createFileRoute("/api/v1/session/$id/share")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            return errorResponse("INVALID_INPUT", "Invalid JSON body", 400);
          }
          const body = Body.safeParse(raw);
          if (!body.success) return errorResponse("INVALID_INPUT", body.error.message, 400);
          const { supabase, userId } = await verifyBearer(request);
          try {
            const out = await setSharePublication(supabase, userId, sid.data, body.data.publish);
            // Canonical URL + the result version being published, so mobile
            // clients never have to guess either (SHR01, TGA-311).
            const origin = new URL(request.url).origin;
            const { data: latest } = await supabase
              .from("session_results")
              .select("version")
              .eq("session_id", sid.data)
              .order("version", { ascending: false })
              .limit(1)
              .maybeSingle();
            return jsonResponse({
              contract: 1,
              ...out,
              share_url: out.share_token ? `${origin}/s/${out.share_token}` : null,
              result_version: latest?.version ?? null,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Share update failed";
            return errorResponse(
              msg === "Session not found" ? "NOT_FOUND" : "INVALID_INPUT",
              msg,
              msg === "Session not found" ? 404 : 400,
            );
          }
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          return errorResponse("INTERNAL", e instanceof Error ? e.message : "Unknown error", 500);
        }
      },
    },
  },
});
