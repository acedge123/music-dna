import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const digest = (path) => createHash("sha256").update(read(path)).digest("hex");
const receipt = JSON.parse(read("docs/musicdna/ab75-migration-receipts.json"));
const files = readdirSync(new URL("supabase/migrations/", root)).filter((f) => f.endsWith(".sql"));
assert.equal(
  new Set(files.map((f) => f.split("_")[0])).size,
  files.length,
  "Duplicate executable migration versions",
);
for (const [name, expected] of [
  ["save_result_feedback", receipt.recovered.migration_path],
  ["save_musicdna_deferred_read", receipt.retained[0].migration_path],
]) {
  const pattern = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\s*\\(`,
    "i",
  );
  assert.deepEqual(
    files.filter((f) => pattern.test(read("supabase/migrations/" + f).toString())),
    [expected.split("/").at(-1)],
    `Missing/duplicate ${name} creator`,
  );
}
assert.equal(
  digest(receipt.recovered.migration_path),
  receipt.recovered.reconstructed_sql_sha256,
  "Recovered history statement bytes changed",
);
for (const row of receipt.retained) {
  assert.equal(digest(row.migration_path), row.applied_sql_sha256, "Applied SQL bytes changed");
  assert.ok(
    row.migration_path
      .split("/")
      .at(-1)
      .startsWith(row.history_version + "_"),
  );
  assert.ok(
    !files.includes((row.removed_duplicate ?? row.renamed_from).split("/").at(-1)),
    "Unapplied duplicate still executable",
  );
}
for (const row of receipt.catalog_replay_guards) {
  assert.equal(
    digest(row.original_path),
    row.applied_sql_sha256,
    "Archived applied original changed",
  );
  assert.equal(
    digest(row.migration_path),
    row.replay_source_sha256,
    "Replay guard changed without reviewed receipt",
  );
  assert.ok(!row.original_path.startsWith("supabase/migrations/"));
}
console.log(
  JSON.stringify({
    check: "replay-baseline-receipts",
    recovered: 1,
    retained: 2,
    guarded_catalog_batches: 3,
    status: "ok",
  }),
);
