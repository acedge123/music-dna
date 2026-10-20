// CORS headers for /api/v1/* routes.
//
// Flutter, future desktop clients, and browser calls from other origins all
// hit these routes. Every response (including errors) must carry CORS headers
// or preflight will fail. Include an OPTIONS handler per route.

export const V1_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-MusicDNA-Experience",
  "Access-Control-Max-Age": "86400",
} as const;

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...V1_CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

export function errorResponse(
  code:
    | "NOT_FOUND"
    | "CONFLICT"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "INVALID_INPUT"
    | "INTERNAL"
    | "UPSTREAM"
    | "MUTATION_CONFLICT"
    | "INVALID_RESULT_VERSION"
    | "PERSISTENCE_FAILED"
    | "CHAT_TURN_PENDING",
  message: string,
  status: number,
): Response {
  return jsonResponse({ error: { code, message } }, { status });
}

export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: V1_CORS_HEADERS });
}
