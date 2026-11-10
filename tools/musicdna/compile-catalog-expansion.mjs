// MusicDNA catalog batch validator and deterministic SQL compiler.
// node tools/musicdna/compile-catalog-expansion.mjs --validate <file.json>
// node tools/musicdna/compile-catalog-expansion.mjs --sql <file.json>
// No database or file writes happen in this program.
import { readFileSync } from "node:fs";

const selectedFile = process.argv.find((a) => a.endsWith(".json"));
const fallback = new URL("../../data/musicdna/r-and-b-expansion-2026-11-10.json", import.meta.url);
const batch = JSON.parse(readFileSync(selectedFile ?? fallback, "utf8"));
const axes = ["movement","atmosphere","immersion","scale","community","perspective","confidence","tension","texture","transformation"];
if (!["r_and_b","electronic"].includes(batch.lane)) throw new Error("Unsupported batch lane");
const prefix = "musicdna:" + batch.lane + ":2026-11-10:";
const primaryLane = batch.lane === "r_and_b" ? "general" : batch.lane;
const quote = (x) => "'" + String(x).replaceAll("'", "''") + "'";
const json = (x) => quote(JSON.stringify(x)) + "::jsonb";
const songId = (k) => "md5(" + quote(prefix + "song:" + k) + ")::uuid";
const pairId = (p) => "md5(" + quote(prefix + "pair:" + [p.a,p.b].sort().join("|")) + ")::uuid";
const map = new Map(batch.songs.map((s) => [s.key,s]));
const errors = [], seen = new Set(), artistCounts = new Map();
const coverage = Object.fromEntries(axes.map((a) => [a,0]));
if (JSON.stringify(batch.score_axes) !== JSON.stringify(axes)) errors.push("Axis ordering mismatch");
if (batch.songs.length < 30 || batch.songs.length > 40) errors.push("Expected 30-40 songs");
if (map.size !== batch.songs.length) errors.push("Duplicate song key");
for (const s of batch.songs) {
  const artist = s.artist.toLowerCase().split(" feat.")[0];
  artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
  if (s.scores.length !== 10 || s.scores.some((v) => !Number.isInteger(v) || v < 0 || v > 100))
    errors.push(s.key + ": bad scores");
  if (s.scores.filter((v) => v < 35 || v > 65).length < 3)
    errors.push(s.key + ": not enough non-neutral dimensions");
}
for (const [artist,n] of artistCounts) if (n > 3) errors.push(artist + ": artist cap exceeded");
for (const p of batch.pairings) {
  const k = [p.a,p.b].sort().join("|"), a = map.get(p.a), b = map.get(p.b);
  if (seen.has(k)) errors.push(k + ": duplicate pair");
  seen.add(k);
  if (a && b && a.artist === b.artist) errors.push(k + ": same artist");
  if ((!a && !p.a.startsWith("db:")) || (!b && !p.b.startsWith("db:"))) errors.push(k + ": unknown song");
  if (p.tests.length < 1 || p.tests.length > 3 || new Set(p.tests).size !== p.tests.length)
    errors.push(k + ": invalid test count");
  if (p.phrase.length < 25 || p.why.length < 30) errors.push(k + ": weak editorial text");
  for (const axis of p.tests) {
    const i = axes.indexOf(axis);
    if (i < 0) errors.push(k + ": invalid axis " + axis);
    else {
      coverage[axis]++;
      if (a && b && Math.abs(a.scores[i] - b.scores[i]) < 20)
        errors.push(k + ": contrast below 20 on " + axis);
    }
  }
}
if (errors.length) { process.stderr.write(errors.join("\n") + "\n"); process.exit(1); }
if (!process.argv.includes("--sql")) {
  process.stdout.write(JSON.stringify({
    songs: batch.songs.length, pairings: batch.pairings.length,
    declared_tests: coverage, review: "editorial_provisional",
  },null,2) + "\n");
  process.exit(0);
}

