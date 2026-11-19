# Codex Assignment: MusicDNA Admin MCP — Catalog, Song Whys, Pairings & QA

## Objective

Build a comprehensive MCP interface for MusicDNA that allows authorized AI assistants to:

1. Audit the song catalog and its musical attributes.
2. Retrieve and independently review all Song Why explanations.
3. Identify musical inaccuracies, fabricated details, and unsupported interpretations.
4. Validate attribute scores against actual explanations.
5. Analyze and test pairing quality, including decade proximity.
6. Inspect interview sessions, Critic responses, and reviewer decisions.
7. Investigate performance, latency, failures, and retries.
8. Recommend improvements and submit proposed corrections for human review.

The MCP should reuse the existing MusicDNA database, authentication, RLS policies, audit logs, and business logic.

**Do not build a second catalog, independent scoring engine, or disconnected QA system.**

All tools should use the same authoritative records as the MusicDNA admin interface.

---

# 1. Catalog Tools

### `catalog_get_summary`

Return:

- Total active and inactive songs
- Songs by decade and genre
- Songs with complete/incomplete attributes
- Songs with approved Song Whys
- Songs without Song Whys
- Explanation approval/rejection counts
- Songs used in pairings
- Songs never used
- Songs missing metadata or album artwork
- Last catalog update

### `catalog_list_songs`

Paginated catalog retrieval.

Filters:

- Artist
- Title
- Genre
- Decade/year range
- Active/inactive
- Song Why status
- Attribute completeness
- Popularity/selection frequency
- Last updated
- Search query

Support deterministic sorting and cursor pagination.

### `catalog_get_song`

Retrieve a complete song record:

- Stable song ID
- Title
- Artist
- Album
- Release year
- Genre/subgenre
- Active status
- Catalog metadata
- All scored attributes and dimensions
- Attribute schema/version
- Song Whys
- Pairing participation
- Usage statistics
- Review history

### `catalog_search_songs`

Search by title, artist, album, and partial/fuzzy matches.

Support alternate spellings and punctuation.

Return match confidence and stable song IDs.

### `catalog_get_song_attributes`

Return all attributes, including:

- Dimension and axis names
- Numerical score
- Scale/direction
- Confidence
- Scoring method/version
- Supporting evidence
- Last evaluation date

Use the existing ontology; do not invent new scoring dimensions.

### `catalog_get_attribute_ontology`

Return the official scoring framework:

- Attribute names
- Definitions
- Opposing poles
- Numerical scales
- Interpretation guidance
- Required evidence
- Confidence thresholds
- Version

This allows an AI auditor to judge each explanation against the actual scoring system.

---

# 2. Song Why Tools — Highest Priority

### `song_whys_get_summary`

Return:

- Approved explanations
- Pending explanations
- Rejected explanations
- Missing explanations
- Counts by attribute
- Counts by decade and genre
- Most frequently revised attributes
- Reviewer pass/fail statistics
- Explanation coverage by song

### `song_whys_list`

Retrieve Song Whys with filtering and pagination.

Filters:

- Song ID
- Artist
- Decade
- Genre
- Attribute/dimension
- Approval status
- Reviewer confidence
- Creation date
- Reviewer model/version
- Songs with multiple explanations
- Songs with conflicting explanations
- Popularity/usage frequency

### `song_whys_get`

Return one complete explanation:

- Explanation ID
- Song ID and metadata
- Attribute and score
- Attribute definition
- Hear text
- Means text
- Reviewer rationale
- Reviewer verdict
- Reviewer model
- Writer model
- Confidence
- Version
- Creation/approval dates
- Edit history
- Original source evidence, if recorded

### `song_whys_export`

**Critical tool.**

Export the entire collection as JSON or CSV.

Requirements:

- All approved, pending, and rejected explanations
- Complete records, not truncated summaries
- Stable IDs
- Attribute scores and definitions
- Hear/Means text
- Reviewer reasoning
- Version and model information
- Approval status
- Optional date and status filters

Support asynchronous exports for large datasets.

