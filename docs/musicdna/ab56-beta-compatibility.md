# AB-56 beta compatibility — November 9, 2026

The installed Flutter0.1.1(5) calls the stable beta hostname while the web site
auto-deploys main. The old beta snapshot is19c1e73; the reviewed web source for this
update is85b3536530787ade32149aa1c535e799b4869c48.

## Source correction

The main revision failed `check:routing-artifact`: its generated artifact still
described the older source, before critic-effects and other shared changes.
Regenerated the artifact after reviewing the current selector/effective-reaction
path. No routing code, experiment assignment, invitation, policy knob or migration
changed. The new source version is
`sha256:152860802c4bd5db96b9868169682e92358dc692be44faf32a09ef3a73a305d4`.

Existing AB-52 invitations stay pinned to their original source. They must not be
rewritten/rebucketed to accept this revision. The existing resolver rejects a pin
mismatch and keeps its configured fallback; beta pilot/instrumentation remain off.

## Target and verification

- Existing Vercel project `prj_xXtAp85f1cFGox23XyxRG7RCuIyP`, custom environment
  `musicdna-beta`, stable hostname
  `musicdna-beta-alan-edgetts-projects.vercel.app`.
- Verified beta configuration: V1 enabled, PersistenceV2 enabled, private acceptance
  mode off, routing shadow, AB-52 pilot and applied-outcome instrumentation unset/off.
  Sensitive server configuration is configured in Vercel; values are not copied
  into the Flutter app or this document.
- Full source checks:418 tests pass,99 environment-dependent tests skipped;
  contract/migration/source-artifact guards pass. Vercel-target build succeeds.
- Deploy to the existing beta environment, retain the prior deployment for rollback,
  and verify the actual served revision and ordinary authentication boundary.
  A public version page or unauthenticated401 is not authenticated acceptance.

Production V1, production aliases, learning scopes, model-review switches, user
records and all experiment invitations remain unchanged. No migration, catalog
activation or bulk artwork import is part of this update.

Flutter adoption is in the separate mobile repo: optional artwork with fail-soft
fallback, verbatim shared prose/reaction messages, retained audit/voice metadata,
and a new build number. This document does not establish native visual acceptance,
better readings, complete catalog coverage or permission to promote production V1.
