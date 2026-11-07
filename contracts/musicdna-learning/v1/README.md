# Music DNA learning observation v1 — AB-43 / AB-28

Status: implementation contract ready for review; **synthetic evidence only**. There is no exporter, ingest hook, source registration, database migration or flag activation in this change. Music DNA's normal six-answer journey, REST/Flutter contracts and local shadow router are unchanged.

Canonical owner: `acedge123/music-dna`. Echelon and Agent Brain carry byte-identical validator and fixture copies. `manifest.json` pins SHA-256 for both. `npm run check:learning-contract` checks local integrity and every positive/negative fixture. Pass another repo's manifest path to check cross-repo drift. Update all copies together in linked reviewed PRs; incompatible semantics require a new contract version. No cross-repo SDK/service is required.

## One observation, one exact reading version

The only initial event is explicit enum/rating feedback on a completed six-answer reading. The producer must read the owner's committed immutable feedback operation and result version. It must not trust a browser-authored learning verdict, a mutable catalog lookup, or a client assertion that data are synthetic. Empty/comment-only feedback is excluded. Normalize `partly` to `mixed` and `wrong` to `not_accurate` before export.

`fixtures.json` contains the exact envelope and receipt shapes. All fields are required unless their type explicitly permits null; all unknown fields are rejected at every level.

| Envelope field                | Meaning                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`, `severity`, `summary` | Fixed `workflow`, `low`, `Music DNA learning observation`; no free-form details/action/links/secret refs/tenant override                   |
| `source`, `environment`       | Reserved logical pairs `music-dna-staging`/`staging` and `music-dna`/`production`; these names do not assert registration or authorization |
| `correlation_id`              | Exactly `music-dna:learning:v1:<observation_id>`                                                                                           |
| `metadata.purpose`            | Exactly `learning_observation`                                                                                                             |
| `metadata.observation`        | Closed versioned record described below                                                                                                    |

| Observation field | Meaning                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_version`  | Exactly `learning-observation.v1`                                                                                                                       |
| `observation_id`  | UUID generated once and persisted with the immutable source operation/outbox; retries reuse it                                                          |
| `observed_at`     | Source feedback commit time, canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; never the retry/dispatch time                                                    |
| `subject_ref`     | `s_` + 64 lowercase hex characters: purpose/tenant/environment-scoped session pseudonym                                                                 |
| `decision`        | `d_` and `r_` scoped references, positive safe-integer `result_version`, result source `pairings` or `chat_self_report`, exactly six accepted answers   |
| `versions`        | Actual evidence/catalog codes, or null when unrecorded; never fabricate historical versions                                                             |
| `policy`          | Actual ID/version (known together), recorded recommendation event ID or null, experiment/variant (known together) or null                               |
| `feedback`        | `f_` scoped immutable-operation reference; accuracy `accurate`/`mixed`/`not_accurate` or null; rating -1/0/1 or null; at least one explicit enum/rating |
| `privacy`         | Fixed synthetic purpose/basis/policy: `synthetic`, `musicdna_diagnostic_quality`, `authorized_synthetic_test`, `synthetic-pilot.v1`                     |

Bounded version/policy codes contain only letters, digits and `._:/-`, maximum 128 characters; no whitespace or email addresses. These technical restrictions cannot prove that an identifier is non-sensitive: server provenance/field mapping remains required. Use null for unknown policy IDs/versions, recommendation attribution and experiments; a missing outcome is unknown, not failure or rejection.

Use keyed, domain-separated references such as HMAC-SHA256 over purpose + authorized tenant + environment + reference kind + internal ID. Use a distinct secret purpose key and never export it, raw internal user IDs, email, song profiles/vectors, prompts, chat, sentence quotes, comments, share tokens or credentials. References remain linkable data with deletion obligations; a pseudonym is not anonymization or consent. Fixture references are artificial and must not be used for real records.

A later distinct feedback operation gets a new observation ID and feedback reference, even for the same reading. The exact original result/version remains attached. A revised reading and its feedback are new observations, not updates to the old one. Preserve the producer's source operation uniqueness inside the transaction; creating a new UUID on every retry is incorrect. Legacy rows without durable provenance are excluded from initial export, not reconstructed by guesswork.

## Transport, receipts and failures