Include total record count, export count, generation timestamp, and schema version.

Allow download using a short-lived authenticated URL.

### `song_whys_get_review_history`

Return the complete revision and review history for an explanation.

Include:

- Original draft
- Subsequent revisions
- Reviewer verdicts
- Rejection reasons
- Human edits
- Final approved version

### `song_whys_find_conflicts`

Find explanations that may contradict one another.

Examples:

- Same song described as both sparse and densely arranged
- Different explanations assigning incompatible production characteristics
- Claims of entirely different instrumentation
- Conflicting vocal descriptions
- Different explanations of the same attribute

Return evidence and record IDs, not just a conflict score.

### `song_whys_run_audit`

Perform an independent, read-only evaluation of selected explanations.

Checks:

1. Musical specificity
2. Factual plausibility
3. Attribute alignment
4. Unsupported artist intention
5. Unsupported emotional/psychological inference
6. Generic or interchangeable language
7. Contradiction with other explanations
8. Score/evidence consistency
9. Incorrect dates, genres, or song identity
10. Reviewer reasoning quality

Return:

- Pass / Needs Revision / Reject recommendation
- Severity
- Specific problematic excerpt
- Explanation
- Suggested corrected wording
- Confidence
- Whether recording verification is required

Do not automatically change approval status.

The audit must distinguish between facts that can be verified from catalog data, inferences from the explanation text, and auditory claims requiring human listening.

### `song_whys_submit_revision`

Submit a proposed alternative Hear/Means explanation to a review queue.

Requirements:

- Original explanation ID and version
- Proposed Hear text
- Proposed Means text
- Reason for revision
- Supporting evidence
- Author identity
- Change diff

**Must not overwrite an approved explanation or publish changes automatically.**

### `song_whys_list_audit_findings`

Retrieve findings by severity, status, auditor, song, attribute, and date.

Allow repeated audits without duplicating unresolved findings.

---

# 3. Pairing Tools

### `pairings_get_summary`

Return:

- Total active pairings
- Pairings by decade
- Pairings by genre
- Pairings by attribute
- Pairings missing validation
- Pairings never presented
- Pairing selection frequency
- Skip rates
- User-choice distributions
- Average year difference

### `pairings_list`

Paginated retrieval of all pairing records.

Include both song IDs, titles, artists, years, attribute targets, active status, and selection statistics.

### `pairings_get`

Return one pairing's complete configuration:

- Both songs
- Both years
- Target dimension
- Intended contrast
- Attribute values
- Validation results
- Generation method
- Usage and skip statistics

### `pairings_find_for_song`

Given a starting song, return eligible candidate pairings.

Include:

- Original song's year
- Both candidate songs' years
- Absolute year differences
- Attribute contrast
- Candidate eligibility
- Ranking/relevance rationale

### `pairings_validate_decade_proximity`

**Critical tool.**

Validate candidate years against user-provided opening songs.

Parameters:

- Opening song IDs or explicit years
- Maximum year distance (default 10)
- Require both candidates within range (default true)
- Optional fallback behavior

Return:

- Eligible pairings
- Ineligible pairings
- Exact year distances
- Closest opening-song anchor
- Rejection reason
- Whether a fallback was used

Support testing without changing production matching behavior.

### `pairings_simulate_interview`

Given three opening songs, simulate a complete six-pair interview without recording real user votes.

Return for each round:

- Selected pairing
- Candidate years
- Opening-song anchor
- Decade compliance
- Attribute being tested
- Candidate ranking
- Fallback reason
- Relevant score differences

Include a deterministic test seed where supported, enabling repeatable regression tests.

### `pairings_analyze_quality`

Analyze:

- Decade mismatch rates
- Pairing repetition
- Genre overconcentration
- Overused popular songs
- Low-information contrasts
- High skip rates
- Underrepresented decades
- Attribute coverage gaps

Report actionable recommendations.

---

# 4. Interview & Critic QA Tools

### `qa_list_interviews`

List test and production interview metadata.

Filters:

