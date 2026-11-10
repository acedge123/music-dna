# Two-phase QA for the Critic: find the cause before changing any prompts

## Why
In the latest test, the saved reading correctly found a 4-for-4 tendency, but chat couldn't explain it. One of three things happened:
1. The Critic never got the full evidence.
2. The Critic wrote an answer, but the quality check threw it out.
3. The AI call failed, and the backup reply was shown instead.

Phase 1 tells us which one happened. Phase 2 fixes only what the evidence points to.

## Phase 1: Five diagnostic runs (signed-in, fresh interviews)
Turn on a private QA "decision trace" for owner-QA sessions only. For every read and chat turn, it records:

| Captured | Purpose |
|---|---|
| Session ID + interview ID | Detect one session leaking into another |
| The six picks + their declared tests | Verify the evidence reaches the Critic |
| Pairing sayings available | Verify the writing material is there |
| Prompt version + model | Identify which writing path ran |
| Raw model reply | Tell weak writing apart from system failures |
| Quality-check result + fallback reason | Explain why good answers get thrown out |
| Previous 3 Critic replies | Diagnose repetition |
| Outside-measurement (Echelon/Agent Brain) event status | Confirm downstream measurement |

Run 1 of the 5 repeats the 4-for-4 scenario and then asks chat to explain it. An admin "Decision trace" view shows each run step by step, labeled "missing evidence", "rejected", or "AI call failed".

Guardrails:
- Owner-QA sessions only.
- Raw replies stay inside MusicDNA, readable by admins only, and are never exported.
- Saved readings, routing, learning and V1 settings stay unchanged.

## Phase 2: Fix what Phase 1 shows, then 20 interviews
- Missing evidence: send chat the frozen picks, tests and sayings it may cite.
- Good answers thrown out: loosen or correct the specific check that rejected them.
- AI call failed: add a retry and alerting, and make the backup reply honest.
- Repetition: give the writer its last 3 replies and add a "too similar" check.
- Carryover: a new interview sees only its own picks.

Then run 20 interviews and score them in Critic QA on four measures: accuracy, specificity, originality and relevance.

## Technical notes
- Build on the existing `critic_quality_attempts` table: add the context fingerprint, the evidence references sent, the raw reply (admin-only and only on QA-tagged sessions), the prior-reply references, and the downstream-measurement status.
- The Phase 1 deliverable is a short report for each run that names cause 1, 2 or 3.
