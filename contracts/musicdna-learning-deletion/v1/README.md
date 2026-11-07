# learning-deletion.v1

Canonical owner: `acedge123/music-dna`. This additive synthetic lifecycle protocol does
not change `learning-observation.v1` or authorize real-user export. Portable validators,
manifest hashes and 17 fixtures are identical in Music DNA and Echelon; local module
paths differ. Run `npm run check:learning-contract` and compare manifests with
`node scripts/check-musicdna-deletion-contract.mjs <other-repo-manifest>`.

POST the exact six-field request to `app-signal-inbound/learning/delete`, using the
source-specific ingest key. The receiver derives tenant/environment from registration,
records terminal subject suppression and atomically purges evidence. A 200 **completed**
receipt (not dispatch/202) acknowledges durable deletion. Persist/retry the original ID;
a mismatching completion ID requires reconciliation. Scope expiry bounds suppression
retention without allowing old payloads to return. See the repo's lifecycle runbook.
