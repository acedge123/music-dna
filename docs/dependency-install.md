# Reproducible npm installs (AB-55)

Use the committed `package-lock.json` and `npm ci` for local checks and Vercel installs. Vercel's repository configuration sets `installCommand` explicitly. Do not delete the lockfile or run a blanket dependency update to repair manifest drift.

```sh
npm ci
npm test -- --maxWorkers=2
VERCEL=1 VERCEL_ENV=production npm run build
```

The SSR build must produce `.vercel/output/functions/__server.func/index.mjs`; `.vercel/output/config.json` must route requests to `/__server`.

When an intentional manifest change makes `npm ci` fail, reconcile from a clean checkout without `node_modules`:

```sh
npm exec --yes --package npm@11.21.2 -- npm install --package-lock-only --include=optional --ignore-scripts --no-audit --no-fund
npm ci
```

Review resolved version changes and commit the lockfile with the manifest change. Keep existing exact deployment-package pins. A clean install must leave both files unchanged; do not use `--legacy-peer-deps` or omit optional platform packages to hide a dependency conflict.

The portable lockfile is generated and verified with Node 24.10.0 and npm 11.21.2; npm 11.6.0 clean installation is also checked. This records the tested toolchain; it does not change the hosting runtime selection. AB-43's separate contract PR adds its shared fixtures to `npm test`; run that combined suite before staging acceptance. Source tests/builds do not establish authenticated production acceptance.

The repaired lock resolves the already-declared exact pins: Lovable config `2.26.5`, TanStack Start `1.168.60`, React Router `1.170.41`, router plugin `1.168.42`, and Nitro `3.0.260603-beta`. PGlite is locked at `0.5.15` within the existing `^0.5.10` range. No dependency specifications changed. Related transitive resolutions changed as required by that graph; this is not a blanket update.

The verification build still reports existing TanStack `inputValidator()` deprecations. These do not prevent a successful build and are not addressed by this install repair.

Use the recorded current npm resolver when repairing this lockfile: npm 11.6.0 left previously missing non-Mac optional build dependencies unfilled, so its successful Mac install did not establish Linux readiness. The repair includes all platform entries without changing the already-resolved package versions; Vercel preview must pass before merging.
