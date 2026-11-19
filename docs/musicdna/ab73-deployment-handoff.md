# AB-73 backend handoff

The Flutter branch targets production www.musicdna.fm and requests the opt-in
asynchronous Critic path. This PR does not deploy or apply SQL.

AB-75 reconciliation (19 November): production already records this SQL once as
`20261112192158_b34486e3-76fd-4d86-90fe-2550382ec0ea.sql`. Its live history hash
matches the retained source. The unapplied proposal timestamp `20261112183759`
was removed from executable migrations. **Do not apply it again to production.**
New environments use the canonical migration through normal history replay.
See `ab75-migration-receipts.json` for the read-only verification receipt.

For any separately approved deployment verification, check history/function first.
Return the actual applied version/name/hash, SQL identity, service-only EXECUTE,
SECURITY INVOKER and empty search_path / bounded lock wait. No table, RLS, key,
flag, source, schedule or earlier migration is to be changed. Test identity and
stale-position behavior must not manufacture user ratings or learning consent.

Deploy the reviewed backend commit through the normal Vercel workflow after
migration verification. Existing production V1 login and ownership checks remain.
An older backend ignores defer_read and returns inline read: build13 degrades to
the prior timing safely. If the new backend is deployed without this migration,
separate narration is visibly unavailable; picks/final report stay usable, but
that is not acceptance.

Verify one authorized owner reading: /choice returns only after durable save,
/next is visible before the intentionally delayed /read, rapid next picks do not
apply obsolete responses, six choices reach one final reading, original saved
readings remain unchanged. Do not enable optional learning or use service-role
credentials in Flutter. Confirm foreign/unknown and signed-out denial, duplicate
choice replay, and stale/duplicate follow-up read behavior. Deployment, migration
receipts and physical-device acceptance remain required before closing AB73.

AB67 free-text Q3 feedback is separate and must no longer use a stopping screen.
AB68 Refine/library is also separate. This change alone does not complete parity.
