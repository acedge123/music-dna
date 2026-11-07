import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const receipt = JSON.parse(
  readFileSync(resolve(root, "docs/musicdna/learning-lifecycle-migration-receipt.json"), "utf8"),
);
const files = readdirSync(resolve(root, "supabase/migrations")).filter((name) =>
  name.endsWith(".sql"),
);
for (const table of ["musicdna_export_scopes", "musicdna_export_withdrawals"]) {
  const pattern = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table}\\b`,
    "i",
  );
  const creators = files.filter((name) =>
    pattern.test(readFileSync(resolve(root, "supabase/migrations", name), "utf8")),
  );
  assert.deepEqual(
    creators,
    [receipt.migration_path.split("/").at(-1)],
    `Duplicate or mismatched lifecycle migration for ${table}; preserve the applied version and do not rerun SQL`,
  );
}
// Lovable may stamp a different applied version for a reviewed file. Retain a
// single executable creator per AB-45 table, regardless of that filename.
const outboxCreators = [];
for (const table of ["musicdna_learning_enrollments", "musicdna_learning_outbox"]) {
  const pattern = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table}\\b`,
    "i",
  );
  const creators = files.filter((name) =>
    pattern.test(readFileSync(resolve(root, "supabase/migrations", name), "utf8")),
  );
  assert.equal(
    creators.length,
    1,
    `Duplicate or missing AB-45 table creator: ${table}; reconcile the applied filename without rerunning SQL`,
  );
  outboxCreators.push(creators[0]);
}
assert.equal(
  outboxCreators[0],
  outboxCreators[1],
  "AB-45 tables must share the reviewed lifecycle migration",
);
const bytes = readFileSync(resolve(root, receipt.migration_path));
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  receipt.applied_sql_sha256,
  "Applied migration bytes changed; create a separate reviewed forward migration instead",
);
assert.equal(
  receipt.migration_path.split("/").at(-1).split("_")[0],
  receipt.history_version,
  "Local lifecycle version differs from the verified history receipt",
);
console.log(
  JSON.stringify({
    check: "learning-lifecycle-migration",
    version: receipt.history_version,
    creators_per_table: 1,
    status: "ok",
  }),
);
