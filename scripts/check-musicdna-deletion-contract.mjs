import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = fileURLToPath(new URL("../", import.meta.url));
const m = JSON.parse(
  readFileSync(resolve(root, "contracts/musicdna-learning-deletion/v1/manifest.json"), "utf8"),
);
const code = readFileSync(resolve(root, m.module_path));
const bytes = readFileSync(resolve(root, m.fixture_path));
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(hash(code), m.validator_sha256);
assert.equal(hash(bytes), m.fixtures_sha256);
for (const path of process.argv.slice(2)) {
  const other = JSON.parse(readFileSync(path, "utf8"));
  for (const key of ["contract_version", "validator_sha256", "fixtures_sha256"])
    assert.equal(other[key], m[key], "Cross-repo lifecycle contract drift");
}
const js = ts.transpileModule(code.toString("utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const c = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const f = JSON.parse(bytes);
for (const x of f.requests)
  assert.equal(!!c.validateLearningDeletionV1({ ...f.base_request, ...x.changes }), x.valid, x.id);
for (const x of f.receipts)
  assert.equal(
    !!c.validateLearningDeletionReceiptV1(
      { ...f.base_receipt, ...x.changes },
      f.base_request.deletion_id,
    ),
    x.valid,
    x.id,
  );
console.log(
  JSON.stringify({
    contract: m.contract_version,
    fixtures: f.requests.length + f.receipts.length,
    status: "ok",
  }),
);
