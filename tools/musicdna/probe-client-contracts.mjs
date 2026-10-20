// Explicit automated DTO/ownership probe, separate from hands-on acceptance.
// Tokens stay in memory. Output contains synthetic reading data: keep it local.
import assert from "node:assert/strict";
import fs from "node:fs";
const env = process.env;
const required = (key) => {
  assert.ok(env[key], `${key} is required`);
  return env[key];
};
assert.equal(env.MUSICDNA_PROBE_APPROVED, "1", "Explicit probe approval is required");
const base = new URL(required("MUSICDNA_PROBE_BASE_URL"));
assert.ok(base.protocol === "https:" || base.hostname === "127.0.0.1");
const sha = required("MUSICDNA_PROBE_EXPECTED_SHA");
const sid = required("MUSICDNA_PROBE_SESSION_ID");
const owner = required("MUSICDNA_PROBE_OWNER_TOKEN");
const other = required("MUSICDNA_PROBE_OTHER_TOKEN");
assert.notEqual(owner, other);
const output = required("MUSICDNA_PROBE_OUTPUT_FILE");
async function get(path, token, v1 = true) {
  const response = await fetch(new URL(path, base), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(v1 ? { "X-MusicDNA-Experience": "1" } : {}),
      ...(v1 && env.MUSICDNA_PROBE_PRIVATE_ACCEPTANCE_KEY
        ? { "X-MusicDNA-Acceptance-Key": env.MUSICDNA_PROBE_PRIVATE_ACCEPTANCE_KEY }
        : {}),
    },
    signal: AbortSignal.timeout(55000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Non-JSON response: HTTP ${response.status}`);
  }
  return { status: response.status, data };
}
const version = await get("/api/public/version", undefined, false);
assert.equal(version.status, 200);
assert.equal(version.data.serving_sha, sha);
assert.equal(version.data.persistence_v2, true);
const path = `/api/v1/session/${sid}`;
const snapshot = await get(path, owner);
assert.equal(snapshot.status, 200);
assert.equal(snapshot.data.status, "completed", "Use an approved completed synthetic session");
const capture = { serving_sha: sha, persistence_v2: true, session_id: sid };
let failures = 0;
for (const [name, suffix] of [
  ["snapshot", ""],
  ["next", "/next"],
  ["chat", "/chat"],
  ["feedback", "/feedback"],
]) {
  const response = name === "snapshot" ? snapshot : await get(path + suffix, owner);
  assert.equal(response.status, 200, name);
  assert.equal(response.data.contract, 1, name);
  capture[name] = response.data;
  console.log(`PASS owner ${name} DTO capture`);
  const denied = await get(path + suffix, other);
  capture[`${name}_foreign`] = { status: denied.status, code: denied.data.error?.code };
  if (![403, 404].includes(denied.status)) {
    failures++;
    console.log(`FAIL foreign ${name}: HTTP ${denied.status}`);
  } else console.log(`PASS foreign ${name} denial`);
}
const legacy = await get(path, owner, false);
assert.equal(legacy.status, 200);
assert.equal(legacy.data.contract, undefined);
capture.legacy_snapshot = legacy.data;
fs.writeFileSync(output, JSON.stringify(capture), { mode: 0o600 });
fs.chmodSync(output, 0o600);
console.log("Capture saved locally; no credentials or response content printed.");
process.exitCode = failures ? 1 : 0;
