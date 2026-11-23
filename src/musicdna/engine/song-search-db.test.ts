import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { rankSongs, type SongSuggestion } from "./song-search";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE songs(id uuid DEFAULT gen_random_uuid(),title text,artist text,year integer,active boolean,confidence integer);
    CREATE TABLE song_recognition(id uuid DEFAULT gen_random_uuid(),title text,artist text,year integer,listen_count bigint);
    ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON songs TO authenticated;
    CREATE POLICY authenticated_songs ON songs TO authenticated USING(true);
    INSERT INTO songs(title,artist,year,active,confidence) VALUES
    ('Dreams','Fleetwood Mac',1977,true,90),('Bohemian Rhapsody','Queen',1975,true,90),
    ('Inactive secret','Hidden artist',1980,false,90);
    INSERT INTO song_recognition(title,artist,year,listen_count) VALUES
    ('Cosmogony','Björk',2011,100),('Carolyn’s Fingers','Cocteau Twins',1988,50),
    ('Cherry‐Coloured Funk','Cocteau Twins',1990,60),('Aloysius','Cocteau Twins',1984,40);`);
  await db.exec(readFileSync("docs/musicdna/public-song-search.sql", "utf8"));
  await db.exec("SET ROLE anon");
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function search(q: string) {
  const result = await db.query<SongSuggestion>("SELECT * FROM musicdna_public_song_search($1)", [
    q,
  ]);
  return rankSongs(result.rows, q);
}
it("guest Dreams includes active Fleetwood Mac without permitting direct scored reads", async () => {
  expect((await search("Dreams"))[0]?.artist).toBe("Fleetwood Mac");
  await expect(db.query("SELECT confidence FROM songs")).rejects.toThrow();
  expect(await search("Inactive secret")).toEqual([]);
});
it.each(["Bohemain Rhapsody", "Bohemian Rhapsody Queen", "Queen Bohemian Rhapsody"])(
  "retrieves and ranks %s",
  async (q) => {
    expect((await search(q))[0]?.artist).toBe("Queen");
  },
);
it.each([
  ["Bjork", "Cosmogony"],
  ["Carolyn's Fingers", "Carolyn’s Fingers"],
  ["Cherry-Coloured Funk", "Cherry‐Coloured Funk"],
])("normalizes %s before retrieval", async (q, title) => {
  expect((await search(q))[0]?.title).toBe(title);
});
it("recognition returns no provisional year and exposes only safe fields", async () => {
  const result = await search("Aloysius");
  expect(result[0]?.year).toBeNull();
  expect(Object.keys(result[0] ?? {}).sort()).toEqual([
    "artist",
    "id",
    "listen_count",
    "title",
    "year",
  ]);
});
