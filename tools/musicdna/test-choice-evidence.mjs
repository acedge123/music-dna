import { readFile } from "node:fs/promises";

// Isolated in-memory PostgreSQL: no database URL or production credentials.
const { PGlite } = await import(process.env.MUSICDNA_TEST_PGLITE_MODULE ?? "@electric-sql/pglite");
const db = new PGlite();
try {
  for (const path of [
    "../../tools/musicdna/test-choice-evidence.sql",
    "../../supabase/migrations/20261010222931_3204fcfc-abc2-466d-8f67-5604a6a0fffc.sql",
    "../../supabase/migrations/20261010230343_550c1bac-d6cc-412d-a07e-366aaa2c58f8.sql",
    "../../supabase/migrations/20261010232545_harden_choice_evidence.sql",
    "../../tools/musicdna/assert-choice-evidence.sql",
  ]) {
    await db.exec(await readFile(new URL(path, import.meta.url), "utf8"));
  }
  console.log(
    "PASS: snapshot capture, catalog edits, immutability, legacy preservation, duplicate/stale rollback, catalog race and owner isolation",
  );
} finally {
  await db.close();
}
