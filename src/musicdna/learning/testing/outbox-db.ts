import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { requireLearningOutboxDatabase } from "../../../../scripts/require-learning-outbox-db.mjs";

export const OWNER = "10000000-0000-4000-8000-000000000001";
export const OTHER = "10000000-0000-4000-8000-000000000002";
export const SESSION = "10000000-0000-4000-8000-000000000003";
export const RESULT = "10000000-0000-4000-8000-000000000004";
export const SUBJECT = "s_" + "a".repeat(64);
export const readSourceFile = (path: string) =>
  readFileSync(new URL("../../../../" + path, import.meta.url), "utf8");

export async function createOutboxTestDatabase() {
  const base = requireLearningOutboxDatabase();
  const admin = postgres(base, { max: 1, onnotice: () => {} });
  const name = "ab45_suite_" + randomUUID().replaceAll("-", "");
  await admin.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(454501)`;
    await tx.unsafe(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ab45_auth_admin') THEN CREATE ROLE ab45_auth_admin; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$`);
  });
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  const url = new URL(base);
  url.pathname = "/" + name;
  const sql = postgres(url.toString(), { max: 20, onnotice: () => {} });
  await sql.unsafe(`
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA auth TO ab45_auth_admin; GRANT SELECT,DELETE ON auth.users TO ab45_auth_admin;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
    CREATE TABLE public.archetypes(id uuid PRIMARY KEY,name text,tagline text,description text);
    CREATE TABLE public.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,completed_at timestamptz,
      share_token text,is_public boolean DEFAULT false,lane text,archetype_id uuid,vector jsonb DEFAULT '{}');
    CREATE TABLE public.session_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid REFERENCES public.sessions ON DELETE CASCADE,user_id uuid,
      version integer,source text,base_version integer,content jsonb,evidence jsonb,self_report jsonb DEFAULT '{}',ledger_version text,policy_version text,engine_version text,created_at timestamptz DEFAULT now(),UNIQUE(session_id,version));
    CREATE TABLE public.result_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid REFERENCES public.sessions ON DELETE CASCADE,user_id uuid,accuracy text,rating smallint,comment text,target text,result_version integer,mutation_id text,most_accurate_sentence text,least_accurate_sentence text,created_at timestamptz DEFAULT now());
    CREATE TABLE public.chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid,user_id uuid,role text,content text,mutation_id text,created_at timestamptz DEFAULT now(),UNIQUE(session_id,mutation_id));
    CREATE TABLE public.event_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,session_id uuid,event_type text,props jsonb,client text);
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.sessions,public.session_results,public.result_feedback,public.chat_messages TO authenticated;
    GRANT ALL ON public.sessions,public.session_results,public.result_feedback,public.chat_messages TO service_role;
    ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_session ON public.sessions TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    ALTER TABLE public.result_feedback ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_feedback ON public.result_feedback TO authenticated USING(user_id=auth.uid());
    ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_result ON public.session_results TO authenticated USING(user_id=auth.uid());
    ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_chat ON public.chat_messages TO authenticated USING(user_id=auth.uid());
  `);
  await sql.unsafe(readSourceFile("docs/musicdna/backend-parity-migration-review.sql"));
  for (const file of [
    "20261107204508_d966703f-803e-4e3a-9142-b55ad004d880.sql",
    "20261107205842_musicdna_learning_outbox.sql",
  ]) {
    await sql.unsafe(readSourceFile("supabase/migrations/" + file));
  }
  await sql`INSERT INTO auth.users VALUES(${OWNER}),(${OTHER})`;
  return {
    sql,
    async close() {
      await sql.end();
      await admin.unsafe(`DROP DATABASE "${name}"`);
      await admin.end();
    },
  };
}