- Date range
- Completion status
- Guest/signed-in
- Model tier
- Reviewer outcome
- Error status
- Duration
- Number of choices
- QA versus production

Respect privacy and access restrictions.

### `qa_get_interview_trace`

**Critical tool.**

Return the complete technical trace for one authorized interview:

- Session ID
- Opening songs and resolved song IDs
- All six pairings
- Choices and skips
- Critic responses
- Reviewer decisions
- Retry counts
- Processing durations
- Generation status
- Error codes
- Saved-reading status
- Relevant model versions

Include timestamps for each step.

Do not expose credentials, personal messages, unrelated account data, or unnecessary personal identifiers.

### `qa_get_critic_response`

Return:

- Prompt context summary
- Referenced song evidence
- Generated Critic response
- Verified versus unverified claims
- Reviewer verdict
- Reviewer feedback
- Rewrites
- Final accepted response

### `qa_get_reviewer_results`

Retrieve reviewer activity, filtered by:

- Date range
- Model
- Reviewer version
- Pass/fail
- Rejection category
- Interview type
- Critic response type

### `qa_get_reading`

Retrieve a saved reading and associated provenance.

Include the exact song choices and evidence supporting its claims.

### `qa_validate_reading`

Independently test a saved reading against:

- Actual user choices
- Approved Song Whys
- Attribute evidence
- Reviewer rules
- Prohibited unsupported inference
- Incorrect song references

Return a structured report with precise supporting record IDs.

### `qa_get_processing_timeline`

Show generation timing by phase:

- Request received
- Context assembled
- First model call
- Reviewer call
- Rewrites
- Save attempt
- Completion
- Timeout/error

Include total and phase-specific latency.

### `qa_get_quip_timeline`

**Critical for current work.**

Return the actual quips shown during an interview:

- Quip text
- Category
- Display timestamp
- Duration
- Processing phase
- Associated choice
- Sequence position
- Total number displayed
- Repetition information

This should distinguish what the user actually saw from what the server merely generated.

### `qa_analyze_quip_pacing`

Report:

- Average number of quips per processing interval
- Time until first quip
- Average time between quips
- Repetition rates
- Long-running generation behavior
- Quips displayed immediately before timeout
- Differences across model tiers

### `qa_get_errors`

Query application errors by session, function, date, and error type.

Include retry and timeout diagnostics.

### `qa_run_synthetic_interview`

Run a clearly marked synthetic test without contaminating production user-learning signals.

Allow predefined opening songs and vote sequences.

Report final reading quality, reviewer acceptance, and latency.

Synthetic tests must be isolated from real-user preference analytics.

---

# 5. Model and Quality Monitoring

### `models_get_routing_summary`

Return active model assignments for:

- Opening-song responses
- After-pick Critic
- Full saved readings
- Chat
- Song Why drafting
- Song Why review

Include model identifiers and configuration versions, but no secrets.

### `models_get_quality_metrics`

Return:

- Reviewer acceptance rate
- First-pass acceptance
- Retry rate
- Failure rate
- Median and p95 latency
- Token usage
- Estimated cost
- Model/version comparisons

### `models_compare_versions`

Compare model configurations over a selected period, with sample sizes and statistically meaningful cautions.

### `models_get_learning_signals`

Inspect the quality signals being produced for the existing Echelon / Edge-bot / Agent-brain loop.

Include whether each signal was successfully emitted and acknowledged.

Do not expose raw private user content unnecessarily.

---

# 6. Access Control and Safety

Implement role-based permissions:

| Role | Permissions |
|---|---|
| Catalog Reader | Read songs, attributes, and explanations |
| QA Auditor | Read QA traces and run audits |
| Catalog Editor | Submit draft revisions |
| Reviewer | Approve/reject through existing controlled workflow |
| Admin | Manage permitted configurations |

Requirements:

- OAuth or existing authenticated MCP mechanism
- Enforce authorization server-side
- Respect existing RLS and ownership
- Default to read-only
- Audit every write
- Require optimistic concurrency/version checks
- Require idempotency keys for mutations
- Never expose service-role credentials or API secrets
- No automatic bulk approval or deletion
- No production data modifications from synthetic tests

