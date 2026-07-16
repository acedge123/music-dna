// LLM adapter — implements the engine's LLMGateway port over the
// Lovable AI Gateway. This is the ONLY place in the codebase that knows
// the gateway URL, the model default, and how to read LOVABLE_API_KEY.
//
// The engine depends on the LLMGateway interface (src/musicdna/engine/ports),
// never on this file. Server functions and REST routes construct this
// adapter and pass it in.

import type { LLMGateway } from "@/musicdna/engine/ports";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export type LovableGatewayOptions = {
  apiKey?: string; // defaults to process.env.LOVABLE_API_KEY
  defaultModel?: string;
  fetchImpl?: typeof fetch; // injectable for tests
};

export function createLovableLlmGateway(
  opts: LovableGatewayOptions = {},
): LLMGateway {
  const apiKey = opts.apiKey ?? process.env.LOVABLE_API_KEY;
  const defaultModel = opts.defaultModel ?? DEFAULT_MODEL;
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    async complete({ model, system, prompt, temperature, max_tokens }) {
      if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
      const messages: Array<{ role: string; content: string }> = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });

      const res = await doFetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || defaultModel,
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
  const apiKey = opts.apiKey ?? process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? opts.defaultModel ?? DEFAULT_MODEL,
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