const songs = batch.songs.map((s) => {
  const strong = s.scores.filter((v) => v <= 30 || v >= 70).length;
  const nonneutral = s.scores.filter((v) => v < 35 || v > 65).length;
  const metrics = {
    polarization: Math.min(25,6 + strong + (s.canon < 95 ? 3 : 0)),
    tradeoff_richness: Math.min(20,7 + nonneutral),
    pairing_density: 9,
    identity_signaling: Math.min(15,6 + Math.ceil(strong / 2)),
    longevity: s.year < 2000 ? 10 : s.year <= 2016 ? 8 : s.year <= 2021 ? 5 : 3,
    cross_genre_mapping: s.routing < 80 ? 13 : 10,
  };
  return {
    ...s, ...metrics,
    diagnostic_power: Object.values(metrics).reduce((a,b) => a+b,0),
    primary_dimensions: axes.map((axis,i) => ({axis,delta:Math.abs(s.scores[i]-50)}))
      .sort((a,b) => b.delta-a.delta).slice(0,3).map((v) => v.axis),
  };
});
const newSongIds = songs.map((s) => songId(s.key)).join(",");
const newPairIds = batch.pairings.map(pairId).join(",");
const ref = (col) => "case when left(p." + col + ",3)='db:' then substr(p." + col + ",4)::uuid else md5(" + quote(prefix + "song:") + " || p." + col + ")::uuid end";
const code = [
  "-- MusicDNA " + batch.lane + " catalog. Editorial estimates; no existing data overwritten.",
  "BEGIN;",
  "SET LOCAL lock_timeout='5s';",
  "WITH s AS (SELECT * FROM jsonb_to_recordset(" + json(songs) + ") AS s(",
  "key text,title text,artist text,year int,sub_lane text,scores jsonb,canon int,routing int,rationale text,",
  "polarization int,tradeoff_richness int,pairing_density int,identity_signaling int,longevity int,",
  "cross_genre_mapping int,diagnostic_power int,primary_dimensions text[]))",
  "INSERT INTO public.songs(",
  "id,title,artist,year,lane,primary_lane,sub_lane,active,",
  "movement,atmosphere,immersion,scale,community,perspective,confidence,tension,texture,transformation,",
  "canon_score,routing_power,diagnostic_power,primary_dimensions,rationale,",
  "polarization,tradeoff_richness,pairing_density,identity_signaling,longevity,cross_genre_mapping,",
  "scoring_version,scored_at,scoring_provenance)",
  "SELECT md5(" + quote(prefix + "song:") + "||s.key)::uuid,s.title,s.artist,s.year," +
    quote(batch.lane) + "," + quote(primaryLane) + ",s.sub_lane,true,",
  ...axes.map((_,i) => "(s.scores->>" + i + ")::int,"),
  "s.canon,s.routing,s.diagnostic_power,s.primary_dimensions,s.rationale,",
  "s.polarization,s.tradeoff_richness,s.pairing_density,s.identity_signaling,s.longevity,s.cross_genre_mapping,",
  quote(batch.version) + ",now()," + json({
    version:batch.version,method:"editorial_axis_estimates",listener_validated:false,
    review_status:"provisional",source:"song-level musical contrast",existing_catalog_rescored:false,
  }),
  "FROM s WHERE NOT EXISTS (SELECT 1 FROM public.songs old",
  "WHERE lower(trim(old.title))=lower(trim(s.title)) AND lower(trim(old.artist))=lower(trim(s.artist)))",
  "ON CONFLICT(id) DO NOTHING;",
  "WITH p AS (SELECT * FROM jsonb_to_recordset(" + json(batch.pairings) + ")",
  "AS p(a text,b text,tests text[],phrase text,why text,weight int)),",
  "resolved AS (SELECT md5(" + quote(prefix + "pair:") + "||",
  "(case when p.a<p.b then p.a||'|'||p.b else p.b||'|'||p.a end))::uuid id,",
  ref("a") + " a_id," + ref("b") + " b_id,",
  "p.tests,p.phrase,p.why,p.weight FROM p)",
  "INSERT INTO public.pairings(id,song_a_id,song_b_id,tests,hypothesis,why_good,user_facing_tradeoff,",
  "lane,active,diagnostic_weight,expected_split,difficulty,is_bootstrap)",
  "SELECT p.id,p.a_id,p.b_id,p.tests,p.why,",
  "p.why||' Editorial contrast only; listener split not yet measured.',p.phrase,",
  quote(batch.lane) + ",true,p.weight,'Unmeasured; listener validation pending',2,false",
  "FROM resolved p JOIN public.songs a ON a.id=p.a_id JOIN public.songs b ON b.id=p.b_id",
  "WHERE a.lane=" + quote(batch.lane) + " AND b.lane=" + quote(batch.lane) + " AND a.id<>b.id",
  "AND lower(a.artist)<>lower(b.artist)",
  "AND NOT EXISTS (SELECT 1 FROM public.pairings old WHERE",
  "(old.song_a_id=p.a_id AND old.song_b_id=p.b_id) OR",
  "(old.song_a_id=p.b_id AND old.song_b_id=p.a_id))",
  "ON CONFLICT(id) DO NOTHING;",
  "DO $audit$ DECLARE sc int; pc int; bad int; BEGIN",
  "SELECT count(*) INTO sc FROM public.songs WHERE id IN (" + newSongIds + ");",
  "SELECT count(*) INTO pc FROM public.pairings WHERE id IN (" + newPairIds + ");",
  "IF sc<>" + songs.length + " OR pc<>" + batch.pairings.length +
    " THEN RAISE EXCEPTION 'Incomplete R&B batch: % songs / % pairings',sc,pc; END IF;",
  "SELECT count(*) INTO bad FROM public.pairings p",
  "JOIN public.songs a ON a.id=p.song_a_id JOIN public.songs b ON b.id=p.song_b_id",
  "CROSS JOIN LATERAL unnest(p.tests) ax",
  "WHERE p.id IN (" + newPairIds + ") AND (",
  "ax NOT IN (" + axes.map(quote).join(",") + ")",
  "OR (to_jsonb(a)->>ax) IS NULL OR (to_jsonb(b)->>ax) IS NULL",
  "OR abs((to_jsonb(a)->>ax)::int-(to_jsonb(b)->>ax)::int)<20);",
  "IF bad>0 THEN RAISE EXCEPTION 'Invalid R&B tests: %',bad; END IF;",
  "IF EXISTS(SELECT 1 FROM public.pairings p WHERE p.id IN (" + newPairIds + ")",
  "AND (cardinality(p.tests)<1 OR cardinality(p.tests)>3 OR p.user_facing_tradeoff IS NULL",
  "OR NOT p.active OR p.song_a_id=p.song_b_id))",
  "THEN RAISE EXCEPTION 'Invalid R&B active-pair metadata'; END IF;",
  "END $audit$;",
  "COMMIT;",
].join("\n");
process.stdout.write(code + "\n");
