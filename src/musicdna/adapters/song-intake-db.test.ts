import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const guest = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT $1='${admin}'::uuid AND $2='admin'$$;
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at=now(); RETURN NEW; END$$;
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, opening_songs jsonb);
    CREATE TABLE songs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text,artist text,year integer,lane text,primary_lane text,
    movement integer,atmosphere integer,immersion integer,scale integer,community integer,perspective integer,confidence integer,tension integer,texture integer,transformation integer,
    diagnostic_power integer,primary_dimensions text[],archetype_signals text[],active boolean,rationale text,scoring_version text,scored_at timestamptz,scoring_provenance jsonb,created_at timestamptz DEFAULT now());
    GRANT SELECT,INSERT ON songs TO authenticated;
    ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY songs_admin ON songs TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
    INSERT INTO profiles VALUES('${guest}',NULL),('${owner}',NULL),('${admin}',NULL);`);
  const files = readdirSync("supabase/migrations").filter((f) => {
    const sql = readFileSync(`supabase/migrations/${f}`, "utf8");
    return sql.includes("CREATE TABLE public.staged_opener_songs") || sql.includes("ALTER FUNCTION public.promote_musicdna_opener_song") || sql.includes("CREATE FUNCTION public.validate_musicdna_intake_promotion");
  }).sort();
  for (const file of files) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
async function save(user: string, songs: string[]) {
  await db.query("UPDATE profiles SET opening_songs=$1::jsonb WHERE user_id=$2", [JSON.stringify(songs), user]);
}
describe.sequential("transactional opener intake", () => {
  it("captures exactly three ranked raw inputs for an anonymous account", async () => {
    await save(guest, ["True — Spandau Ballet", "Roxanne — The Police", "Little Red Corvette — Prince"]);
    const rows = await db.query<{ position: number; raw_input: string }>("SELECT position,raw_input FROM staged_opener_submissions WHERE user_id=$1 ORDER BY position", [guest]);
    expect(rows.rows.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(rows.rows[2].raw_input).toBe("Little Red Corvette — Prince");
  });
  it("repeated saves and later identical resubmission never inflate counts", async () => {
    await save(guest, ["True — Spandau Ballet", "Roxanne — The Police", "Little Red Corvette — Prince"]);
    expect((await db.query<{ n: number }>("SELECT sum(submission_count)::int n FROM staged_opener_songs")).rows[0].n).toBe(3);
  });
  it("registered submissions deduplicate song demand case-insensitively", async () => {
    await save(owner, ["true — spandau ballet", "roxanne — the police", "little red corvette — prince"]);
    const rows = await db.query<{ submission_count: number }>("SELECT submission_count FROM staged_opener_songs");
    expect(rows.rows).toHaveLength(3);
    expect(rows.rows.every((r) => r.submission_count === 2)).toBe(true);
  });
  it("ordinary and guest callers cannot read intake or promote", async () => {
    await db.exec(`SET ROLE authenticated; SET test.uid='${guest}'; SET test.jwt='{"is_anonymous":true}';`);
    expect((await db.query("SELECT * FROM staged_opener_songs")).rows).toHaveLength(0);
    await expect(db.exec("SELECT promote_musicdna_opener_song(gen_random_uuid(),'{}')")).rejects.toThrow("Forbidden");
    await db.exec(`SET test.uid='${owner}'; SET test.jwt='{"is_anonymous":false}';`);
    expect((await db.query("SELECT * FROM staged_opener_songs")).rows).toHaveLength(0);
    await db.exec("RESET ROLE");
  });
  it("profile deletion purges raw inputs and decrements demand", async () => {
    await db.query("DELETE FROM profiles WHERE user_id=$1", [guest]);
    expect((await db.query("SELECT * FROM staged_opener_submissions WHERE user_id=$1", [guest])).rows).toHaveLength(0);
    expect((await db.query<{ n: number }>("SELECT sum(submission_count)::int n FROM staged_opener_songs")).rows[0].n).toBe(3);
  });
  it("admin approval inserts an inactive song atomically and replays the same ID", async () => {
    const id = (await db.query<{ id: string }>("SELECT id FROM staged_opener_songs WHERE cleaned_title='True'")).rows[0].id;
    const draft = { title: "True", artist: "Spandau Ballet", year: 1983, lane: "pop", identity_confident: true, rationale: "Polished spacious arrangement and controlled vocal.", scores: { movement: 30, atmosphere: 70, immersion: 60, scale: 45, community: 30, perspective: 20, confidence: 50, tension: 20, texture: 85, transformation: 35 } };
    await db.query("UPDATE staged_opener_songs SET status='pending_review',ai_draft=$1::jsonb,scoring_version='listener-intake-v1',scoring_model='test' WHERE id=$2", [JSON.stringify(draft), id]);
    await db.exec(`SET ROLE authenticated; SET test.uid='${admin}'; SET test.jwt='{"is_anonymous":false}';`);
    const first = await db.query<{ id: string }>("SELECT promote_musicdna_opener_song($1,$2::jsonb) id", [id, JSON.stringify(draft)]);
    const replay = await db.query<{ id: string }>("SELECT promote_musicdna_opener_song($1,$2::jsonb) id", [id, JSON.stringify(draft)]);
    expect(first.rows[0].id).toBe(replay.rows[0].id);
    const songs = await db.query<{ active: boolean; texture: number }>("SELECT active,texture FROM songs");
    expect(songs.rows).toEqual([{ active: false, texture: 85 }]);
    await expect(db.query("SELECT promote_musicdna_opener_song($1,$2::jsonb)", [id, JSON.stringify({ ...draft, year: 1984 })])).rejects.toThrow("intake_changed_refresh");
    await db.exec("RESET ROLE");
  });
});