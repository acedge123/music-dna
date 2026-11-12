# AB-73 backend handoff

The Flutter branch targets production www.musicdna.fm and requests the opt-in
asynchronous Critic path. This PR does not deploy or apply SQL.

After Alan reviews the backend PR, apply only
`supabase/migrations/20261112183759_musicdna_deferred_read_cursor.sql` once through
the normal native migration workflow. Check existing migration history and
function first; if already applied, verify matching SQL and do not rerun it.
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
