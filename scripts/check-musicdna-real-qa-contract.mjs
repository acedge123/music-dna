import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
const m = JSON.parse(readFileSync("contracts/musicdna-learning/v2/manifest.json"));
const moduleBytes = readFileSync(m.module_path),
  fixtureBytes = readFileSync(m.fixture_path);
const digest = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(digest(moduleBytes), m.validator_sha256);
assert.equal(digest(fixtureBytes), m.fixture_sha256);
const js = ts.transpileModule(moduleBytes.toString(), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { validateMusicDnaLearningEnvelopeV2: validate } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const fixture = JSON.parse(fixtureBytes);
assert.equal(validate(fixture).ok, true);
for (const edit of [
  (x) => (x.source = "music-dna-staging"),
  (x) => (x.environment = "staging"),
  (x) => (x.metadata.observation.privacy.data_class = "synthetic"),
  (x) => (x.metadata.observation.privacy.consent_basis = "authorized_synthetic_test"),
  (x) => (x.metadata.observation.privacy.policy_version = "synthetic-pilot.v1"),
  (x) => (x.metadata.observation.schema_version = "learning-observation.v1"),
  (x) => (x.correlation_id = x.correlation_id.replace(":v2:", ":v1:")),
  (x) => (x.metadata.observation.email = "private@example.invalid"),
  (x) => (x.metadata.observation.feedback.comment = "private"),
  (x) => (x.metadata.observation.feedback.accuracy = null),
  (x) => (x.metadata.observation.decision.answered_count = 5),
]) {
  const x = structuredClone(fixture);
  edit(x);
  if (x.metadata.observation.feedback.accuracy === null)
    x.metadata.observation.feedback.rating = null;
  assert.equal(validate(x).ok, false);
}
console.log(
  JSON.stringify({
    contract: m.contract_version,
    checks: 12,
    validator_sha256: m.validator_sha256,
    status: "ok",
  }),
);
