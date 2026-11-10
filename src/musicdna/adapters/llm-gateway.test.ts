import { describe, expect, it, vi, afterEach } from "vitest";
import { createLovableLlmGateway, callLovableAi, DEFAULT_MODEL } from "./llm-gateway";

function mockFetch(responseBody: unknown, opts: { status?: number } = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(responseBody), {
      status: opts.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("createLovableLlmGateway", () => {
  it("posts to the gateway URL with the api key and returns text", async () => {
    const { impl, calls } = mockFetch({
      choices: [{ message: { content: "  hello  " } }],
      usage: { prompt_tokens: 3, completion_tokens: 7 },
    });
    const gw = createLovableLlmGateway({ apiKey: "test-key", fetchImpl: impl });
    const out = await gw.complete({
      model: "some/model",
      system: "sys",
      prompt: "hi",
    });
    expect(out.text).toBe("hello");
    expect(out.usage).toEqual({ input_tokens: 3, output_tokens: 7 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("ai.gateway.lovable.dev");
    const auth = (calls[0].init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer test-key");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("some/model");
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
  });

  it("throws when the api key is absent", async () => {
    const { impl } = mockFetch({});
    const prev = process.env.LOVABLE_API_KEY;
    delete process.env.LOVABLE_API_KEY;
    try {
      const gw = createLovableLlmGateway({ fetchImpl: impl });
      await expect(gw.complete({ model: "m", prompt: "x" })).rejects.toThrow(
        /LOVABLE_API_KEY missing/,
      );
    } finally {
      if (prev !== undefined) process.env.LOVABLE_API_KEY = prev;
    }
  });

  it("surfaces upstream errors with status + snippet", async () => {
    const { impl } = mockFetch("rate limited", { status: 429 });
    const gw = createLovableLlmGateway({ apiKey: "k", fetchImpl: impl });
    await expect(gw.complete({ model: "m", prompt: "x" })).rejects.toThrow(/AI 429/);
  });

  it("routes to OpenAI when OPENAI_API_KEY is set and maps the default model", async () => {
    const { impl, calls } = mockFetch({
      choices: [{ message: { content: "hi there" } }],
    });
    const prevOpenai = process.env.OPENAI_API_KEY;
    const prevLovable = process.env.LOVABLE_API_KEY;
    const prevOpenaiModel = process.env.OPENAI_MODEL;
    process.env.OPENAI_API_KEY = "sk-openai-test";
    delete process.env.LOVABLE_API_KEY;
    delete process.env.OPENAI_MODEL;
    try {
      const gw = createLovableLlmGateway({ fetchImpl: impl });
      const out = await gw.complete({ model: DEFAULT_MODEL, prompt: "q" });
      expect(out.text).toBe("hi there");
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain("api.openai.com");
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer sk-openai-test");
      const body = JSON.parse(calls[0].init.body as string);
      expect(body.model).toBe("gpt-4o-mini");
    } finally {
      if (prevOpenai !== undefined) process.env.OPENAI_API_KEY = prevOpenai;
      else delete process.env.OPENAI_API_KEY;
      if (prevLovable !== undefined) process.env.LOVABLE_API_KEY = prevLovable;
      else delete process.env.LOVABLE_API_KEY;
      if (prevOpenaiModel !== undefined) process.env.OPENAI_MODEL = prevOpenaiModel;
    }
  });

  it("honors OPENAI_MODEL on the OpenAI path", async () => {
    const { impl, calls } = mockFetch({ choices: [{ message: { content: "ok" } }] });
    const prevOpenai = process.env.OPENAI_API_KEY;
    const prevOpenaiModel = process.env.OPENAI_MODEL;
    const prevLovable = process.env.LOVABLE_API_KEY;
    process.env.OPENAI_API_KEY = "sk-openai-test";
    process.env.OPENAI_MODEL = "gpt-4o";
    delete process.env.LOVABLE_API_KEY;
    try {
      const text = await callLovableAi([{ role: "user", content: "q" }], { fetchImpl: impl });
      expect(text).toBe("ok");
      const body = JSON.parse(calls[0].init.body as string);
      expect(body.model).toBe("gpt-4o");
    } finally {
      if (prevOpenai !== undefined) process.env.OPENAI_API_KEY = prevOpenai;
      else delete process.env.OPENAI_API_KEY;
      if (prevOpenaiModel !== undefined) process.env.OPENAI_MODEL = prevOpenaiModel;
      else delete process.env.OPENAI_MODEL;
      if (prevLovable !== undefined) process.env.LOVABLE_API_KEY = prevLovable;
      else delete process.env.LOVABLE_API_KEY;
    }
  });
});

describe("callLovableAi", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["writer", "reviewer"] as const)(
    "uses the Critic %s default rather than the general GPT-4o mini override",
    async (role) => {
      vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
      vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
      vi.stubEnv("OPENAI_CRITIC_WRITER_MODEL", "");
      vi.stubEnv("OPENAI_CRITIC_REVIEWER_MODEL", "");
      const { impl, calls } = mockFetch({ choices: [{ message: { content: "{}" } }] });
      const schema = { type: "object", additionalProperties: false, properties: {}, required: [] };
      await callLovableAi([{ role: "user", content: "Return JSON" }], {
        model: DEFAULT_MODEL,
        role,
        jsonSchema: { name: "critic_contract", schema },
        fetchImpl: impl,
      });
      const body = JSON.parse(calls[0].init.body as string);
      expect(body.model).toBe(role === "writer" ? "gpt-6.1-sol" : "gpt-6.1-terra");
      expect(body.reasoning_effort).toBe(role === "writer" ? "medium" : "low");
      expect(body).not.toHaveProperty("temperature");
      expect(body).not.toHaveProperty("top_p");
      expect(body).not.toHaveProperty("max_tokens");
      expect(body).not.toHaveProperty("max_completion_tokens");
      expect(body.response_format).toEqual({
        type: "json_schema",
        json_schema: { name: "critic_contract", strict: true, schema },
      });
    },
  );

  it("uses Astra only when the writer override explicitly selects it", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_CRITIC_WRITER_MODEL", "gpt-6-astra");
    const { impl, calls } = mockFetch({ choices: [{ message: { content: "{}" } }] });
    await callLovableAi([{ role: "user", content: "Return JSON" }], {
      role: "writer", fetchImpl: impl,
    });
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("gpt-6-astra");
    expect(body.reasoning_effort).toBe("medium");
  });

  it("preserves explicit older-model overrides without unsupported reasoning parameters", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_CRITIC_WRITER_MODEL", "gpt-4.1");
    const { impl, calls } = mockFetch({ choices: [{ message: { content: "ok" } }] });
    await callLovableAi([{ role: "user", content: "q" }], { role: "writer", fetchImpl: impl });
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("gpt-4.1");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("reports the actual deployed model and usage in the Critic trace", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_CRITIC_REVIEWER_MODEL", "");
    const { impl } = mockFetch({
      model: "gpt-6.1-terra", choices: [{ message: { content: "{}" } }],
      usage: { prompt_tokens: 120, completion_tokens: 45 },
    });
    const measured = vi.fn();
    await callLovableAi([{ role: "user", content: "q" }], {
      role: "reviewer", fetchImpl: impl, onMeasurement: measured,
    });
    expect(measured).toHaveBeenCalledWith({
      model: "gpt-6.1-terra", provider: "openai", input_tokens: 120, output_tokens: 45,
    });
  });

  it("does not retry or downgrade when the selected Critic model is unavailable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_CRITIC_WRITER_MODEL", "");
    const { impl, calls } = mockFetch({ error: { code: "model_not_found" } }, { status: 404 });
    await expect(callLovableAi([{ role: "user", content: "q" }], {
      role: "writer", fetchImpl: impl,
    })).rejects.toThrow("AI 404");
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].init.body as string).model).toBe("gpt-6.1-sol");
  });

  it("preserves all system messages and separate user turns", async () => {
    const { impl, calls } = mockFetch({
      choices: [{ message: { content: "ok" } }],
    });
    const text = await callLovableAi(
      [
        { role: "system", content: "S1" },
        { role: "system", content: "S2" },
        { role: "user", content: "U1" },
        { role: "user", content: "U2" },
      ],
      { apiKey: "k", fetchImpl: impl },
    );
    expect(text).toBe("ok");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.messages).toEqual([
      { role: "system", content: "S1" },
      { role: "system", content: "S2" },
      { role: "user", content: "U1" },
      { role: "user", content: "U2" },
    ]);
  });
});
