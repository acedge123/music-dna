# Song Whys score challenges

The existing independent reviewer now checks recording-specific musical accuracy, numerical score strength as well as pole direction, and confusion between attributes. It evaluates the recording within its stated lane; it does not infer listener traits or change scoring/routing.

Each attribute review retains `axis`, `verdict`, `note` and adds `score_disputed`, `suggested_score` (integer 0–100 or null), and `reason`. Suggestions are advisory. Uncertainty permits a dispute without a proposed number. Nirvana’s Confidence example is guidance, not a forced score.

Both passing and failed drafts are retained in the existing pending human-review queue. Storage uses `model_review_verdict`, `score_disputed`, `suggested_score`, and `score_dispute_reason`; historical rows have no invented model verdict. Existing approved content is not rereviewed or rewritten automatically.

Bulk approval excludes failed/disputed drafts. Individual approval requires a visible confirmation and approves only explanation text, never the suggested score. Only human-approved explanations remain eligible for existing score-matched frozen use. No automatic rescore, activation, provider change or extra model call was added.