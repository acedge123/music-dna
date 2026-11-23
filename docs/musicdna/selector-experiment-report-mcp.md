# Read the Agent Brain selector experiment report through MusicDNA MCP

Implementation brief for Codex. Proposed connector capability, November 22, 2026. See the [approved selector experiment design](pairing-selector-baseline.md#pairing-selector-experiments-with-agent-brain).

## Operator question

“What did Brain find in the latest selector test? Show five pairings it would change, why it changed them, and whether we have listener skip data.”

## Report producer

Have the experiment runner persist a versioned, immutable report for each completed run. Use structured JSON as the source for the MCP response and an equivalent readable Markdown summary. Reuse the evaluation output when available. Record which component produced the evaluation and whether Agent Brain actually supplied a recommendation. Brain's existing MusicDNA feasibility report addresses a different question and must remain distinguishable from the new selector study.

## MCP contract

Add a read-only operator tool with the proposed name `get_selector_experiment_report`, following the existing MusicDNA admin MCP registration, authorization and manifest conventions. Accept an optional run ID, experiment ID, and bounded example count (default five). With no run ID, select the latest completed selector experiment visible to this caller by completion time, with a deterministic tie-break. Return its run ID and completion time. An explicit run ID always resolves to that exact run or an appropriate unavailable response. Reading the report must never start an experiment, call a paid model, dispatch a job, enroll listeners or publish a change.

| Return field | Meaning |
|---|---|
| Identity and provenance | Report schema version, run and experiment IDs, stage (offline replay, owner QA or listener pilot), completion time, producer, baseline and challenger versions, catalog and dataset references. |
| Findings | Short conclusion, limitations, recommendation and its source. Allow insufficient evidence. Distinguish a runner-produced summary from a Brain-authored recommendation. |
| Replay comparison | Eligible and replayed contexts, changed offers and denominator, fallbacks and invalid offers. State whether the intended diagnostic contrast was preserved. |
| Examples | Ranked opening songs or approved opener features, baseline pair, challenger pair, intended axis and explanation for the difference. Support changed examples plus representative unchanged/fallback examples when requested. Identify synthetic examples. Expose real opener details only within the caller's approved scope. |
| Listener outcomes | When measured, show skips and unique served ordinary offers by arm, display-acknowledgement coverage, completion, original-reading accuracy and feedback coverage, with uncertainty where available. Distinguish measured zero, missing telemetry and outcomes never collected. |
| Source | Stable authorized report reference and pinned versions so an operator can reproduce the comparison. |

## Acceptance checks

1. On an empty store, asking for the latest run returns a clear “No completed selector experiment report yet.” It returns no example pairings or invented metrics.
2. With two completed reports and a newer incomplete run, the default returns the most recent completed report in scope. Fetching the older ID still returns the original artifact.
3. With an offline-only run, the response can show five changed pairings when available. It explicitly says listener skip outcomes have not been measured. If only two examples qualify, return two.
4. With a listener pilot, the returned counts, denominators, missingness and version pins match the saved report. A zero-skip arm with measured exposures is distinct from an arm with no measured exposures.
5. Verify authorized and unauthorized reads using the existing MCP test pattern. Refresh the manifest and test the operator question through the connector. Reads have no side effects.

The first delivery can use a saved report fixture for contract tests. Production should expose a real completed artifact once the experiment runner produces one.
