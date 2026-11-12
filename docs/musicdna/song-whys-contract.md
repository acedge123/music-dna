# Song "Why this score?" — writer contract

Table: `public.song_trait_explanations`. External writers use the service-role key and must write `status = 'pending_review'`. Only the owner approves, in Admin → Song Whys.

## Which rows to write
- Active songs (`songs.active = true`), most-picked first. Count appearances in `choices.chosen_song_id` and `choices.rejected_song_id`.
- Per song, only its 2–3 most distinctive traits: the current 10 trait columns furthest from 50, and at least 20 points away (same rule as `src/musicdna/engine/song-whys.ts`).
- Trait keys and poles (100 = first, 0 = second):
  - movement: forward motion / stillness
  - atmosphere: immersive mood / statement
  - immersion: slow reveal / immediacy
  - scale: vast / intimate
  - community: communal / solitary
  - perspective: observation / feeling
  - confidence: command / vulnerability
  - tension: danger / release
  - texture: refinement / rawness
  - transformation: takes you somewhere / holds its shape
  Confirm poles against `public.axes` (`low_pole` / `high_pole`) before writing.

## Columns
| column | value |
|---|---|
| song_id | songs.id |
| axis | one of the 10 keys above (enforced) |
| score_at_write | the song's current score on that axis; the explanation goes stale if the song is rescored |
| audible_evidence | what a listener can actually hear on this recording; at least 10 chars, aim for 160 or fewer |
| interpretation | one line on what that sound means for the trait; at least 10 chars |
| status | `pending_review` (do not write `approved`) |
| confidence | `pending_review` |
| scoring_version | copy `songs.scoring_version` |
| drafted_by | e.g. `cgpt` |
| review_note | the independent checker's note (recommended) |

Unique key: (song_id, axis, score_at_write). Skip rows that already exist unless status = `rejected`.

## Quality rules
- Concrete sound only: production, arrangement, rhythm, vocal delivery, dynamics.
- No chart facts, dates, personnel or trivia.
- The explanation must support the score's direction, and must not be generic enough to fit most songs.
- If unsure about the recording, skip it.
- Run a second, independent model check before inserting.

Example: Still D.R.E., texture 92. Evidence: "Bone-dry, tightly quantized piano riff and drums with every element in its own space." Interpretation: "Refinement as precision, not softness."
