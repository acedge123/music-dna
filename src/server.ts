import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { V1_CORS_HEADERS } from "./routes/api/v1/_cors";
import { allowExperienceRequest } from "./musicdna/adapters/experience-gate";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// The framework's built-in CORS layer answers OPTIONS preflights for
// /api/v1/* before the route's own OPTIONS handler runs — and it does so
// WITHOUT Access-Control-Allow-Origin, which breaks browser preflights for
// cross-origin API clients (Flutter ignores CORS, browsers do not).
// Answer those preflights here with the v1 CORS headers, before delegation.
function isV1Preflight(request: Request): boolean {
  if (request.method !== "OPTIONS") return false;
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/v1/");
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (isV1Preflight(request)) {
        return new Response(null, { status: 204, headers: V1_CORS_HEADERS });
      }
      if (!allowExperienceRequest(request, {
        enabled: process.env.MUSICDNA_EXPERIENCE_V1,
        acceptance: process.env.MUSICDNA_BACKEND_ACCEPTANCE,
        harnessKey: process.env.AGENT_TEST_HARNESS_KEY,
      })) {
        return new Response(JSON.stringify({error:{code:"EXPERIENCE_DISABLED",message:"V1 parity acceptance is pending."}}), {
          status:503,headers:{...V1_CORS_HEADERS,"Content-Type":"application/json","Cache-Control":"no-store"},
        });
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
