# Critic model upgrade

## Direct OpenAI production configuration

The shared author used by interim reads, reveal and chat now defaults to:

| Role | Model ID | Reasoning |
| --- | --- | --- |
| Writer | `gpt-6.1-sol` | medium |
| Independent reviewer | `gpt-6.1-terra` | low |

The existing `OPENAI_API_KEY` is reused. No new credential is required.
Set Vercel `OPENAI_CRITIC_WRITER_MODEL=gpt-6.1-sol` and
`OPENAI_CRITIC_REVIEWER_MODEL=gpt-6.1-terra`, or remove existing role overrides
to use these defaults. Existing overrides take priority and are not silently
overwritten. Redeploy after changing Vercel environment values.

For a separately controlled premium QA comparison, set the writer override to
`gpt-6-astra`; reasoning remains medium. This is not enabled automatically.
Restore Sol after that comparison. No experimental assignment, enrollment,
learning export, routing or release flags are changed by this upgrade.

## Request and evidence boundaries

These text-only calls retain the supported Chat Completions endpoint, strict
`response_format.json_schema`, existing prompt/schema/reference/review contracts,
timers and retry behavior. GPT-6 calls send `reasoning_effort` and no sampling
parameters or optional output-token cap. A model access failure is reported
through the existing safe fallback, not retried against an older model.

The general-purpose LLM default and Lovable preview provider remain unchanged.
Saved results and replayed interim reads remain immutable; only new generations
use the selected model. An API key's existence does not establish model access.

## Production acceptance

After the updated revision is deployed, reload the browser and start a fresh
owner-QA interview. Verify actual returned models in `critic_quality_attempts.calls`
for read, reveal and chat, including reviewer calls. Check both empty eligible-axis
sets and supported claims. Score groundedness, musical specificity, originality,
relevance and entertainment independently. Model acceptance alone is not quality
acceptance. Account-specific model access and full signed-in production acceptance
must be verified against the live service, not inferred from unit tests.

References: https://developers.openai.com/api/docs/models/gpt-6.1-sol,
https://developers.openai.com/api/docs/models/gpt-6.1-terra,
https://developers.openai.com/api/docs/guides/latest-model.