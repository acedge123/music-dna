# Test the pushed fixes first, then measure fun

## Answer to your question
The fixes just pushed are about reliability: fewer thrown-out answers, staying grounded, and actually taking on challenges. They do not measure fun. Admin -> Critic QA currently has four scores. Entertainment / "want to keep talking" is not one of them. No new voice rewrite is planned.

## Step 1 - Test the pushed fixes (first)
- Confirm the live site is running the latest update (the Critic v2.3 reliability changes).
- Run 5 signed-in owner-QA interviews: six picks each, then at least two chat challenges (one that pushes back on a specific song choice).
- Read the decision traces in Admin -> Critic QA and report:
  - percentage of AI replies accepted, target at least 90%
  - remaining rejections, grouped by cause (unsupported claim, bad reference, broken format, call failure)
  - whether challenges get a real song-specific answer instead of the safe fallback
  - repeated readings across stages
- If the live site is not on the latest update, stop and tell you what needs deploying.

## Step 2 - Add the fifth score (small, measurement only)
- Add "Entertainment / want to continue" (1-5) next to the existing four scores; show "inference accuracy" as "Grounded in evidence".
- Add one per-interview reviewer question: "After six choices, did you want to keep talking?" Yes / Maybe / No + short reason.
- Admin shows a "kept talking" rate for real listeners: chatted after the reveal, number of turns. QA sessions are excluded.

## Step 3 - Decide together
Use the step 1 numbers plus fun scores from the 5 runs to decide what's actually wrong. If the replies are accepted but still score low on entertainment, we discuss the interview's structure (for example, pacing, hooks and how challenges work). We won't do another wording pass.

## Technical details
- Migration: nullable `entertainment` smallint (1-5) on the QA review table; a small admin-only per-session verdict table with grants and RLS.
- Update `critic-quality.ts` axes and rubric, the QA panel and server functions; add tests for the 1-5 range and the allowed verdict values.
- No changes to routing, learning export or public V1 flags.