- Sender/receiver enforce an 8192-byte UTF-8 request body limit before JSON parsing; the closed bounded value contract is additionally validated on both sides. Body-size enforcement, HTTP auth and storage are future AB-45/46/47 responsibilities, not supplied by this object validator.
- The registry's authorized source/tenant/environment is authoritative. The declared source/environment must match it; payload strings do not grant access. Use independent per-environment source keys and server-only credentials. A synthetic production fixture is still eval data and requires explicit authorized test eligibility.
- For one authenticated source, persist a unique logical observation and exact accepted content atomically. Duplicates converge to the same receipt, including concurrent delivery. Fingerprint the full validated envelope as SHA-256 of UTF-8 JSON with object keys recursively sorted, no whitespace and normal JSON scalar encoding. Equal-ID/equal-content replay returns the prior receipt; equal-ID/changed-content returns 409 without altering the first record. Authenticate before revealing any receipt.
- Accepted response is the closed fixture receipt: `ok=true`, stable Echelon `event_id`, matching `observation_id`, `duplicate` boolean, `status=received`, `route=audit_only`, and null `agent_job_id`/`approval_id`. The dispatcher validates the receipt against its expected observation ID. A 2xx response without a valid durable receipt is not delivery success.
- Invalid/oversized/unsupported payload: 400/413 with a bounded code, never echo private input. Wrong/missing credential: 401. Disabled/forbidden source: 403. Reused-ID conflict: 409. Retry ambiguous timeouts, 429 and transient 5xx against the same stored ID/content; honor Retry-After and capped backoff. Quarantine permanent invalid/conflict cases; stop/escalate auth failures. Exact routes/error implementation is AB-46/47.
- Ingest is audit-only and must create zero jobs, approvals, messages or LLM calls. A later authorized learning-review batch under AB-54 is a separate request/path.

## Relation to Agent Brain outcome-events.v1

The observation remains domain evidence, not a duplicate generic recommendation schema. Legacy/unattributed observations are valid evidence but emit no fabricated recommendation outcome.

Agent Brain's `mapMusicDnaObservationToOutcomeV1` requires the authorized receiver source binding and a separately loaded immutable recommendation. It verifies recommendation/policy/tenant/environment/session/decision/experiment attribution and preserves trace, observation ID, result reference and exact version. A missing recommendation/context is explicitly unattributed; disagreement or an untrusted binding is rejected. The initial synthetic contract can join only eval telemetry.

Mapped reading feedback uses `outcome.status=unknown`, with a fixed enum-derived operator code and no inferred quality score. Agreement with a reading is not proof of accepting, applying or succeeding with Agent Brain advice. Accuracy/rating stay on the original domain observation, located by the outcome's observation ID. A predeclared measurement window is supplied explicitly, never invented from dispatch delay. Distinct later feedback/version events append; they do not rewrite prior outcomes. Cohort attribution and real-user experiments remain AB-29/52.

## Recorded decisions and remaining owner choices

| Decision                                                                 | Current disposition / owner                                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Technical envelope, strict allowlists, IDs, receipt semantics            | Reviewable implementation choices under AB-43/28; canonical code owner Music DNA, receiving owners Echelon/Agent Brain                                             |
| Initial eligibility                                                      | Authorized synthetic tests only, enforced by this contract; producer authorization must independently establish test eligibility                                   |
| Real registered or anonymous listeners, consent/legal purpose            | **Not approved by this task**; ACE owns the product/privacy decision under TGA-317/AB-49                                                                           |
| Public sharing                                                           | Never learning-export consent                                                                                                                                      |
| Real historical backfill, cross-tenant generalization                    | Excluded until separately approved                                                                                                                                 |
| Runtime retention, downstream deletion deadlines, backups and aggregates | Must be reconciled with D06 and implemented/tested under TGA-317/AB-49 before a real-data contract is enabled; source policy documentation is not deployment proof |
| New consent policy/data class                                            | Requires reviewed contract/policy evolution; changing a payload's privacy label cannot authorize real data                                                         |

D06 documents immediate access/share blocking and active-system deletion within seven days where applicable; its implementation and backup expiration are not claimed by this contract. Pending outbox data, receiver projections, readback/cache copies and late replay suppression must participate in deletion. Real-user eligibility stays closed while these decisions/implementations are pending. No new production configuration is authorized by a fixture or manifest.

Next work: AB-44/45/46/47/48/49 implement source onboarding, storage/export/dispatch, readback and lifecycle; AB-50 proves the first-hop staging boundary. The full ordered checklist remains in epic AB-6.
