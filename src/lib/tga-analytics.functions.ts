import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const INGEST_URL = "https://tmdhoerieupdpnrohjtf.supabase.co/functions/v1/analytics-ingest";

const Str = z.string().max(2000).optional();
const Item = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("page_view"),
    url: z.string().min(1).max(2000),
    session_id: z.string().min(1).max(100),
    referrer: Str,
    user_agent: Str,
    platform: z.literal("web"),
    utm_source: Str,
    utm_medium: Str,
    utm_campaign: Str,
    utm_content: Str,
    utm_term: Str,
    event_data: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("event"),
    event_name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
    event_type: z.enum(["conversion", "interaction", "navigation", "form", "ui_action"]),
    session_id: z.string().min(1).max(100),
    url: z.string().max(2000),
    platform: z.literal("web"),
    event_data: z.record(z.string(), z.unknown()).optional(),
  }),
]);

/**
 * Forwards web analytics to the shared TGA Analytics ingest. The tenant key stays server-side
 * (ANALYTICS_API_KEY). Best effort: never throws to the caller.
 */
export const sendTgaAnalytics = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ items: z.array(Item).min(1).max(50) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.ANALYTICS_API_KEY;
    if (!key) return { sent: 0, skipped: "no_key" as const };
    try {
      const res = await fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({ type: "batch", items: data.items }),
      });
      if (!res.ok) {
        console.warn("[tga-analytics] ingest", res.status, (await res.text()).slice(0, 300));
        return { sent: 0 };
      }
      return { sent: data.items.length };
    } catch (e) {
      console.warn("[tga-analytics] ingest failed", e instanceof Error ? e.message : e);
      return { sent: 0 };
    }
  });
