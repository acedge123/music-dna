# AB-82 — bounded, revocable share cards and visible browser errors

Source baseline: music-dna `cf9dd839cedc4c5a7dfc8b63f023b09d1d4a7852`.
Implementation: `codex/ab82-share-card-safety`. No migration, key, flag,
publication/consent rule, frozen result, catalog or model change.

## Changes

- The shared SVG renderer reserves the footer before fitting the headline,
  optional archetype and up to three evidence choices. Every text field wraps;
  long unbroken words also wrap. Readable minimum sizes and explicit ellipses
  bound excerpts. The published input is never rewritten. Both 1080×1080 and
  1080×1920 keep their existing SVG contract and Story safe area.
- Fitting uses basic text/geometry supported by Flutter; no foreignObject,
  external font, external asset or browser-only textLength fitting is required.
- Successful card responses and refused/malformed-token responses carry
  `Cache-Control: private, no-store, max-age=0`, `CDN-Cache-Control: no-store`
  and `Vercel-CDN-Cache-Control: no-store`. The existing publication lookup is
  performed on every request. Its is_public/pinned-snapshot gate is unchanged.
- Browser preparation checks HTTP status, SVG content type and exact image
  dimensions before conversion. It times out after 15 seconds. Each format has
  independent loading, visible failure and explicit retry, with no hidden retry.
  Token changes discard the old prepared file and abort pending preparation.
- The share sheet is invoked directly in the tap's call stack. AbortError is
  quiet. Real sharing failures attempt an image download and retain inline
  retry feedback; failed downloads have inline retry feedback too. The copy
  says a download started, never that Instagram published or saved an image.
- SVG conversion URLs are revoked on success/failure/abort. Download URLs are
  revoked after the browser has had time to consume the click.

## Verification (local, 19 November 2026)

- Full Vitest run: **863 passed, 109 skipped**. Skips are pre-existing database/
  environment-dependent checks, not successful live checks.
- TypeScript: clean. ESLint on changed TypeScript/TSX: clean.
- Vercel-target production build: passed locally; this is not a deployment.
- Chromium fixture walkthrough: HTTP failure/retry, independent square readiness,
  decode failure/retry, token changes, quiet cancellation, share-failure download
  fallback, download-failure inline retry and delayed URL cleanup passed.
- Browser SVG getBBox checks and visual inspection passed for typical and extreme
  long-text cards in both formats. [Rendered fixture grid](ab82-sharing/card-layout-fixtures.png)
  and [browser receipt](ab82-sharing/browser-receipt.json) contain only invented QA data.
- Existing Flutter SvgShareCardRenderer accepted/rasterized all four updated SVG
  fixtures to exact-size PNGs with non-background text pixels. This temporary
  compatibility test changed no mobile source. A locally supplied Georgia font
  was used for diagnostics; this is not iPhone font/share-sheet acceptance.
- `npm test` still stops before Vitest on the existing AB-75 learning-contract
  pin mismatch: stored validator hash `1744309a…`, current/main module hash
  `2fb2ce35…`. Main and this branch have byte-identical validator, manifest and
  checker files. No pin was changed to bypass the failure.

## Deployment and acceptance still needed

Alan merges/promotes the PR. No production state was changed in this work.
After the merged deployment is confirmed:

1. Explicitly publish an owned disposable reading and request each card at its
   **normal URL**, without a cache-busting query. Check browser and CDN headers
   and repeat the request to warm that exact URL.
2. Revoke through the normal owner UI/API, then request those exact URLs again.
   Require 404 with no card body and non-storing headers. Test a real browser/CDN,
   not only the mocked route regression. Restore the disposable reading's desired
   sharing state explicitly; do not modify another listener's publication.
3. Existing browser caches created under the former five-minute policy may
   survive until their old TTL expires. Fresh no-store browser/Flutter requests
   bypass them; downloaded or already prepared images cannot be recalled.
4. Verify browser failure/retry on mobile Safari and real Instagram/native share
   targets in the next TestFlight QA (AB-86). Flutter consumes the corrected server
   SVG without an app-source change, but destination availability is OS-controlled.

The same-URL regression in this PR stubs the publication loader and proves that
route logic rechecks it and refuses after revoke. It does not establish that the
live Vercel CDN has picked up these headers.

References: [Vercel cache-header policy](https://vercel.com/docs/caching/cache-control-headers)
and [Web Share activation/cancellation behavior](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).
