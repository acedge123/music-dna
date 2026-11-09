# Album artwork — web and Flutter

## Catalog review, 2026-11-09

All 494 catalog rows were checked against MusicBrainz recording searches and
release-specific Cover Art Archive metadata:

- 356 have an eligible candidate release with front artwork (72.1%).
- 16 have candidate releases but no front artwork found in the inspected editions.
- 118 had no eligible release candidate in the returned search results.
- 4 encountered upstream errors.

These are candidate matches, not verified releases or copyright permissions.
Alan Edgett confirmed on 2026-11-09 that licensing rights are approved for
MusicDNA's web and Flutter artwork use. This is owner-reported approval, not
independent legal verification; it does not verify the candidate release matches.
The import must document this approval on each covered record, and display must
still wait for correct release verification.
The first 100 recording results and up to three eligible release editions are
checked per song; `search_truncated` records searches exceeding that limit.
Strict artist matching means collaborations, alternate credits, spelling and
punctuation variants may require manual review. A miss does not establish that
artwork is unavailable. Bootlegs, live recordings, remixes, covers and compilations
are excluded. Original-year proximity ranks eligible release editions.

Full report: `data/musicdna/artwork/catalog-match-2026-11-09.json`.
Operator tool: `tools/musicdna/match-artwork.ts` (resumable, cached, MusicBrainz
requests spaced at least 1.1 seconds apart, bounded retries). No image binaries
were downloaded or republished. Candidate metadata remains in this report, not
the database; the database is prepared for subsequent reviewed imports.

## Applied database receipts

- Table and protection migration: `20261109170039`, name
  `ba10a8ed-88e6-481d-9021-2c9e46d650a1`.
  SQL SHA-256: `b7b427685133c54441204fb4f0da4d67f081428a985f7387adbed4122947d42c`.
- Revoke inherited unauthenticated access: `20261109171552`, name
  `73ba66db-2071-43b9-92b3-30ade99f040e`.
  SQL SHA-256: `094aee37e726c81e31232db4632e65085e1a72fb70215652498c42e4a7ae2e2f`.

`song_artwork` stores recording/release IDs, album information, candidate URL,
match score/status, rights status/reference, approved HTTPS image URL, attribution
and explicit display approval. One record per song. Update and validation triggers
are installed. No original song scores, pairings, evidence or release flags change.

## Supabase RLS Review

Pass: RLS enabled; unauthenticated role has no table privileges; administrators can
review all rows; ordinary signed-in listeners (including Supabase guest identities)
can read only approved records. Service role has maintenance privileges. Validation
rejects display without a verified match, licensed/granted rights, a nonempty rights
reference and HTTPS image URL. Readback: zero rows, zero enabled covers.

Guest access to approved artwork is intentional, matching anonymous starts;
the linter identifies this as an anonymous-access warning. Existing security
findings, including leaked-password protection, were not changed. No storage bucket,
credential, schedule or worker was created.

Manual checks still required: administrator review/import, ordinary-account denial
of candidate records, verified artwork readback and rendering in real Flutter,
and deployed Vercel serving-version verification. No authenticated artwork
write/read end-to-end claim is made; no approved artwork exists to exercise it.

## Shared client contract

Both shared `nextPairingImpl` selection paths attach `song_a.artwork` and
`song_b.artwork`. Field is nullable; approved values expose only `image_url`,
`album_title`, `release_mbid`, `source` and `attribution`. The adapter uses the
caller's Supabase client, filters approval explicitly even for administrators,
never exposes candidate URLs/rights notes, and falls back to null on artwork
read errors. See `mobile_flutter_api_contract.md` for Flutter handling.

Web presentation and Flutter rendering are unchanged in this preparation pass.
Frozen results, share publications and choice evidence are untouched. Rights and
release review must precede public display; retrieval and attribution alone are
not permission. Owner rights approval is now recorded above; release verification
and record-level approval remain outstanding. Hosting for approved images must
work on Vercel and Flutter.

Validation: 18 focused tests passed (matching, approval rules, enrichment/fallback,
session ownership and frozen evidence); changed-file lint passes; latest preview
build OK. Playwright opened the interview with no runtime errors. Production
deployment and approved-image rendering remain unverified.

## Display launch, 2026-11-09

- 333 of the 356 candidates passed conservative release-edition review and are
  enabled in `song_artwork`. 294 unique cover files are hosted with asset pointers
  under `src/assets/album-covers/`. This was a data-only import; no schema,
  scoring, pairing, evidence, publication or rollout flags changed.
- 23 candidates are held: suspicious special/remix/songbook editions, distant or
  missing release years, one wrong Smiths album, and one download failure.
  Together with 138 without usable candidates, 161 songs use the branded fallback.
- Manifest: `data/musicdna/artwork/cover-launch-2026-11-09.json`. Database readback
  matched all 333 exact song/release/title/hosted-URL bindings, with no unexpected
  rows or invalid approvals. Optional recording IDs, dates and original candidate
  URLs remain in the manifest; the compact import populated display fields only.
- Web song cards now render approved covers and the Music DNA fallback for null
  or failed images. The nullable REST shape is unchanged; Flutter rendering is
  still owned by the Flutter team. Absolute HTTPS asset URLs work independently
  of Vercel's application paths.
- 19 focused checks and changed-file lint passed. A fresh guest interview visibly
  rendered approved Elephant artwork alongside a missing-cover fallback; no page
  errors. Production website deployment remains unverified.

Earlier zero-row/preparation notes describe the preceding pass, not current state.