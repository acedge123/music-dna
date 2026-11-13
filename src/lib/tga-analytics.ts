// Browser-side tracker for the shared TGA Analytics backend. Queues items and flushes them
// through a server function so the tenant key never ships to the browser.
// Privacy: only page paths, coarse interview milestones and counts — no song titles, free text,
// emails or account IDs.
import { sendTgaAnalytics } from "./tga-analytics.functions";

type Item = Record<string, unknown> & { type: "page_view" | "event" };
const queue: Item[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function stored(storage: Storage, key: string): string {
  try {
    let id = storage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}
const sessionId = () => stored(sessionStorage, "tga_session_id");
const visitorId = () => stored(localStorage, "tga_visitor_id");

function utms() {
  const p = new URLSearchParams(location.search);
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = p.get(k);
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}

/** Page URL without query strings or IDs in the path that could identify a reading. */
function cleanUrl(): string {
  const path = location.pathname.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ":id",
  ).replace(/\/share\/[^/]+/, "/share/:token");
  return `${location.origin}${path}`;
}

function flush() {
  timer = null;
  const items = queue.splice(0, 50);
  if (!items.length) return;
  sendTgaAnalytics({ data: { items } } as never).catch(() => {});
  if (queue.length) timer = setTimeout(flush, 0);
}
function enqueue(item: Item) {
  if (typeof window === "undefined") return;
  queue.push(item);
  if (!timer) timer = setTimeout(flush, 1500);
}

export function trackPageView() {
  const u = utms();
  enqueue({
    type: "page_view",
    url: cleanUrl(),
    session_id: sessionId(),
    referrer: document.referrer || undefined,
    user_agent: navigator.userAgent,
    platform: "web",
    ...u,
    event_data: { visitor_id: visitorId(), ...u },
  });
}

export function trackTgaEvent(
  event_name: string,
  event_type: "conversion" | "interaction" | "navigation" | "form" | "ui_action",
  data: Record<string, string | number | boolean | null> = {},
) {
  enqueue({
    type: "event",
    event_name,
    event_type,
    session_id: sessionId(),
    url: cleanUrl(),
    platform: "web",
    event_data: { visitor_id: visitorId(), ...utms(), ...data },
  });
}

/** Interview milestones forwarded from the app's own event log (allowlist, counts only). */
const FORWARD: Record<string, { name: string; type: "conversion" | "interaction" }> = {
  onboarding_viewed: { name: "interview_opened", type: "interaction" },
  onboarding_three_submitted: { name: "openers_submitted", type: "interaction" },
  choice_made: { name: "pairing_choice_made", type: "interaction" },
  session_completed: { name: "reading_completed", type: "conversion" },
  result_shared: { name: "reading_shared", type: "conversion" },
};
export function forwardInterviewEvent(eventType: string, props?: Record<string, unknown>) {
  const f = FORWARD[eventType];
  if (!f) return;
  const safe: Record<string, number> = {};
  for (const k of ["round", "answered", "rank"]) {
    const v = props?.[k];
    if (typeof v === "number" && Number.isFinite(v)) safe[k] = v;
  }
  trackTgaEvent(f.name, f.type, safe);
}
