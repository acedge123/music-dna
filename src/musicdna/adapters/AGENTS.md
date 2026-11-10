# Adapter rules

- Raw critic writer/reviewer output is stored in `critic_quality_attempts.decision_trace` only for owner-QA sessions (admin-read, never exported), so failures can be diagnosed without retaining listener prose.
- Direct OpenAI Critic models use role-specific settings with strict schemas; GPT-6 text calls set supported reasoning effort without sampling parameters, output caps, automatic downgrades or extra retries. General LLM and preview-provider calls remain separate.
