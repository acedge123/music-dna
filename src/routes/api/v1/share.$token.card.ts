import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPublicSession } from "@/lib/share.functions";
import { renderShareCard } from "@/musicdna/engine/share-card";
import { cardInputFromPublished } from "@/musicdna/adapters/share-card-input";
import { errorResponse, preflightResponse } from "./_cors";

// Never retain a published image at the browser or any CDN after revocation.
const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};
function uncached(response: Response): Response {
  for (const [key, value] of Object.entries(NO_STORE)) response.headers.set(key, value);
  return response;
}

// Instagram-ready card for a PUBLISHED reading only (same consent gate as /share/:token).
export const Route = createFileRoute("/api/v1/share/$token/card")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ params, request }) => {
        const token = z.string().min(8).max(64).safeParse(params.token);
        const format =
          new URL(request.url).searchParams.get("format") === "square" ? "square" : "story";
        if (!token.success) return uncached(errorResponse("INVALID_INPUT", "Invalid token", 400));
        let loaded;
        try {
          loaded = await getPublicSession({ data: { token: token.data } });
        } catch {
          return uncached(errorResponse("NOT_FOUND", "Session not found", 404));
        }
        const svg = renderShareCard(cardInputFromPublished(loaded, "musicdna.fm"), format);
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            ...NO_STORE,
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
