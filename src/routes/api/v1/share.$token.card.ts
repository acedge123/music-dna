import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPublicSession } from "@/lib/share.functions";
import { renderShareCard } from "@/musicdna/engine/share-card";
import { cardInputFromPublished } from "@/musicdna/adapters/share-card-input";
import { errorResponse, preflightResponse } from "./_cors";

// Instagram-ready card for a PUBLISHED reading only (same consent gate as /share/:token).
export const Route = createFileRoute("/api/v1/share/$token/card")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ params, request }) => {
        const token = z.string().min(8).max(64).safeParse(params.token);
        const format = new URL(request.url).searchParams.get("format") === "square" ? "square" : "story";
        if (!token.success) return errorResponse("INVALID_INPUT", "Invalid token", 400);
        let loaded;
        try {
          loaded = await getPublicSession({ data: { token: token.data } });
        } catch {
          return errorResponse("NOT_FOUND", "Session not found", 404);
        }
        const svg = renderShareCard(cardInputFromPublished(loaded as any, "musicdna.fm"), format);
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
