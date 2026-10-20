// ============= LLM adapter =============
// Implements the engine's LLMGateway port. This is the ONLY place in the
// codebase that knows the AI endpoint URLs, model defaults, and how to read
// provider keys.
//
// Two providers are supported:
// - Lovable AI Gateway (default): uses LOVABLE_API_KEY, always available in
//   the Lovable preview/cloud.
// - OpenAI direct: when OPENAI_API_KEY is set (e.g. on external hosts like
//   Vercel where Lovable-managed secrets do not propagate), calls go straight
//   to api.openai.com. OPENAI_MODEL optionally overrides the model.
//
// The engine depends on the LLMGateway interface (src/musicdna/engine/ports),
// never on this file. Server functions and REST routes construct this
// adapter and pass it in.

import type { LLMGateway } from "@/musicdna/engine/ports";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type ResolvedProvider = {
  url: string;
  apiKey: string;
  defaultModel: string;
};

function resolveProvider(): ResolvedProvider | null {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      url: OPENAI_URL,
      apiKey: openaiKey,
      defaultModel: process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL,
    };
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    return { url: AI_URL, apiKey: lovableKey, defaultModel: DEFAULT_MODEL };
  }
  return null;
}

// Callers throughout the app pass DEFAULT_MODEL (the gateway model id) or
// nothing. On OpenAI that id is invalid, so map the default to the provider's
// own default and pass anything else through untouched.
function resolveModel(provider: ResolvedProvider, requested: string | undefined, optsDefault?: string) {
  const fallback = optsDefault ?? provider.defaultModel;
  if (!requested || requested === DEFAULT_MODEL) return fallback;
  return requested;
}

export type LovableGatewayOptions = {
  apiKey?: string; // explicit key forces the Lovable gateway transport
  defaultModel?: string;
  fetchImpl?: typeof fetch; // injectable for tests
};

export function createLovableLlmGateway(opts: LovableGatewayOptions = {}): LLMGateway {
  const doFetch = opts.fetchImpl ?? fetch;
  const provider = opts.apiKey
    ? { url: AI_URL, apiKey: opts.apiKey, defaultModel: opts.defaultModel ?? DEFAULT_MODEL }
    : resolveProvider();

  return {
    async complete({ model, system, prompt, temperature, max_tokens }) {
      if (!provider) throw new Error("LOVABLE_API_KEY missing (and no OPENAI_API_KEY)");
      const messages: Array<{ role: string; content: string }> = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });

      const res = await doFetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: resolveModel(provider, model, opts.defaultModel),
          messages,
          ...(typeof temperature === "number" ? { temperature } : {}),
          ...(typeof max_tokens === "number" ? { max_tokens } : {}),
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = (json.choices?.[0]?.message?.content ?? "").trim();
      return {
        text,
        usage: {
          input_tokens: json.usage?.prompt_tokens,
          output_tokens: json.usage?.completion_tokens,
        },
      };
    },
  };
}

// Convenience for callers that just want raw text back with the classic
// messages[] shape used throughout musicdna.functions.ts. Mirrors the old
// `ai()` helper, but the transport now lives behind the port.
export async function callLovableAi(
  messages: Array<{ role: string; content: string }>,
  opts: LovableGatewayOptions & { model?: string } = {},
): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const provider = opts.apiKey
    ? { url: AI_URL, apiKey: opts.apiKey, defaultModel: opts.defaultModel ?? DEFAULT_MODEL }
    : resolveProvider();
  if (!provider) throw new Error("LOVABLE_API_KEY missing (and no OPENAI_API_KEY)");
  const res = await doFetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveModel(provider, opts.model, opts.defaultModel),
      messages,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}
