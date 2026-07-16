# Fix: `callLovableAi` drops all system messages after the first

## The bug

`src/musicdna/adapters/llm-gateway.ts` → `callLovableAi()` collapses the incoming `messages[]` into a single `{ system, prompt }` pair before handing off to the gateway:

```ts
const system = messages.find((m) => m.role === "system")?.content;
const userParts = messages
  .filter((m) => m.role !== "system")
  .map((m) => m.content)
  .join("\n\n");
```

This means:
- Only the **first** system message survives.
- Any additional `role: "system"` blocks are silently discarded.
- The order of system vs. user turns is lost — everything non-system gets flattened into one user string.

The chat path in `src/lib/musicdna.functions.ts` (line ~2764) sends **three** system messages in order:
1. `CHAT_VOICE` — the critic persona
2. `voiceMod` — per-user critic-profile modulation (tone/edge tuned to that reader)
3. `contextBlock` — session context (hypothesis, lane, recent choices, prior turns)

Only #1 reaches the model. The critic loses both its per-user voice modulation **and** its knowledge of the current session. That matches the CGPT report — chat feels generic and forgetful because it literally is.

Other call sites (`onboarding-openers.functions.ts`, classifier, react, refine, synth, extractor) only pass one system message, so they're unaffected in practice — but they're one refactor away from the same silent failure.

## Fix

Change `callLovableAi` to preserve every system message and to keep user/assistant turns as distinct messages instead of concatenating them.

Update the `LLMGateway.complete` port + the Lovable adapter to accept a full `messages` array (in addition to the current `{ system, prompt }` convenience shape), and have `callLovableAi` pass messages through untouched:

```ts
// llm-gateway.ts
export async function callLovableAi(messages, opts = {}) {
  const apiKey = opts.apiKey ?? process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: opts.model ?? DEFAULT_MODEL, messages }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content ?? "").trim();
}
```

The existing `createLovableLlmGateway({...}).complete({ system, prompt })` single-turn convenience stays for engine ports that already use it — no behavior change there.

## Test updates

`src/musicdna/adapters/llm-gateway.test.ts`:
- Update the "splits messages into system + concatenated user prompt" test to assert the **opposite**: multiple system messages are preserved in order, and user turns are sent as separate messages (no concatenation).
- Add a new case: two system + one user message round-trips as three messages in the request body.

## Out of scope

- No changes to `musicdna.functions.ts` call sites — they already pass correct `messages[]` arrays; the bug is purely in the adapter.
- No changes to the engine's `LLMGateway` port shape or single-turn callers.
- No prompt content changes (per prior scope: skip prompt edits).
