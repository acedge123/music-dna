import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
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
async function propose(key: number, base?: string) {
  return (
    await actor("editor", "SELECT musicdna_mcp_submit_why_revision($1,$2,$3,$4,$5,$6,$7) result", [
      why,
      base ?? (await version()),
      "Dry acoustic guitar and a clear vocal phrase.",
      "The arrangement keeps the singer close to the listener.",
      "Remove unsupported claims about the artist intention.",
      JSON.stringify([
        { kind: "text_inference", reference: why, note: "Review the actual wording." },
      ]),
      uuid(key),
    ])
  )[0].result as Record<string, unknown>;
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
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("catalog MCP native privacy, replay, history and export boundaries", () => {
  it("denies anonymous RPC execution", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("SET LOCAL ROLE anon");
        return tx.query("SELECT musicdna_mcp_catalog_summary()");
      }),
    ).rejects.toThrow(/permission denied/);
  });
  it("does not infer roles from an authenticated or anonymous-Auth account", async () => {
    for (const who of ["user", "guest"] as const) {
      expect((await actor(who, "SELECT musicdna_mcp_access() result"))[0].result).toEqual({
        catalog_read: false,
        catalog_propose: false,
        catalog_review: false,
        qa_read: false,
      });
      await expect(actor(who, "SELECT musicdna_mcp_catalog_summary()")).rejects.toThrow(
        "MCP_FORBIDDEN",
      );
    }
  });
  it("allows catalog reader independently of sensitive QA/editor permissions", async () => {
    const access = (await actor("reader", "SELECT musicdna_mcp_access() result"))[0]
      .result as Record<string, unknown>;
    expect(access).toEqual({
      catalog_read: true,
      catalog_propose: false,
      catalog_review: false,
      qa_read: false,
    });
    expect(await actor("reader", "SELECT * FROM musicdna_mcp_whys")).toHaveLength(1);
    expect(
      (await actor("reader", "SELECT musicdna_mcp_catalog_summary() result"))[0].result,
    ).toMatchObject({ why_status: { approved: 1 } });
  });
  it("denies direct browser writes to proposals/history/exports and role elevation", async () => {
    for (const table of [
      "musicdna_mcp_grants",
      "musicdna_song_why_history",
      "musicdna_song_why_proposals",
      "musicdna_mcp_exports",
      "musicdna_song_why_audit_findings",
    ])
      await expect(actor("reader", `DELETE FROM ${table}`)).rejects.toThrow(/permission denied/);
  });
  it("a revision is a draft and cannot mutate approved content", async () => {
    const original = (await db.query("SELECT * FROM song_trait_explanations WHERE id=$1", [why]))
      .rows;
    const p = await propose(1);
    expect(p).toMatchObject({ status: "pending_review", version: 1, replayed: false });
    expect(
      (await db.query("SELECT * FROM song_trait_explanations WHERE id=$1", [why])).rows,
    ).toEqual(original);
    expect(
      (await db.query("SELECT count(*) n FROM musicdna_catalog_audit_events")).rows[0],
    ).toEqual({ n: 1 });
  });
  it("exact proposal replay converges and changed-ID payload conflicts", async () => {
    const p = await propose(1);
    expect(p.replayed).toBe(true);
    await expect(
      actor("editor", "SELECT musicdna_mcp_submit_why_revision($1,$2,$3,$4,$5,$6,$7)", [
        why,
        await version(),
        "Different proposed audible content.",
        "Different proposed interpretation.",
        "Different reason for the correction.",
        "[]",
        uuid(1),
      ]),
    ).rejects.toThrow("MCP_IDEMPOTENCY_CONFLICT");
    expect((await db.query("SELECT count(*) n FROM musicdna_song_why_proposals")).rows[0]).toEqual({
      n: 1,
    });
  });
  it("rejects a stale base and a reader proposal", async () => {
    await expect(propose(2, "why-v1:stale")).rejects.toThrow("MCP_STALE_VERSION");
    await expect(
      actor("reader", "SELECT musicdna_mcp_submit_why_revision($1,$2,$3,$4,$5,$6,$7)", [
        why,
        await version(),
        "Some proposed audible evidence.",
        "Some proposed interpretation.",
        "An adequately long reason.",
        "[]",
        uuid(2),
      ]),
    ).rejects.toThrow("MCP_FORBIDDEN");
  });
  it("requires a separate current reviewer and exact proposal version", async () => {
    const p = await propose(3);
    await expect(
      actor("editor", "SELECT musicdna_mcp_review_why_revision($1,1,$2,$3)", [
        p.id,
        "approved",
        uuid(30),
      ]),
    ).rejects.toThrow("MCP_FORBIDDEN");
    await expect(
      actor("reviewer", "SELECT musicdna_mcp_review_why_revision($1,99,$2,$3)", [
        p.id,
        "approved",
        uuid(30),
      ]),
    ).rejects.toThrow("MCP_STALE_VERSION");
    await db.query("UPDATE songs SET texture=89 WHERE id=$1", [song]);
    await expect(
      actor("reviewer", "SELECT musicdna_mcp_review_why_revision($1,1,$2,$3)", [
        p.id,
        "approved",
        uuid(30),
      ]),
    ).rejects.toThrow("MCP_STALE_SCORE");
    await db.query("UPDATE songs SET texture=90 WHERE id=$1", [song]);
  });
  it("human approval preserves the before image; replay is stable and cannot be repurposed", async () => {
    const p = await propose(4);
    const v = await actor(
      "reviewer",
      "SELECT musicdna_mcp_review_why_revision($1,1,$2,$3) result",
      [p.id, "approved", uuid(40)],
    );
    expect(v[0].result).toMatchObject({ status: "approved", version: 2, replayed: false });
    expect(
      (
        await actor("reviewer", "SELECT musicdna_mcp_review_why_revision($1,1,$2,$3) result", [
          p.id,
          "approved",
          uuid(40),
        ])
      )[0].result,
    ).toMatchObject({ replayed: true });
    await expect(
      actor("reviewer", "SELECT musicdna_mcp_review_why_revision($1,1,$2,$3)", [
        p.id,
        "rejected",
        uuid(40),
      ]),
    ).rejects.toThrow("MCP_IDEMPOTENCY_CONFLICT");
    const history = (
      await actor("reader", "SELECT snapshot,recording_kind FROM musicdna_song_why_history")
    ).map((x) => x.snapshot as Record<string, unknown>);
    expect(history.some((x) => String(x.interpretation).includes("unravelling"))).toBe(true);
    expect(
      history.some(
        (x) => x.interpretation === "The arrangement keeps the singer close to the listener.",
      ),
    ).toBe(true);
    expect(history).toHaveLength(2);
    const current = (
      await db.query<{ drafted_by: string; review_note: string }>(
        "select drafted_by,review_note from song_trait_explanations where id=$1",
        [why],
      )
    ).rows[0];
    expect(current.drafted_by).toBe("mcp_revision");
    expect(current.review_note).toContain(
      "Earlier model review applies only to the previous version",
    );
  });
  it("exports every saved status without Data API row truncation", async () => {
    await db.query(
      "INSERT INTO song_trait_explanations(song_id,axis,score_at_write,audible_evidence,interpretation,status) SELECT $1,'texture',90,'Complete evidence text number '||n,'Complete interpretation number '||n,CASE WHEN n%2=0 THEN 'rejected' ELSE 'pending_review' END FROM generate_series(1,1005)n",
      [song],
    );
    const job = (
      await actor("reader", "SELECT musicdna_mcp_export('start',$1,'{}','json') result", [uuid(50)])
    )[0].result as Record<string, unknown>;
    expect(job.state).toBe("queued");
    const ready = (
      await actor("reader", "SELECT musicdna_mcp_export('status',NULL,'{}','json',$1) result", [
        job.id,
      ])
    )[0].result as Record<string, unknown>;
    expect(ready).toMatchObject({ state: "ready", total_record_count: 1006, export_count: 1006 });
    const downloaded = (
      await actor("reader", "SELECT musicdna_mcp_export('download',NULL,'{}','json',$1) result", [
        job.id,
      ])
    )[0].result as Record<string, unknown>;
    expect(downloaded.records).toHaveLength(1006);
    const paged: unknown[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = (
        await actor(
          "reader",
          "SELECT musicdna_mcp_export('download_page',NULL,'{}','json',$1,$2,25) result",
          [job.id, offset],
        )
      )[0].result as { records: unknown[]; next_offset: number | null; offset: number };
      expect(page.offset).toBe(offset);
      paged.push(...page.records);
      offset = page.next_offset;
    }
    expect(paged).toEqual(downloaded.records);
    expect(
      (downloaded.records as { explanation: { audible_evidence: string } }[]).some(
        (x) => x.explanation.audible_evidence === "Complete evidence text number 1005",
      ),
    ).toBe(true);
    await expect(
      actor("admin", "SELECT musicdna_mcp_export('download',NULL,'{}','json',$1)", [job.id]),
    ).rejects.toThrow("MCP_NOT_FOUND");
    await db.query(
      "UPDATE musicdna_mcp_exports SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [job.id],
    );
    await expect(
      actor("reader", "SELECT musicdna_mcp_export('download',NULL,'{}','json',$1)", [job.id]),
    ).rejects.toThrow("MCP_EXPORT_EXPIRED");
  });
  it("checks current role revocation on every read and download", async () => {
    await db.query("UPDATE musicdna_mcp_grants SET revoked_at=now() WHERE user_id=$1", [
      ids.reader,
    ]);
    await expect(actor("reader", "SELECT musicdna_mcp_catalog_summary()")).rejects.toThrow(
      "MCP_FORBIDDEN",
    );
    expect(await actor("reader", "SELECT * FROM musicdna_mcp_whys")).toHaveLength(0);
    await db.query("UPDATE musicdna_mcp_grants SET revoked_at=NULL WHERE user_id=$1", [ids.reader]);
  });
  it("text identity matching handles punctuation/diacritics and a title typo without changing catalog data", async () => {
    expect(
      (
        await db.query<{ n: string }>(
          "select musicdna_admin_mcp.search_text('Sigur Rós — Svefn-g-englar') n",
        )
      ).rows[0].n,
    ).toBe("sigur ros svefn g englar");
    const r = (
      await actor("reader", "select musicdna_mcp_search_songs('Burn Burn B urn',20) result")
    )[0].result as { songs: { id: string; match_confidence: number }[] };
    expect(r.songs[0].id).toBe(song);
    expect(r.songs[0].match_confidence).toBeGreaterThan(0.3);
    await expect(actor("user", "select musicdna_mcp_search_songs('Burn',20)")).rejects.toThrow(
      "MCP_FORBIDDEN",
    );
  });
  it("audit findings require real quoted evidence and deduplicate unresolved repeats", async () => {
    const text = (
      await db.query<{ audible_evidence: string }>(
        "select audible_evidence from song_trait_explanations where id=$1",
        [why],
      )
    ).rows[0].audible_evidence;
    const f = [
      {
        severity: "warning",
        category: "verification",
        excerpt: text,
        explanation: "Recording verification is still required.",
        verification_kind: "requires_listening",
      },
    ];
    const call = (key: number, findings: unknown) =>
      actor("editor", "select musicdna_mcp_record_why_findings($1,$2,$3,$4) result", [
        why,
        versionCache,
        JSON.stringify(findings),
        uuid(key),
      ]);
    const versionCache = await version();
    const first = (await call(70, f))[0].result as { ids: string[] };
    expect((await call(70, f))[0].result).toMatchObject({ replayed: true });
    const repeat = (await call(71, f))[0].result as { ids: string[] };
    expect(repeat.ids).toEqual(first.ids);
    await expect(call(72, [{ ...f[0], excerpt: "invented quote" }])).rejects.toThrow(
      "MCP_EVIDENCE_MISMATCH",
    );
    await expect(call(73, [{ ...f[0], excerpt: null }])).rejects.toThrow("MCP_INVALID_INPUT");
  });
  it("does not block deletion of an operator account or delete canonical approved explanations", async () => {
    const before = (await db.query("select count(*) n from song_trait_explanations")).rows[0];
    await db.query("delete from auth.users where id=$1", [ids.editor]);
    expect((await db.query("select count(*) n from song_trait_explanations")).rows[0]).toEqual(
      before,
    );
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*) n from musicdna_song_why_proposals where author_id is null",
        )
      ).rows[0].n,
    ).toBeGreaterThan(0);
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*) n from musicdna_catalog_audit_events where actor_id is null",
        )
      ).rows[0].n,
    ).toBeGreaterThan(0);
  });
});
