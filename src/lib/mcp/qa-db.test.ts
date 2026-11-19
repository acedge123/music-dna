import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
let db: PGlite;
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
const sa = "10000000-0000-4000-8000-000000000001",
  sb = "10000000-0000-4000-8000-000000000002",
  attempt = "20000000-0000-4000-8000-000000000001";
async function asCaller(user: string, sql: string) {
  return db.transaction(async (tx) => {
    await tx.exec("SET LOCAL ROLE authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    return (await tx.query<Record<string, unknown>>(sql)).rows;
  });
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA musicdna_admin_mcp;
 GRANT USAGE ON SCHEMA public,auth,musicdna_admin_mcp TO authenticated;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,is_anonymous boolean DEFAULT false);
 INSERT INTO auth.users VALUES('${a}','SECRET_OWNER_EMAIL',false),('${b}','SECRET_OTHER_EMAIL',false);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION public.has_role(_user_id uuid,_role text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
 CREATE TABLE songs(id uuid PRIMARY KEY,title text,artist text,year integer,primary_lane text,sub_lane text,active boolean,movement integer,atmosphere integer,immersion integer,scale integer,community integer,perspective integer,confidence integer,tension integer,texture integer,transformation integer,scoring_version text,created_at timestamptz,updated_at timestamptz);
 CREATE TABLE song_artwork(song_id uuid PRIMARY KEY,release_title text,display_enabled boolean,match_status text,rights_status text,rights_reference text,image_url text);
 CREATE TABLE pairings(id uuid PRIMARY KEY,song_a_id uuid,song_b_id uuid);
 CREATE TABLE axes(key text PRIMARY KEY,low_pole text,high_pole text,tradeoff_sentence text,analyst_label text);
 CREATE TABLE song_trait_explanations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),song_id uuid REFERENCES songs(id),axis text,score_at_write smallint,audible_evidence text,interpretation text,confidence text,status text,scoring_version text,drafted_by text,review_note text,reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 ALTER TABLE song_trait_explanations ENABLE ROW LEVEL SECURITY;
 CREATE TABLE sessions(id uuid PRIMARY KEY,user_id uuid,started_at timestamptz DEFAULT now(),completed_at timestamptz,created_at timestamptz DEFAULT now(),mode text,decade integer,lane text,parent_session_id uuid,share_token text);
 CREATE TABLE interview_qa_sessions(session_id uuid,created_by uuid);
 CREATE TABLE choices(id uuid DEFAULT gen_random_uuid(),session_id uuid,pairing_id uuid,chosen_song_id uuid,rejected_song_id uuid,created_at timestamptz,ms_to_decide integer,evidence jsonb);
 CREATE TABLE event_log(id uuid DEFAULT gen_random_uuid(),session_id uuid,event_type text,pairing_id uuid,choice_id uuid,created_at timestamptz,response_time_ms integer,client text,props jsonb);
 CREATE TABLE session_results(id uuid DEFAULT gen_random_uuid(),session_id uuid,version integer,source text,base_version integer,ledger_version text,policy_version text,engine_version text,created_at timestamptz,content jsonb,self_report jsonb);
 CREATE TABLE critic_quality_attempts(id uuid PRIMARY KEY,session_id uuid,stage text,result_version integer,writer_version text,reviewer_version text,status text,created_at timestamptz,rejection_reason text,calls jsonb,review_checks jsonb,decision_trace jsonb,output_text text,output_fingerprint text,evidence_context jsonb);
 CREATE TABLE critic_quality_reviews(id uuid DEFAULT gen_random_uuid(),attempt_id uuid,rubric_version text,evaluator_type text,inference_accuracy integer,musical_specificity integer,prose_originality integer,conversational_relevance integer,entertainment integer,created_at timestamptz);
 CREATE TABLE llm_calls(id uuid DEFAULT gen_random_uuid(),session_id uuid,role text,model text,prompt_version text,status text,latency_ms integer,created_at timestamptz,error_message text,input_summary jsonb,output jsonb);
 CREATE TABLE musicdna_learning_enrollments(result_id uuid,session_id uuid,data_class text);
 CREATE TABLE musicdna_learning_outbox(observation_id uuid,result_id uuid,environment text,state text,created_at timestamptz,source_key text,canonical_envelope text,projection jsonb);
 CREATE TABLE musicdna_learning_dispatch_jobs(work_id uuid,kind text,source_key text,environment text,state text,attempts integer,replay_count integer,completed_at timestamptz,receipt_id uuid,lease_token uuid);
 INSERT INTO sessions(id,user_id,share_token) VALUES('${sa}','${a}','SECRET_SHARE'),('${sb}','${b}','SECRET_OTHER_SHARE');
 INSERT INTO event_log(session_id,event_type,props) VALUES('${sa}','self_report','{"text":"SECRET_PERSONAL_MESSAGE"}'),('${sa}','choice_scored','{"answered":1,"message":"SECRET_PERSONAL_MESSAGE"}');
 INSERT INTO event_log(session_id,event_type,props) VALUES('${sa}','read_shown','{"result":{"thesis":"Approved history beat","private_context":"SECRET_PERSONAL_MESSAGE"}}');
 INSERT INTO session_results(session_id,version,content,self_report) VALUES('${sa}',1,'{"synthesis":"Saved accepted reading","self_report":"SECRET_PERSONAL_MESSAGE"}','{"text":"SECRET_PERSONAL_MESSAGE"}');
 INSERT INTO critic_quality_attempts(id,session_id,stage,writer_version,reviewer_version,status,calls,review_checks,decision_trace,output_text,evidence_context) VALUES('${attempt}','${sa}','reveal','w1','r1','ok','[{"phase":"writer","status":"ok","model":"model-a","latency_ms":123,"input_tokens":null,"output_tokens":null,"provider":"openai","error":"SECRET_PROVIDER_ERROR"}]','{"grounded":true,"raw":"SECRET_REVIEW_PROSE"}','{"raw":"SECRET_RAW_TRACE"}','SECRET_LOCAL_PROSE','{"self_report":"SECRET_PERSONAL_MESSAGE"}');
 `);
  // Apply BOTH real new migrations; QA authorization uses the Phase 1 grants/function, not a stub.
  await db.exec(
    readFileSync("supabase/migrations/20261119011822_musicdna_admin_mcp_catalog.sql", "utf8"),
  );
  await db.query(
    "INSERT INTO musicdna_mcp_grants(user_id,role,granted_by) VALUES($1,'qa_auditor',$1),($2,'catalog_reader',$1)",
    [a, b],
  );
  await db.exec(
    readFileSync("supabase/migrations/20261119020120_musicdna_admin_mcp_qa.sql", "utf8"),
  );
});
afterAll(() => db.close());
it("requires QA role and ownership; admin-like catalog membership alone is not a scope", async () => {
  expect(await asCaller(a, "select id from musicdna_mcp_qa_sessions")).toEqual([{ id: sa }]);
  expect(await asCaller(b, "select id from musicdna_mcp_qa_sessions")).toEqual([]);
  expect(await asCaller(a, `select id from musicdna_mcp_qa_sessions where id='${sb}'`)).toEqual([]);
});
it("does not export local prose, raw trace, profiles, private messages, provider errors or share credentials", async () => {
  for (const view of [
    "sessions",
    "choices",
    "events",
    "readings",
    "attempts",
    "reviews",
    "calls",
  ]) {
    const rows = await asCaller(a, `select * from musicdna_mcp_qa_${view}`);
    expect(JSON.stringify(rows)).not.toContain("SECRET");
  }
  const row = (await asCaller(a, "select * from musicdna_mcp_qa_attempts"))[0];
  expect(row.numeric_review_checks).toEqual({ grounded: true });
  expect(row.calls).toMatchObject([
    { phase: "writer", model: "model-a", latency_ms: 123, cost_status: "unavailable" },
  ]);
  expect(
    (await asCaller(a, "select * from musicdna_mcp_qa_readings"))[0].frozen_content,
  ).toMatchObject({ synthesis: "Saved accepted reading" });
});
it("explicit scopes expire/revoke and changing role immediately removes all diagnostic access", async () => {
  await db.query(
    "insert into musicdna_mcp_qa_scopes(user_id,session_id,approved_by,expires_at) values($1,$2,$1,now()+interval '1 hour')",
    [a, sb],
  );
  expect(await asCaller(a, "select id from musicdna_mcp_qa_sessions order by id")).toEqual([
    { id: sa },
    { id: sb },
  ]);
  await db.exec("update musicdna_mcp_qa_scopes set expires_at=now()-interval '1 second'");
  expect(await asCaller(a, "select id from musicdna_mcp_qa_sessions")).toEqual([{ id: sa }]);
  await db.exec("update musicdna_mcp_grants set revoked_at=now() where role='qa_auditor'");
  expect(await asCaller(a, "select id from musicdna_mcp_qa_sessions")).toEqual([]);
  expect(await asCaller(a, "select id from musicdna_mcp_qa_attempts")).toEqual([]);
  await db.exec("update musicdna_mcp_grants set revoked_at=null where role='qa_auditor'");
});
it("denies ordinary caller mutations and anonymous diagnostics", async () => {
  for (const table of [
    "musicdna_mcp_qa_scopes",
    "musicdna_mcp_qa_attempts",
    "musicdna_mcp_qa_sessions",
  ])
    await expect(asCaller(a, `DELETE FROM ${table}`)).rejects.toThrow(/permission denied/);
  await expect(
    db.transaction(async (tx) => {
      await tx.exec("SET LOCAL ROLE anon");
      await tx.query("select * from musicdna_mcp_qa_sessions");
    }),
  ).rejects.toThrow(/permission denied/);
});

it("records owner-QA paint receipts idempotently, blocks changed payloads/scoped strangers and stores no raw line prose", async () => {
  await db.query("insert into interview_qa_sessions(session_id,created_by) values($1,$2)", [sa, a]);
  const obs = "30000000-0000-4000-8000-000000000001",
    wait = "40000000-0000-4000-8000-000000000001",
    stamp = new Date().toISOString();
  const call = (duration: number, user = a, sid = sa) =>
    asCaller(
      user,
      `select musicdna_mcp_record_quip('${obs}','${sid}','${wait}','${"a".repeat(64)}','six-pick-overtime-v1',0,1,'post_pick_wait','${stamp}',${duration},25,'changed_or_unmounted') result`,
    );
  expect((await call(2400))[0].result).toEqual({ recorded: true, replayed: false });
  expect((await call(2400))[0].result).toEqual({ recorded: true, replayed: true });
  await expect(call(2450)).rejects.toThrow("MCP_IDEMPOTENCY_CONFLICT");
  await expect(call(2400, b)).rejects.toThrow("MCP_FORBIDDEN");
  await expect(call(2400, a, sb)).rejects.toThrow("MCP_FORBIDDEN");
  const rows = await asCaller(a, "select * from musicdna_mcp_qa_quips");
  expect(rows).toHaveLength(1);
  expect(rows[0].duration_ms).toBe(2400);
  expect(rows[0]).not.toHaveProperty("owner_id");
  expect(rows[0]).not.toHaveProperty("line");
  await expect(asCaller(a, "delete from musicdna_qa_quip_observations")).rejects.toThrow(
    /permission denied/,
  );
});