Keep read-only catalog auditing available independently of sensitive interview data access.

---

# 7. Performance and API Design

Every list tool should support:

- Pagination
- Total counts
- Stable IDs
- Filtering
- Deterministic sorting
- Versioned response schemas

For large exports and analysis jobs, use asynchronous jobs with progress and completion status.

Avoid MCP response truncation.

Implement reusable error codes and retry guidance.

Provide tool descriptions that clearly explain which operations are authoritative and which are diagnostic.

---

# 8. First Regression Test: Existing MusicDNA Session

Use this QA session:

`fd7d5b61-1cdb-4a40-a027-ad6efd2e21d5`

Opening songs:

- Vitamin C — Can (1972)
- Under the Milky Way — The Church (1988)
- Svefn-g-englar — Sigur Rós (1999)

Observed pairing issues:

- Heat Waves (2020) versus Maps (2003)
- Budapest (2014) versus Breezeblocks (2012)

The 2012/2014 pairing is outside the ±10-year proximity window for all three opening songs.

The full saved-reading generation also stalled and required a retry.

Investigate:

1. Pairing candidate selection and decade filtering.
2. Whether candidate years were correctly resolved.
3. Whether a documented fallback was invoked.
4. Full-reading model latency.
5. Reviewer retries or rejections.
6. Generation timeout.
7. Whether a saved reading was eventually created.
8. Actual quip display sequence and timing.

Do not invent trace data if historical instrumentation is unavailable.

---

# 9. First Song Why Audit

Begin with all currently approved explanations.

Prioritize:

1. Explanations involving specific instrumentation or production claims.
2. Claims about vocal technique.
3. Artist intention or psychological claims.
4. Strongly directional attribute scores with weak evidence.
5. Contradictions between explanations for the same song.
6. Explanations the independent reviewer approved despite questionable evidence.

Use **Burn, Burn, Burn — Zach Bryan** as an initial regression example.

Flag statements such as:

- “a man unravelling”
- “choosing to reveal his insecurities”
- Claims of a close-miked vocal without supporting evidence
- Claims about recording conditions or location not established by the recording

The goal is to retain compelling criticism while eliminating invented facts and unsupported certainty.

---

# 10. Acceptance Criteria

- [ ] ChatGPT can retrieve every approved Song Why through paginated MCP calls.
- [ ] Complete collection can be exported without truncation.
- [ ] An AI auditor can inspect each explanation against its exact attribute and score.
- [ ] Findings contain specific evidence and recommended corrections.
- [ ] Audits never modify approved content automatically.
- [ ] Proposed revisions enter the existing human approval process.
- [ ] Pairings can be simulated and checked for decade proximity.
- [ ] Interview traces expose actual reviewer outcomes, retries, and timing.
- [ ] Quip display timing can be inspected.
- [ ] Production and synthetic QA data are distinguishable.
- [ ] Authorization, privacy, and audit controls are enforced.
- [ ] Existing Catalog UI behavior is preserved.

## Implementation order

**Phase 1 — Song catalog and Song Whys**

Implement sections 1 and 2 first. This unlocks the full explanation audit immediately.

**Phase 2 — Pairings and interview QA**

Implement sections 3 and 4, prioritizing decade validation, session traces, and quip timing.

**Phase 3 — Model monitoring and learning loop**

Implement section 5 and integrate the resulting quality signals with the existing learning infrastructure.

Do not delay Phase 1 waiting for the remaining features.

## Final deliverables

1. MCP tool inventory and schemas.
2. Authentication/authorization summary.
3. Example tool responses.
4. Integration tests.
5. Documentation for ChatGPT and Claude.
6. Confirmation that the full approved Song Why collection is accessible.
7. Confirmation that the November 18 QA session can be investigated.

**Do not start a bulk rewrite or change production scoring rules as part of the MCP implementation. Build the inspection and review capabilities first.**