# Critic "greatest hits" + Instagram sharing

## Short answers
- Each reading's prose is frozen and saved for that listener, but great lines are not collected or reused. The model does not learn from them, so every reading is written from scratch.
- The Critic can still improve over time without retraining. We collect the best lines, you approve them, and the approved lines become style examples for the writer. The examples teach tone and craft; they are never pasted into new readings.
- Instagram sharing is straightforward. Web and Flutter can share the same image card.

## 1. Critic Hall of Fame (behind flag `MUSICDNA_CRITIC_EXEMPLARS_V1`, off by default)
- In Admin, add a "Save line" star next to Critic and final-reading lines. Star ratings from real listeners can also suggest candidates.
- A new admin-only list of lines with approval status, the reason each one works and tags such as payoff, twist or praise-with-teeth.
- The writer prompt gets a small rotating set of approved examples labeled "voice reference — do not reuse wording." Terra's review rejects near-copies, so lines don't become catchphrases.
- Evidence, scoring, routing and saved readings stay the same. Owner-QA lines are only used after you approve them.

## 2. Share to Instagram
- A shareable image of the reading: the headline line, Archetype, three top traits and a musicdna.fm link. It is made from saved content only, in 9:16 Story and 1:1 sizes.
- Web: the phone share sheet with the image (Instagram appears there), plus Download as a fallback.
- Flutter: the same image comes from one shared address, so the app shows exactly what web shows. The app can open Instagram Stories directly.
- Consent stays as it is: sharing means explicitly publishing the reading, and revoking turns the link off.

## Technical notes
- New table `critic_exemplars` (admin RLS), selected in llm-gateway prompt assembly; similarity check in the reviewer.
- Image made on the server with `GET /api/v1/share/:token/card.png?format=story|square`, which only works for published readings; docs go in experience-contract-v1.
- Tests: unpublished reading can't produce a card, exemplar wording not copied, flag off = unchanged prompt.
