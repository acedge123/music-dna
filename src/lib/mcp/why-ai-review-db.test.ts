import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
let db: PGlite;
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  reader: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  reviewer: "00000000-0000-4000-8000-000000000004",
  user: "00000000-0000-4000-8000-000000000005",
  guest: "00000000-0000-4000-8000-000000000006",
};
const song = "10000000-0000-4000-8000-000000000001",
  why = "20000000-0000-4000-8000-000000000001";
const uuid = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function actor<T = Record<string, unknown>>(
  who: keyof typeof ids,
  sql: string,
  params: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec("SET LOCAL ROLE authenticated");
    await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [ids[who]]);
    return (await tx.query<T>(sql, params)).rows;
  });
}
async function version() {
  return (
    await db.query<{ version: string }>(
      "SELECT musicdna_admin_mcp.why_version(to_jsonb(w)) version FROM song_trait_explanations w WHERE id=$1",
      [why],
    )
  ).rows[0].version;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,is_anonymous boolean DEFAULT false);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TYPE app_role AS ENUM('admin','user'); CREATE TABLE user_roles(user_id uuid,role app_role);
 CREATE FUNCTION has_role(_user_id uuid,_role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user_id AND role=_role)$$;
 CREATE TABLE songs(id uuid PRIMARY KEY,title text,artist text,year integer,primary_lane text,sub_lane text,active boolean DEFAULT true,movement integer,atmosphere integer,immersion integer,scale integer,community integer,perspective integer,confidence integer,tension integer,texture integer,transformation integer,scoring_version text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE song_artwork(song_id uuid PRIMARY KEY,release_title text,display_enabled boolean,match_status text,rights_status text,rights_reference text,image_url text);
 GRANT SELECT ON song_artwork TO authenticated;
 CREATE TABLE pairings(id uuid PRIMARY KEY,song_a_id uuid,song_b_id uuid);
 CREATE TABLE axes(key text PRIMARY KEY,low_pole text,high_pole text,tradeoff_sentence text,analyst_label text);
 CREATE TABLE song_trait_explanations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),song_id uuid REFERENCES songs(id),axis text,score_at_write smallint,audible_evidence text,interpretation text,confidence text DEFAULT 'pending_review',status text DEFAULT 'pending_review',scoring_version text,drafted_by text DEFAULT 'sol',review_note text,reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 GRANT SELECT ON songs,pairings,axes,song_trait_explanations TO authenticated;
 ALTER TABLE song_trait_explanations ENABLE ROW LEVEL SECURITY;
 CREATE POLICY why_legacy_read ON song_trait_explanations FOR SELECT TO authenticated USING(status='approved' OR has_role(auth.uid(),'admin'));
 INSERT INTO songs(id,title,artist,year,primary_lane,texture,scoring_version) VALUES('${song}','Burn, Burn, Burn','Zach Bryan',2022,'country',90,'score-v1');
 INSERT INTO axes VALUES('texture','rawness','refinement','How controlled is the sound?','Texture');
 INSERT INTO song_trait_explanations(id,song_id,axis,score_at_write,audible_evidence,interpretation,status,scoring_version) VALUES('${why}','${song}','texture',90,'A close-miked vocal and acoustic guitar.','A man unravelling, choosing to reveal his insecurities.','approved','score-v1');`);
  for (const [who, id] of Object.entries(ids))
    await db.query("INSERT INTO auth.users(id,is_anonymous) VALUES($1,$2)", [id, who === "guest"]);
  await db.query("INSERT INTO user_roles VALUES($1,'admin')", [ids.admin]);
  await db.exec(
    readFileSync("supabase/migrations/20261119040256_musicdna_admin_mcp_catalog.sql", "utf8"),
  );
  for (const [who, role] of [
    ["reader", "catalog_reader"],
    ["editor", "catalog_editor"],
    ["reviewer", "reviewer"],
  ] as const)
    await db.query("INSERT INTO musicdna_mcp_grants(user_id,role,granted_by) VALUES($1,$2,$3)", [
      ids[who],
      role,
      ids.admin,
    ]);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261119050947_3adcdaba-b292-4647-98ae-c258095cd09f.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261119052334_musicdna_saved_why_ai_reviews.sql", "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function context() {
  return (await actor("reviewer", "SELECT musicdna_mcp_why_review_context($1) r", [why]))[0].r as {
    version: string;
    review_context_version: string;
  };
}
async function request(
  key = 1,
  who: keyof typeof ids = "reviewer",
  c?: Awaited<ReturnType<typeof context>>,
) {
  const current = c ?? (await context());
  return (
    await actor(who, "SELECT musicdna_mcp_request_why_ai_review($1,$2,$3,$4,true) r", [
      why,
      current.version,
      current.review_context_version,
      uuid(key),
    ])
  )[0].r as { request_id: string; replayed: boolean };
}
async function server(sql: string, params: unknown[]) {
  return db.transaction(async (tx) => {
    await tx.exec("SET LOCAL ROLE service_role");
    return (await tx.query<{ r: unknown }>(sql, params)).rows;
  });
}
async function claim(id: string) {
  return (
    await server("SELECT musicdna_server_claim_why_ai_review($1,$2,$3) r", [
      id,
      ids.reviewer,
      JSON.stringify({
        configured: true,
        critic_reviewer: "existing-reviewer",
        provider: "openai",
      }),
    ])
  )[0].r;
}
const result = {
  axis: "texture",
  verdict: "fail",
  note: "An exact recording claim needs verification.",
  score_disputed: true,
  suggested_score: null,
  reason: "No justified numeric replacement without listening.",
};
async function finish(
  id: string,
  finding: unknown = result,
  state = "completed",
  error: string | null = null,
) {
  return server("SELECT musicdna_server_finish_why_ai_review($1,$2,$3,$4,$5)", [
    id,
    state,
    finding === null ? null : JSON.stringify(finding),
    JSON.stringify({ model: "existing-reviewer", input_tokens: null, output_tokens: null }),
    error,
  ]);
}
async function review(id: string) {
  return (await actor("reader", "SELECT * FROM musicdna_mcp_why_ai_reviews WHERE id=$1", [id]))[0];
}
beforeEach(async () => {
  await db.exec(
    "TRUNCATE musicdna_song_why_ai_reviews; UPDATE songs SET texture=90,title='Burn, Burn, Burn',primary_lane='country'; UPDATE axes SET tradeoff_sentence='How controlled is the sound?'; UPDATE song_trait_explanations SET status='approved',audible_evidence='A close-miked vocal and acoustic guitar.',score_disputed=false,model_review_verdict=null; UPDATE musicdna_mcp_grants SET revoked_at=NULL;",
  );
});
describe("saved Why AI-review authorization and immutable audit boundary", () => {
  it("separates reader/editor/user/guest access from paid requests, and denies fabricated completion", async () => {
    for (const who of ["reader", "editor", "user", "guest"] as const)
      await expect(request(1, who)).rejects.toThrow("MCP_FORBIDDEN");
    for (const who of ["reader", "reviewer", "admin"] as const) {
      await expect(
        actor(who, "SELECT musicdna_server_claim_why_ai_review($1,$2,$3)", [
          uuid(1),
          ids[who],
          "{}",
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        actor(who, "SELECT musicdna_server_finish_why_ai_review($1,'completed',$2,'{}',NULL)", [
          uuid(1),
          JSON.stringify(result),
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        actor(who, "INSERT INTO musicdna_song_why_ai_reviews(explanation_id) VALUES($1)", [why]),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("SET LOCAL ROLE anon");
        await tx.query("SELECT musicdna_mcp_why_review_context($1)", [why]);
      }),
    ).rejects.toThrow(/permission denied/);
  });
  it("requires explicit paid confirmation", async () => {
    const c = await context();
    await expect(
      actor("reviewer", "SELECT musicdna_mcp_request_why_ai_review($1,$2,$3,$4,false)", [
        why,
        c.version,
        c.review_context_version,
        uuid(1),
      ]),
    ).rejects.toThrow("MCP_INVALID_INPUT");
  });
  it("replays duplicate submissions and conflicts on altered version/context", async () => {
    const c = await context(),
      a = await request(1, "reviewer", c),
      b = await request(1, "reviewer", c);
    expect(b).toEqual({ ...a, replayed: true });
    await expect(request(1, "reviewer", { ...c, review_context_version: "wrong" })).rejects.toThrow(
      "MCP_IDEMPOTENCY_CONFLICT",
    );
    await db.exec("UPDATE songs SET texture=12");
    // Lost response is recoverable even though the current catalog has moved.
    expect(await request(1, "reviewer", c)).toEqual({ ...a, replayed: true });
    await expect(request(2, "reviewer", c)).rejects.toThrow("MCP_STALE_VERSION");
  });
  it("does not mix replay keys or consent across different callers", async () => {
    const c = await context();
    const a = await request(1, "reviewer", c),
      b = await request(1, "admin", c);
    expect(a.request_id).not.toBe(b.request_id);
    expect(a.replayed).toBe(false);
    expect(b.replayed).toBe(false);
  });
  it("allows at most one claim for concurrent delivery of the same request", async () => {
    const a = await request();
    const claims = await Promise.all([claim(a.request_id), claim(a.request_id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
  it("rechecks reviewer permission before spending", async () => {
    const a = await request();
    await db.exec("UPDATE musicdna_mcp_grants SET revoked_at=now() WHERE role='reviewer'");
    expect(await claim(a.request_id)).toBeNull();
    expect(await review(a.request_id)).toMatchObject({
      state: "failed",
      error_code: "PERMISSION_REVOKED",
    });
  });
  it("declines to call if context changes before the claim", async () => {
    const a = await request();
    await db.exec("UPDATE axes SET tradeoff_sentence='A revised definition'");
    expect(await claim(a.request_id)).toBeNull();
    expect(await review(a.request_id)).toMatchObject({
      state: "failed",
      error_code: "STALE_BEFORE_CALL",
      stale_result: true,
    });
  });
  it("retains a null suggestion honestly and cannot overwrite a completed verdict", async () => {
    const a = await request();
    await claim(a.request_id);
    await finish(a.request_id);
    expect(await review(a.request_id)).toMatchObject({
      result,
      suggestion_unavailable: true,
      stale_result: false,
    });
    await expect(finish(a.request_id, { ...result, suggested_score: 30 })).rejects.toThrow(
      "MCP_IDEMPOTENCY_CONFLICT",
    );
  });
  it.each([101, 10.5, "25"])("rejects invalid suggested score %s", async (n) => {
    const a = await request();
    await claim(a.request_id);
    await expect(finish(a.request_id, { ...result, suggested_score: n })).rejects.toThrow(
      "MCP_INVALID_INPUT",
    );
  });
  it("does not allow undisputed replacement scores or wrong-attribute results", async () => {
    const a = await request();
    await claim(a.request_id);
    await expect(
      finish(a.request_id, { ...result, score_disputed: false, suggested_score: 25 }),
    ).rejects.toThrow("MCP_INVALID_INPUT");
    await expect(finish(a.request_id, { ...result, axis: "confidence" })).rejects.toThrow(
      "MCP_INVALID_INPUT",
    );
  });
  it("binds completion to the old explanation when it changes during the call", async () => {
    const a = await request();
    await claim(a.request_id);
    await db.exec(
      "UPDATE song_trait_explanations SET audible_evidence='Changed by a human during review'",
    );
    await finish(a.request_id);
    expect(await review(a.request_id)).toMatchObject({
      state: "completed",
      stale_result: true,
      stale_at_completion: true,
      snapshot: { explanation: { audible_evidence: "A close-miked vocal and acoustic guitar." } },
    });
  });
  it("distinguishes an already-stale explanation from a later-stale review result", async () => {
    await db.exec("UPDATE songs SET texture=25");
    const a = await request();
    await claim(a.request_id);
    await finish(a.request_id);
    expect(await review(a.request_id)).toMatchObject({
      stale_explanation: true,
      stale_result: false,
      snapshot: { attribute: { current_score: 25, score_at_write: 90 } },
    });
    await db.exec("UPDATE songs SET primary_lane='alternative'");
    expect(await review(a.request_id)).toMatchObject({ stale_result: true });
  });
  it("retains failures/expired ambiguity without inventing findings or starting a retry", async () => {
    const a = await request();
    await claim(a.request_id);
    await finish(a.request_id, null, "ambiguous", "PROVIDER_TIMEOUT_OR_UNKNOWN");
    expect(await review(a.request_id)).toMatchObject({ state: "ambiguous", result: null });
    expect(await claim(a.request_id)).toBeNull();
    const b = await request(2);
    await db.query(
      "UPDATE musicdna_song_why_ai_reviews SET created_at=now()-interval '2 minutes' WHERE id=$1",
      [b.request_id],
    );
    expect(await review(b.request_id)).toMatchObject({
      display_state: "expired_or_ambiguous",
      result: null,
    });
  });
  it("leaves approved explanations, historical reviewer, catalog and frozen listener data byte-for-byte unchanged", async () => {
    await db.exec(
      "CREATE TABLE IF NOT EXISTS frozen_listener_data(kind text, evidence jsonb); TRUNCATE frozen_listener_data; INSERT INTO frozen_listener_data VALUES('choices','{\"texture\":90}'),('reading','{\"text\":\"saved\"}'),('routing','{\"pairing\":\"frozen\"}');",
    );
    async function snapshot() {
      return (
        await db.query<{ s: unknown }>(
          `SELECT jsonb_build_object('songs',(SELECT jsonb_agg(to_jsonb(s)) FROM songs s),'whys',(SELECT jsonb_agg(to_jsonb(w)) FROM song_trait_explanations w),'history',(SELECT jsonb_agg(to_jsonb(h)) FROM musicdna_song_why_history h),'frozen',(SELECT jsonb_agg(to_jsonb(f)) FROM frozen_listener_data f)) s`,
        )
      ).rows[0].s;
    }
    const before = await snapshot();
    const a = await request();
    await claim(a.request_id);
    await finish(a.request_id);
    expect(await snapshot()).toEqual(before);
    expect(await actor("reader", "SELECT result FROM musicdna_mcp_why_ai_reviews")).toHaveLength(1);
    expect(await actor("user", "SELECT * FROM musicdna_mcp_why_ai_reviews")).toEqual([]);
  });
  it("excludes disputed/failed/unresolved re-reviews from bulk approval without revoking existing approvals", async () => {
    const a = await request();
    await claim(a.request_id);
    await finish(a.request_id);
    expect(
      (await actor("admin", "SELECT musicdna_mcp_bulk_approve_whys(NULL) r"))[0].r,
    ).toMatchObject({ approved: 0 });
    expect((await db.query("SELECT status FROM song_trait_explanations")).rows[0]).toEqual({
      status: "approved",
    });
    // A new human-edited version can be approved independently; no retroactive association.
    await db.exec("UPDATE song_trait_explanations SET status='pending_review'");
    const b = await request(2);
    await claim(b.request_id);
    await finish(b.request_id);
    expect(
      (await actor("admin", "SELECT musicdna_mcp_bulk_approve_whys(NULL) r"))[0].r,
    ).toMatchObject({ approved: 0, skipped_challenged: 1 });
  });
});
