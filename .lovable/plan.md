# Advice: fixing the three remaining interview gaps (no code yet)

Your production retest left three problems: chat answers that don't stay tied to the listener's actual picks, critic writing that repeats itself, and an earlier reading that may carry over into a fresh QA interview. None of these causes has been confirmed yet, so each fix below starts by finding the cause.

## 1. Chat answers drift away from the listener's picks
- Start by tracing a few weak chat replies. For each one, check what evidence the critic actually received. Did it get the frozen picks, the tested traits and the sayings, or just a short summary?
- Likely fix: send each chat turn a short list of the specific picks it can cite (song A vs. song B, the trait tested, which way the listener went). Then require every claim in the reply to name at least one of those picks.
- Tighten the quality check so a reply that cites no pick, or cites a pick from another interview, gets rejected and replaced with an honest fallback.
- Keep the rule that chat never rewrites saved evidence. Better grounding means better citing, not new conclusions.

## 2. Repetitive writing
- Measure the problem first. Use the existing Critic QA records to count repeated openings, repeated phrases and repeated sentence shapes across the reads in a session.
- Fixes, from cheapest to most involved:
  - Give the writer the last 2–3 lines it already said, with an instruction not to reuse their openings or key phrases.
  - Rotate a small set of approaches per stage (contrast, provocation, callback, a question back to the listener) so consecutive reads take different angles.
  - Lean on the pairing sayings after a pick, so the voice comes from your catalog writing and not from model filler.
  - Add an automatic "too similar to the last line" check that asks for one rewrite before falling back.
- Score originality separately from accuracy in the four-score human review, so a fun line doesn't hide a wrong one.

## 3. An earlier reading may carry over into a fresh QA interview
- Reproduce it on purpose. Sign in as an account that already has a finished reading, start a new QA interview, and check whether anything from the old session shows up: the first read, the chat, the profile wording or a cached screen.
- Then check the three places old data can leak in:
  - Browser cache: data the browser kept from the old session.
  - The critic's input: any "previous reading" or account-history material passed to the critic.
  - Profile labels: anything built from the account instead of the current session.
- Fix rule: a new interview sees only its own picks. Use history across interviews only when the listener chose to continue, and say so on screen.

## Suggested order
1. Carryover (it's a correctness and trust issue).
2. Grounding (accuracy).
3. Repetition (polish, and easier to measure once the first two are clean).

After each fix: run one fresh signed-in session on the preview, then the same check on www.musicdna.fm. Review the results in Critic QA before calling it fixed. Leave routing, learning and V1 settings unchanged throughout.
