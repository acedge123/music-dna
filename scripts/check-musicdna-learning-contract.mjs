import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "contracts/musicdna-learning/v1/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const moduleBytes = readFileSync(resolve(root, manifest.module_path));
const fixtureBytes = readFileSync(resolve(root, manifest.fixture_path));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(
  digest(moduleBytes),
  manifest.validator_sha256,
  "Contract changed: review version/fixtures and update the pinned manifest together",
);
assert.equal(
  digest(fixtureBytes),
  manifest.fixtures_sha256,
  "Fixtures changed: review the shared contract and update all pinned copies",
);

for (const other of process.argv.slice(2)) {
  const candidate = JSON.parse(readFileSync(resolve(other), "utf8"));
  for (const key of ["contract_version", "validator_sha256", "fixtures_sha256"]) {
    assert.equal(candidate[key], manifest[key], `Cross-repo contract drift: ${key}`);
  }
}

// Existing TypeScript tooling is sufficient: the portable module has no imports.
// This also runs on Node 20 without relying on experimental TS execution.
const js = ts.transpileModule(moduleBytes.toString("utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const contract = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const fixtures = JSON.parse(fixtureBytes);

function changed(base, changes = []) {
  const value = structuredClone(base);
  for (const change of changes) {
    let target = value;
    for (const key of change.path.slice(0, -1)) target = target[key];
    const last = change.path.at(-1);
    if (change.op === "delete") delete target[last];
    else
      Object.defineProperty(target, last, {
        value: change.value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
  }
  return value;
}

let checked = 0;
for (const fixture of fixtures.envelope_cases) {
  const value = changed(fixtures.base_envelope, fixture.changes);
  const result = contract.validateMusicDnaLearningEnvelopeV1(value);
  assert.equal(result.ok, fixture.valid, fixture.id);
  if (result.ok)
    assert.ok(Buffer.byteLength(JSON.stringify(value)) <= contract.LEARNING_OBSERVATION_MAX_BYTES);
  checked++;
}
for (const fixture of fixtures.receipt_cases) {
  const value = changed(fixtures.base_receipt, fixture.changes);
  const result = contract.validateMusicDnaLearningReceiptV1(
    value,
    fixtures.base_envelope.metadata.observation.observation_id,
  );
  assert.equal(result.ok, fixture.valid, fixture.id);
  checked++;
}
console.log(
  JSON.stringify({
    contract: manifest.contract_version,
    fixtures: checked,
    validator_sha256: manifest.validator_sha256,
    fixtures_sha256: manifest.fixtures_sha256,
    status: "ok",
  }),
);
