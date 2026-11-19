import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import postgres from "postgres";
import { requireLearningOutboxDatabase } from "./require-learning-outbox-db.mjs";

// Only a disposable loopback server is accepted. No linked/hosted DB or keys.
const base = requireLearningOutboxDatabase();
const admin = postgres(base, { max: 1, onnotice: () => {} });
const name = "ab45_replay_" + randomUUID().replaceAll("-", "");
await admin.begin(async (tx) => {
  await tx`SELECT pg_advisory_xact_lock(454501)`;
  await tx.unsafe(`DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin; END IF;
  END $$`);
});
await admin.unsafe(`CREATE DATABASE "${name}"`);
const target = new URL(base);
target.pathname = "/" + name;
const notices = [];
const sql = postgres(target.toString(), {
  max: 1,
  onnotice: (n) => {
    if (n.message?.includes("prerequisite catalog is absent")) notices.push(n.message);
  },
});
const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
let applied = 0;
try {
  // Managed Supabase Auth surfaces used by the application DDL. This is not a
  // GoTrue/Auth-server test; no listener records or hosted snapshot are copied.
  await sql.unsafe(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',
      raw_app_meta_data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
      deleted_at timestamptz,email_confirmed_at timestamptz,banned_until timestamptz,is_anonymous boolean DEFAULT false);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
      'SELECT coalesce(nullif(current_setting(''request.jwt.claim.role'',true),''''),current_user)';
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      'SELECT coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb';
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
    CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    SET search_path=public,extensions;
  `);
  const files = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await sql.unsafe(source("supabase/migrations/" + file));
      applied++;
    } catch (error) {
      throw new Error(`Replay failed at ${file}: ${error.code} ${error.message}`, { cause: error });
    }
  }
  assert.equal(
    notices.length,
    3,
    "All three historical catalog prerequisites must be reported as unavailable",
  );
  await sql.begin("READ ONLY", async (tx) => {
    await tx`SET LOCAL statement_timeout='10s'`;
    const [permissions] = await tx`SELECT
      has_function_privilege('anon','public.save_result_feedback(uuid,jsonb)','EXECUTE') AS anon_feedback,
      has_function_privilege('authenticated','public.save_result_feedback(uuid,jsonb)','EXECUTE') AS owner_feedback,
      has_function_privilege('anon','public.save_musicdna_deferred_read(uuid,uuid,uuid,integer,jsonb)','EXECUTE') AS anon_deferred,
      has_function_privilege('authenticated','public.save_musicdna_deferred_read(uuid,uuid,uuid,integer,jsonb)','EXECUTE') AS listener_deferred,
      has_function_privilege('service_role','public.save_musicdna_deferred_read(uuid,uuid,uuid,integer,jsonb)','EXECUTE') AS service_deferred`;
    assert.deepEqual(permissions, {
      anon_feedback: false,
      owner_feedback: true,
      anon_deferred: false,
      listener_deferred: false,
      service_deferred: true,
    });
    for (const table of [
      "musicdna_export_scopes",
      "musicdna_learning_enrollments",
      "musicdna_learning_outbox",
      "musicdna_learning_dispatch_jobs",
      "musicdna_learning_dispatch_halts",
    ]) {
      const [row] =
        await tx`SELECT c.relrowsecurity AS rls,has_table_privilege('anon',c.oid,'SELECT') AS anon_read,
        has_table_privilege('authenticated',c.oid,'SELECT') AS listener_read FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=${table}`;
      assert.deepEqual(row, { rls: true, anon_read: false, listener_read: false }, table);
      assert.equal(
        (await tx.unsafe(`SELECT count(*)::int AS n FROM public.${table}`))[0].n,
        0,
        table,
      );
    }
  });
  const owner = "ab750000-0000-4000-8000-000000000001",
    other = "ab750000-0000-4000-8000-000000000002",
    session = "ab750000-0000-4000-8000-000000000003";
  await sql`INSERT INTO auth.users(id) VALUES(${owner}),(${other})`;
  await sql`INSERT INTO public.sessions(id,user_id,lane,completed_at) VALUES(${session},${owner},'general',now())`;
  for (const version of [1, 2])
    await sql`INSERT INTO public.session_results(session_id,user_id,version,source,base_version,content,evidence,ledger_version,policy_version,engine_version)
    VALUES(${session},${owner},${version},${version === 1 ? "pairings" : "chat_self_report"},${version === 1 ? null : 1},'{}', '{}', 'fixture-ledger','fixture-policy','fixture-engine')`;
  const payload = (operation, version = 1) => ({
    mutation_id: operation,
    result_version: version,
    accuracy: "accurate",
    rating: 1,
    comment: null,
    target: null,
    most_accurate_sentence: null,
    least_accurate_sentence: null,
  });
  const save = (user, value) =>
    sql.begin(async (tx) => {
      await tx`SET LOCAL statement_timeout='10s'`;
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claim.sub',${user},true)`;
      await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({ sub: user, role: "authenticated", is_anonymous: false })},true)`;
      return (
        await tx`SELECT public.save_result_feedback(${session},${tx.json(value)}) AS result`
      )[0].result;
    });
  const first = await save(owner, payload("replay-operation"));
  const replay = await save(owner, payload("replay-operation"));
  assert.equal(first.id, replay.id);
  assert.equal(replay.replayed, true);
  await assert.rejects(save(owner, { ...payload("replay-operation"), accuracy: "mixed" }), {
    code: "23505",
  });
  await assert.rejects(save(other, payload("denied-operation")), { code: "42501" });
  await save(owner, payload("second-version-operation", 2));
  await sql.begin("READ ONLY", async (tx) => {
    await tx`SET LOCAL statement_timeout='10s'`;
    assert.deepEqual(
      (
        await tx`SELECT result_version,count(*)::int AS n FROM public.result_feedback WHERE session_id=${session} GROUP BY result_version ORDER BY result_version`
      ).map((r) => [r.result_version, r.n]),
      [
        [1, 1],
        [2, 1],
      ],
    );
    assert.equal(
      (await tx`SELECT count(*)::int AS n FROM public.musicdna_learning_outbox`)[0].n,
      0,
    );
    assert.deepEqual(
      (
        await tx`SELECT content FROM public.session_results WHERE session_id=${session} ORDER BY version`
      ).map((r) => r.content),
      [{}, {}],
    );
  });
  // With every external parent present, the original eligibility/contrast
  // guards must still reject deliberately invalid fixture scores. Each test
  // transaction rolls back; no placeholder enters the replayed catalog.
  const receipt = JSON.parse(source("docs/musicdna/ab75-migration-receipts.json"));
  let protectedBatches = 0;
  for (const row of receipt.catalog_replay_guards) {
    const migration = source(row.migration_path);
    const raw = source(row.original_path);
    let ids;
    if (migration.includes("coverage_batch")) {
      ids = Array.from(
        raw.matchAll(/\('([0-9a-f-]{36})','([0-9a-f-]{36})','([0-9a-f-]{36})',ARRAY/g),
      ).flatMap((m) => [m[2], m[3]]);
    } else {
      const required = migration.split(" AS required(id)")[0];
      ids = Array.from(required.matchAll(/'([0-9a-f-]{36})'::uuid/g)).map((m) => m[1]);
    }
    assert.ok(ids.length > 0);
    await assert.rejects(
      sql.begin(async (tx) => {
        for (const id of new Set(ids))
          await tx`INSERT INTO public.songs(id,title,artist,lane,primary_lane,active)
        VALUES(${id},${"AB75 fixture " + id},${"AB75 artist " + id},'general','general',false) ON CONFLICT(id) DO NOTHING`;
        await tx.unsafe(migration.replace(/^BEGIN;\s*/, "").replace(/COMMIT;\s*$/, ""));
        throw new Error("Invalid catalog prerequisites bypassed the original validation");
      }),
      (error) => ["P0001", "23514"].includes(error.code),
    );
    protectedBatches++;
  }
  console.log(
    JSON.stringify({
      check: "clean-migration-replay",
      migrations: applied,
      catalog_validation_guards_preserved: protectedBatches,
      catalog_batches_unavailable: notices.length,
      permission_checks: "passed",
      feedback_replay_conflict_owner_version_checks: "passed",
      learning_capture: "off",
      database: "disposable loopback PostgreSQL",
    }),
  );
} finally {
  await sql.unsafe("ROLLBACK").catch(() => {});
  await sql.end();
  await admin.unsafe(`DROP DATABASE "${name}"`);
  await admin.end();
}
