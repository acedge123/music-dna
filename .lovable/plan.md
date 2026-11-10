# Verified song facts for the critic

## Short answer
Yes, and it's the right fix. You're right that the "no music facts" rule is what keeps the critic stuck on abstract traits. The fix is not to loosen the reviewer. It's to give the critic a library of checked facts about each song that count as approved evidence. The reviewer keeps rejecting anything outside that library, so "facts" can never be invented.

Today each song only has trait scores, a lane, a year and (for some songs) a short rationale. There are no stored facts about sound, production, influences or history.

## What each song gets
A short, checked fact card, 3–8 facts per song, in five kinds:
- **Sound**: e.g. "fretless bass carries the melody", "drum machine with gated reverb"
- **Arrangement & production**: producer, studio approach, structure ("no chorus until 2:40")
- **Influences**: who it draws from or answers ("built on a Nile Rodgers-style guitar pattern")
- **Cultural context**: where it landed and what it meant ("soundtracked the 1983 club scene in…")
- **Distinctive moments**: the bit everyone remembers ("the key change", "the spoken bridge")

Each fact is one plain sentence with a source link, a confidence level and a status (draft, approved, rejected).

## How facts get checked
1. **Research draft (AI)**: the AI drafts facts for each song and must attach a public source for every one. Facts without a source are thrown out automatically.
2. **Cross-check (AI)**: a second model checks each fact against its cited source only, never its own memory. Anything unclear is marked "needs a human."
3. **Human approval in admin**: a new "Facts" tab lists songs with their draft facts and sources. Approve, edit or reject each one. Only approved facts reach the critic.

Decision for you: does every fact need human approval, or can facts that are well sourced and cross-checked go live on their own, with spot checks? Human-only is safest but slower; ~530 songs x ~5 facts is about 2,600 facts.

## How the critic uses them
- After a pick, the critic sees approved facts for **both songs in that matchup**, alongside the tested trait and saying. The facts are flavor and color, not proof of what the listener is like.
- The reviewer rule changes from "no music facts" to **"no music facts unless they're on the song's approved fact card."** Facts can't support claims about the listener: "the fretless bass" is fine, "you love fretless bass" is not.
- The facts are locked into each pick at the moment it's made, the same way evidence is today. That way old readings never change if a fact is later corrected.

## Rollout
1. **Pilot**: the ~100 songs that appear most often in live matchups. Run the same before/after test we've been using (first-pass approval, originality, wait time). Facts will make the critic's input a little longer.
2. **Expand**: all ~530 songs used in live matchups, by lane.
3. **The rest** of the catalog as songs get paired.

Nothing changes for listeners until the pilot test shows a gain and you approve switching it on.

## Technical details
- New table `song_facts` (song_id, kind enum, text, source_url, source_title, confidence, status, reviewer, version, timestamps). RLS: admins read/write; no listener access.
- Offline research tool under `tools/musicdna/` (AI gateway, writes drafts only), plus an admin Facts tab for review.
- Vote trigger snapshot: add approved facts for both songs to `choices.evidence` under a new snapshot version. Historical snapshots stay untouched and simply have no facts.
- `criticFacts` exposes `song_facts` per choice (latest pick in full, earlier picks trimmed). Reviewer prompt: `no_invented_facts` allows only facts that appear in the supplied cards, and adds a `fact_as_listener_claim` failure code.
- Live use behind a default-off flag; production migration only with your approval.
