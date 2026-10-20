// Runs only with explicit production approval and a verified expected serving SHA.
// Credentials stay in memory; never prints replies, transcripts, or bearer tokens.
import assert from "node:assert/strict";
const base = process.env.MUSICDNA_ACCEPTANCE_BASE_URL;
const sha = process.env.MUSICDNA_ACCEPTANCE_EXPECTED_SHA;
const key = process.env.MUSICDNA_ACCEPTANCE_HARNESS_KEY;
if (process.env.MUSICDNA_ACCEPTANCE_APPROVED !== "1" || !base || !sha || !key)
  throw new Error(
    "Approved configuration, base URL, expected SHA and matching harness key are required.",
  );
async function request(path, method = "GET", body, token) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-MusicDNA-Experience": "1",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data };
}
const version = await request("/api/public/version");
assert.equal(version.status, 200);
assert.equal(version.data.serving_sha, sha);
assert.equal(version.data.persistence_v2, true);
async function harness(action, body) {
  const r = await fetch(new URL(`/api/public/test/${action}`, base), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-harness-secret": key },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Harness ${action} rejected: ${r.status}`);
  return r.json();
}
// Personas must already be approved/provisioned, never reset production readings.
const owner = process.env.MUSICDNA_ACCEPTANCE_OWNER_PERSONA;
const other = process.env.MUSICDNA_ACCEPTANCE_OTHER_PERSONA;
const sid = process.env.MUSICDNA_ACCEPTANCE_SESSION_ID;
if (!owner || !other || owner === other || !sid)
  throw new Error("Two approved distinct personas and an owned completed session are required.");
const a = (await harness("bearer", { persona_id: owner })).access_token;
const b = (await harness("bearer", { persona_id: other })).access_token;
const prefix = `acceptance-${crypto.randomUUID()}`;
const path = `/api/v1/session/${sid}`;
let history = (await request(`${path}/chat`, "GET", undefined, a)).data;
const original = history.result_versions.find((v) => v.source === "pairings");
assert.ok(original);
const originalContent = JSON.stringify(original.content);
const feedback = {
  mutation_id: `${prefix}-feedback`,
  result_version: original.version,
  accuracy: "accurate",
  target: "acceptance",
};
const saved = await request(`${path}/feedback`, "POST", feedback, a);
assert.equal(saved.status, 200);
const read = await request(`${path}/feedback`, "GET", undefined, a);
assert.equal(read.status, 200);
assert.ok(
  read.data.feedback.some(
    (row) =>
      row.mutation_id === feedback.mutation_id &&
      row.id === saved.data.id &&
      row.result_version === original.version,
  ),
);
const retry = await request(`${path}/feedback`, "POST", feedback, a);
assert.equal(retry.data.id, saved.data.id);
assert.equal(retry.data.replayed, true);
assert.equal(
  (await request(`${path}/feedback`, "POST", { ...feedback, comment: "conflicting" }, a)).status,
  409,
);
const publication = await request(
  `${path}/share`,
  "POST",
  { publish: true, result_version: original.version },
  a,
);
assert.equal(publication.status, 200);
const token = publication.data.share_token;
const frozen = await request(`/api/v1/share/${token}`);
assert.equal(frozen.status, 200);
assert.equal(frozen.data.result_version, original.version);
assert.deepEqual(frozen.data.content, original.content);
const turn = {
  mutation_id: `${prefix}-chat`,
  message:
    "Your read missed something: I prefer intimate, solitary, raw songs over vast polished communal anthems.",
};
let chat = await request(`${path}/chat`, "POST", turn, a);
for (
  let attempts = 0;
  chat.status === 409 && chat.data.error?.code === "CHAT_TURN_PENDING" && attempts < 3;
  attempts++
) {
  await new Promise((resolve) => setTimeout(resolve, 61000));
  chat = await request(`${path}/chat`, "POST", turn, a);
}
assert.equal(chat.status, 200);
assert.ok(chat.data.assistant_message_id);
const replay = await request(`${path}/chat`, "POST", turn, a);
assert.equal(replay.status, 200);
assert.equal(replay.data.reply, chat.data.reply);
assert.equal(replay.data.assistant_message_id, chat.data.assistant_message_id);
assert.equal(
  (await request(`${path}/chat`, "POST", { ...turn, message: "conflicting" }, a)).status,
  409,
);
history = (await request(`${path}/chat`, "GET", undefined, a)).data;
const revision = history.result_versions.find(
  (v) => v.self_report?.originating_mutation_id === turn.mutation_id,
);
assert.ok(revision, "Meaningful self-report must produce an actual saved revision");
assert.notDeepEqual(revision.content, original.content);
assert.equal(revision.base_version, original.version);
assert.equal(
  JSON.stringify(history.result_versions.find((v) => v.version === original.version).content),
  originalContent,
);
assert.deepEqual((await request(`/api/v1/share/${token}`)).data, frozen.data);
const laterFeedback = {
  ...feedback,
  mutation_id: `${prefix}-feedback-new`,
  result_version: revision.version,
};
assert.equal((await request(`${path}/feedback`, "POST", laterFeedback, a)).status, 200);
const feedbackRows = (await request(`${path}/feedback`, "GET", undefined, a)).data.feedback;
assert.ok(
  feedbackRows.some(
    (r) => r.mutation_id === feedback.mutation_id && r.result_version === original.version,
  ),
);
assert.ok(
  feedbackRows.some(
    (r) => r.mutation_id === laterFeedback.mutation_id && r.result_version === revision.version,
  ),
);
const ids = new Set();
let cursor = null;
do {
  const page = await request(
    `${path}/chat?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    "GET",
    undefined,
    a,
  );
  assert.equal(page.status, 200);
  for (const message of page.data.messages) {
    assert.ok(!ids.has(message.id));
    ids.add(message.id);
  }
  cursor = page.data.next_cursor;
} while (cursor);
assert.ok(ids.has(chat.data.user_message_id) && ids.has(chat.data.assistant_message_id));
for (const [endpoint, method, body] of [
  ["chat", "GET"],
  ["feedback", "GET"],
  ["feedback", "POST", feedback],
  ["chat", "POST", turn],
  ["share", "POST", { publish: false }],
]) {
  const denial = await request(`${path}/${endpoint}`, method, body, b);
  assert.ok([403, 404].includes(denial.status), `Cross-user ${endpoint} must deny`);
}
assert.equal((await request(`${path}/share`, "POST", { publish: false }, a)).status, 200);
assert.equal((await request(`/api/v1/share/${token}`)).status, 404);
console.log(
  `PASS deployed SHA ${sha}: owner persistence, exact replay/conflicts, feedback version preservation, actual revision provenance, paged restoration, pinned sharing, revocation and cross-user denial.`,
);
console.log(
  "Still requires controlled interruption/failure injection and >200 deployed-message fixture acceptance; isolated PostgreSQL tests are not substitutes.",
);
