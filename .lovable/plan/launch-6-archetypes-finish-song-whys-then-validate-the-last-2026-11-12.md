# Launch 6 archetypes, finish song "whys", then validate the last 4

## 1. Launch with the 6 approved archetypes
- You turn on `MUSICDNA_ARCHETYPE_V2=1` in Vercel (and I add it to the preview), then redeploy.
- New readings can then show "Confirmed archetype" or "Leaning toward" for Anthemist, Atmospherist, Hedonist, Romantic, Transformer or Witness. Otherwise they show the emerging signature.
- The match is frozen with each reading. Older readings stay as they are.
- I check it with one six-pick preview run and the admin view of the saved match.
- Add a "Does this archetype fit you?" yes/somewhat/no under the archetype. It reuses the existing reading-accuracy feedback and doubles as validation data.

## 2. Song "Why this score?" (the main build)
- **Pick the songs:** the 100 most-picked active songs first, then everything in live matchups.
- **Draft:** for each song, its 2–3 most distinctive traits. Sol writes what you can hear plus a short interpretation. An independent reviewer checks musical accuracy and rejects vague or invented claims. Everything lands as "pending review".
- **Admin queue:** a "Song Whys" tab, filtered by lane and decade, with approve, edit and reject, plus coverage counts.
- **Use:** only approved explanations are saved with each new pick, alongside the existing song facts. The Critic, chat and receipts can then say why a song is "refined". They never count as listener evidence, and old readings never change.
- **Cost guard:** drafting runs in batches of 25 that you start from admin, each with a cost estimate shown first.

## 3. Learn and validate Architect, Storyteller, Seeker and Believer
- **Thematic evidence:** extend the same review flow with lyric-theme notes per song (narrative, searching, conviction, craftsmanship), drafted and reviewed the same way. Architect also uses the approved texture "whys".
- **Measure, don't guess:** an admin report that replays saved readings against each draft profile, alongside the six live ones. It shows:
  - how often each draft would win, and against whom
  - how far it separates from its nearest neighbor
  - agreement with listeners' "fits me" answers and chat pushback
- **Approval gate:** a draft goes live only after enough fit answers, clear separation and your sign-off. Approval creates a new profile version, so existing readings keep the identity they were given.
- Owner QA sessions are excluded from these measures. Nothing is exported to the learning pipeline.

## Order
1. Launch flag and the "fits me" question (small).
2. Song Whys: tables already exist; build drafting, the queue, and Critic use.
3. Thematic notes plus the validation report, then decide on the four.

## Technical notes
- Drafting runs as an admin-only server function calling `llm-gateway.ts` (Sol writer, Terra reviewer). It writes `song_trait_explanations` with status `pending_review` and the current `scoring_version`. An explanation is stale when `score_at_write` no longer matches the song's score.
- Freezing: `capture_choice_evidence` (or the server-side evidence snapshot) adds approved explanations for the tested traits to `choices.evidence`.
- "Fits me" adds an `archetype_fit` field to the existing `save_result_feedback` payload, bound to the result version.
- The validation report is read-only and computed from `loadChoiceEvidence` ledgers plus draft profiles; it never writes readings.
