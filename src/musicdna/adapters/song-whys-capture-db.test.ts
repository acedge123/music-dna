import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.songs(id text PRIMARY KEY,title text,artist text,year integer,lane text,primary_lane text,scale integer);
    CREATE TABLE public.pairings(id text PRIMARY KEY,song_a_id text,song_b_id text,tests text[],diagnostic_weight integer,updated_at text,user_facing_tradeoff text);
    CREATE TABLE public.song_trait_explanations(id text,song_id text,axis text,score_at_write integer,audible_evidence text,scoring_version text,status text);
    CREATE TABLE public.choices(id text,session_id text,pairing_id text,chosen_song_id text,rejected_song_id text,created_at text,ms_to_decide integer,mutation_id text,evidence jsonb,response jsonb);
    INSERT INTO songs VALUES('a','A','X',1980,'pop','pop',80),('b','B','Y',1980,'pop','pop',20);
    INSERT INTO pairings VALUES('p','a','b',ARRAY['scale'],50,'revision','A specific saying');
    INSERT INTO song_trait_explanations VALUES
      ('approved','a','scale',80,'Close voice above a spare arrangement.',NULL,'approved'),
      ('pending','a','scale',80,'Pending description must not be used.',NULL,'pending_review'),
      ('stale','a','scale',70,'Old score must not be used here.',NULL,'approved'),
      ('other','a','texture',80,'Untested texture must not be used.',NULL,'approved');`);
  await db.exec(readFileSync("docs/musicdna/song-whys-capture-review.sql", "utf8"));
  await db.exec("CREATE TRIGGER capture BEFORE INSERT OR UPDATE ON choices FOR EACH ROW EXECUTE FUNCTION public.capture_choice_evidence();");
}, 30000);
afterAll(async () => { await db?.close(); });
async function vote(id: string, enabled: boolean) {
  const result = await db.query<{ evidence: Record<string, unknown>; response: Record<string, unknown> }>(
    `INSERT INTO choices VALUES($1,'s','p','a','b','now',100,'mutation',NULL,$2::jsonb) RETURNING evidence,response`,
    [id, JSON.stringify(enabled ? { _capture_song_whys: true, verdict: "saved" } : { verdict: "saved" })]);
  return result.rows[0];
}
describe("database Song Whys capture", () => {
  it("defaults off and preserves the existing snapshot contract", async () => {
    const saved = await vote("off", false);
    expect(saved.evidence.version).toBe("choice-evidence-v1");
    expect(saved.evidence).not.toHaveProperty("song_whys");
  });
  it("captures only approved score-matched tested descriptions and removes the internal marker", async () => {
    const saved = await vote("on", true);
    expect(saved.evidence.song_whys).toMatchObject({ version: "song-whys-v1", chosen: [{ id: "approved" }], rejected: [] });
    expect((saved.evidence.song_whys as { chosen: unknown[] }).chosen).toHaveLength(1);
    expect(saved.response).toEqual({ verdict: "saved" });
    await db.exec("UPDATE song_trait_explanations SET audible_evidence='Edited catalog text after the vote.' WHERE id='approved';");
    const read = await db.query<{ evidence: { song_whys: { chosen: { audible_evidence: string }[] } } }>("SELECT evidence FROM choices WHERE id='on'");
    expect(read.rows[0].evidence.song_whys.chosen[0].audible_evidence).toBe("Close voice above a spare arrangement.");
    await expect(db.exec("UPDATE choices SET evidence='{}' WHERE id='on'")).rejects.toThrow("choice_evidence_is_immutable");
  });
});