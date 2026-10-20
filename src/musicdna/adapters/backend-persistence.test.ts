import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const OWNER = "00000000-0000-0000-0000-000000000001",
  OTHER = "00000000-0000-0000-0000-000000000002",
  SID = "00000000-0000-0000-0000-000000000003";
let db: PGlite;
async function rpc(name: string, args: unknown[]) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(",");
  return (
    await db.query<{ r: Record<string, unknown> }>(
      `SELECT public.${name}(${placeholders}) AS r`,
      args,
    )
  ).rows[0]?.r;
}
const payload = (key: string, version = 1) => ({
  mutation_id: key,
  result_version: version,
  accuracy: "accurate",
  rating: 1,
  comment: "saved",
  target: null,
  most_accurate_sentence: null,
  least_accurate_sentence: null,
});
async function asUser(id: string) {
  await db.exec(
    `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function admin(sql: string) {
  await db.exec("RESET ROLE");
  await db.exec(sql);
  await asUser(OWNER);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE archetypes(id uuid PRIMARY KEY,name text,tagline text,description text);
 CREATE TABLE sessions(id uuid PRIMARY KEY,user_id uuid,completed_at timestamptz,share_token text,is_public boolean DEFAULT false,lane text,archetype_id uuid,vector jsonb DEFAULT '{}');
 CREATE TABLE session_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid,user_id uuid,version int,source text,base_version int,content jsonb,evidence jsonb,self_report jsonb DEFAULT '{}',ledger_version text,policy_version text,engine_version text,created_at timestamptz DEFAULT now(),UNIQUE(session_id,version));
 CREATE TABLE result_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,session_id uuid,accuracy text,rating smallint,comment text,target text,result_version int,mutation_id text,most_accurate_sentence text,least_accurate_sentence text,created_at timestamptz DEFAULT now());
 CREATE UNIQUE INDEX feedback_key ON result_feedback(session_id,mutation_id);
 CREATE TABLE chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid,user_id uuid,role text,content text,mutation_id text,created_at timestamptz DEFAULT now(),UNIQUE(session_id,mutation_id));
 CREATE TABLE event_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,session_id uuid,event_type text,props jsonb,client text);
 GRANT SELECT,INSERT,UPDATE,DELETE ON sessions,session_results,result_feedback,chat_messages TO authenticated;
 ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner_session ON sessions TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
 ALTER TABLE result_feedback ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner_feedback ON result_feedback TO authenticated USING(user_id=auth.uid());
 ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner_chat ON chat_messages TO authenticated USING(user_id=auth.uid());
 INSERT INTO sessions(id,user_id,completed_at,lane) VALUES('${SID}','${OWNER}',now(),'alternative');
 INSERT INTO session_results(session_id,user_id,version,source,content,evidence,ledger_version,policy_version,engine_version)
 VALUES('${SID}','${OWNER}',1,'pairings','{"synthesis":"Frozen original","kept_choosing":[]}','{"axes":[]}','ledger-v2','policy','engine');`);
  // PGlite does not bundle pgcrypto; token entropy is still 128-bit via core UUID.
  await db.exec(await readFile("docs/musicdna/backend-parity-migration-review.sql", "utf8"));
  await asUser(OWNER);
}, 20000);
afterAll(async () => {
  await db.close();
});
describe.sequential(
  "atomic backend persistence (isolated authenticated PostgreSQL, NOT production)",
  () => {
    it("recovers feedback by exact mutation ID and replays without duplicating", async () => {
      const first = await rpc("save_result_feedback", [SID, payload("f1")]);
      const retry = await rpc("save_result_feedback", [SID, payload("f1")]);
      expect(retry).toMatchObject({
        id: first?.id,
        replayed: true,
        mutation_id: "f1",
        result_version: 1,
      });
      expect(
        (await db.query("SELECT * FROM result_feedback WHERE mutation_id='f1'")).rows,
      ).toHaveLength(1);
    });
    it("preserves earlier feedback when a new result version receives feedback", async () => {
      await admin(
        `INSERT INTO session_results(session_id,user_id,version,source,content,evidence,ledger_version,policy_version,engine_version) VALUES('${SID}','${OWNER}',2,'chat_self_report','{"synthesis":"Second"}','{}','l','p','e')`,
      );
      await rpc("save_result_feedback", [SID, payload("f2", 2)]);
      expect(
        (
          await db.query<{ result_version: number }>(
            "SELECT result_version FROM result_feedback ORDER BY result_version",
          )
        ).rows.map((r) => r.result_version),
      ).toEqual([1, 2]);
    });
    it("rejects conflicting reused feedback keys and nonexistent versions without saving", async () => {
      for (const changed of [
        { ...payload("f1"), comment: "changed" },
        { ...payload("f1"), target: "other" },
        payload("f1", 2),
      ])
        await expect(rpc("save_result_feedback", [SID, changed])).rejects.toThrow(
          "MUTATION_CONFLICT",
        );
      await expect(rpc("save_result_feedback", [SID, payload("invalid", 99)])).rejects.toThrow(
        "INVALID_RESULT_VERSION",
      );
      expect(
        (await db.query("SELECT * FROM result_feedback WHERE mutation_id='invalid'")).rows,
      ).toHaveLength(0);
    });
    it("serializes identical retry saves into one committed feedback operation", async () => {
      const results = await Promise.all([
        rpc("save_result_feedback", [SID, payload("race")]),
        rpc("save_result_feedback", [SID, payload("race")]),
      ]);
      expect(results[0]?.id).toEqual(results[1]?.id);
      expect(
        (await db.query("SELECT * FROM result_feedback WHERE mutation_id='race'")).rows,
      ).toHaveLength(1);
    });
    it("recovers interrupted legacy turns and expires abandoned generation leases", async () => {
      await admin(
        `INSERT INTO chat_messages(session_id,user_id,role,content,mutation_id) VALUES('${SID}','${OWNER}','user','recover me','old')`,
      );
      const t = await rpc("begin_chat_turn", [SID, "old", "recover me"]);
      expect(t?.user_message_id).toBeTruthy();
      expect(await rpc("begin_chat_turn", [SID, "old", "recover me"])).toMatchObject({
        pending: true,
      });
      await admin(
        "UPDATE chat_turns SET lease_until=now()-interval '1 second' WHERE mutation_id='old'",
      );
      const recovered = await rpc("begin_chat_turn", [SID, "old", "recover me"]);
      expect(recovered?.lease_token).not.toEqual(t?.lease_token);
      await expect(
        rpc("complete_chat_turn", [SID, "old", t?.lease_token, "outdated", null]),
      ).rejects.toThrow("CHAT_LEASE_LOST");
      const saved = await rpc("complete_chat_turn", [
        SID,
        "old",
        recovered?.lease_token,
        "Recovered reply",
        null,
      ]);
      expect(await rpc("begin_chat_turn", [SID, "old", "recover me"])).toMatchObject({
        reply: "Recovered reply",
        assistant_message_id: saved?.assistant_message_id,
        replayed: true,
      });
      await expect(rpc("begin_chat_turn", [SID, "old", "different"])).rejects.toThrow(
        "MUTATION_CONFLICT",
      );
    });
    it("persists changed revision content with provenance and freezes original evidence/vector", async () => {
      const before = (
        await db.query("SELECT content,evidence FROM session_results WHERE version=1")
      ).rows[0];
      const t = await rpc("begin_chat_turn", [
        SID,
        "revise",
        "I prefer intimate music alone, not big communal anthems",
      ]);
      const out = await rpc("complete_chat_turn", [
        SID,
        "revise",
        t?.lease_token,
        "I hear that correction.",
        { scale: -10, community: -7 },
      ]);
      const revised = (
        await db.query<{
          content: { synthesis: string };
          self_report: Record<string, unknown>;
          base_version: number;
        }>("SELECT content,self_report,base_version FROM session_results WHERE version=$1", [
          out?.result_version,
        ])
      ).rows[0];
      expect(revised?.content.synthesis).not.toBe("Frozen original");
      expect(revised?.self_report).toMatchObject({
        deltas: { scale: -10, community: -7 },
        renderer_version: "self-report-revision-v1",
      });
      expect(revised?.self_report).toMatchObject({
        originating_mutation_id: "revise",
        user_message_id: t?.user_message_id,
        applied_deltas: { scale: -10, community: -7 },
      });
      expect(revised?.base_version).toBe(1);
      expect(
        (await db.query("SELECT content,evidence FROM session_results WHERE version=1")).rows[0],
      ).toEqual(before);
      expect(
        (await db.query<{ vector: unknown }>("SELECT vector FROM sessions")).rows[0]?.vector,
      ).toEqual({});
      await rpc("complete_chat_turn", [
        SID,
        "revise",
        t?.lease_token,
        "different retry",
        { scale: 10 },
      ]);
      expect(
        (
          await db.query(
            "SELECT * FROM session_results WHERE self_report->>'originating_mutation_id'='revise'",
          )
        ).rows,
      ).toHaveLength(1);
    });
    it("rolls back revision and reply together on a failed assistant save", async () => {
      const t = await rpc("begin_chat_turn", [SID, "fail", "Meaningful correction"]);
      await admin(
        `CREATE FUNCTION reject_reply() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.mutation_id='fail:reply' THEN RAISE EXCEPTION 'forced failure'; END IF; RETURN NEW; END$$; CREATE TRIGGER reject_reply BEFORE INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION reject_reply();`,
      );
      await expect(
        rpc("complete_chat_turn", [SID, "fail", t?.lease_token, "reply", { scale: -4 }]),
      ).rejects.toThrow("forced failure");
      expect(
        (
          await db.query(
            "SELECT * FROM session_results WHERE self_report->>'originating_mutation_id'='fail'",
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (await db.query("SELECT * FROM chat_messages WHERE mutation_id='fail:reply'")).rows,
      ).toHaveLength(0);
      await rpc("release_chat_turn", [SID, "fail", t?.lease_token]);
      const retry = await rpc("begin_chat_turn", [SID, "fail", "Meaningful correction"]);
      expect(retry?.lease_token).not.toEqual(t?.lease_token);
    });
    it("pins public content/version until explicit republish and revokes old token", async () => {
      const publication = await rpc("publish_saved_read", [SID, true, 1]);
      const publicRead = await rpc("lookup_published_read", [publication?.share_token]);
      expect(publicRead).toMatchObject({
        result_version: 1,
        content: { synthesis: "Frozen original" },
        interpretation: "Frozen original",
      });
      const t = await rpc("begin_chat_turn", [
        SID,
        "after-publication",
        "I care more about raw guitars than polished production",
      ]);
      await rpc("complete_chat_turn", [
        SID,
        "after-publication",
        t?.lease_token,
        "Noted.",
        { texture: -9 },
      ]);
      expect(await rpc("lookup_published_read", [publication?.share_token])).toEqual(publicRead);
      const republished = await rpc("publish_saved_read", [SID, true, null]);
      expect(republished?.result_version).not.toBe(1);
      const oldToken = republished?.share_token;
      await rpc("publish_saved_read", [SID, false, null]);
      expect(await rpc("lookup_published_read", [oldToken])).toBeNull();
    });
    it("denies nonowner writes and history/feedback reads through authenticated RLS", async () => {
      await asUser(OTHER);
      for (const [name, args] of [
        ["save_result_feedback", [SID, payload("other")]],
        ["begin_chat_turn", [SID, "other", "attempt"]],
        ["publish_saved_read", [SID, true, 1]],
      ] as [string, unknown[]][])
        await expect(rpc(name, args)).rejects.toThrow("forbidden");
      expect(
        (await db.query("SELECT * FROM chat_messages WHERE session_id=$1", [SID])).rows,
      ).toHaveLength(0);
      expect(
        (await db.query("SELECT * FROM result_feedback WHERE session_id=$1", [SID])).rows,
      ).toHaveLength(0);
      await asUser(OWNER);
    });
  },
);
