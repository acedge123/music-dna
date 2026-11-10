import { test } from "node:test";
import assert from "node:assert/strict";
import { runHourly } from "./learning-hourly.mjs";
test("records phases without confusing delivered receipts with a completed model draft", async () => {
  const writes = [];
  const r = await runHourly({
    id: () => "run",
    record: async (...x) => writes.push(x),
    deliver: async () => ({ delivered: 2, attention: false }),
    tick: async () => "queued",
  });
  assert.equal(r.delivery_receipts, 2);
  assert.equal(r.review_queue_state, "queued");
  assert.equal(writes[1][1], "completed");
  assert.equal(Object.hasOwn(r, "review_completed"), false);
});
test("transport trouble does not suppress independent receiver maintenance", async () => {
  const writes = [];
  let ticked = false;
  await runHourly({
    id: () => "run",
    record: async (...x) => writes.push(x),
    deliver: async () => ({ delivered: 0, attention: true }),
    tick: async () => {
      ticked = true;
      return "idle";
    },
  });
  assert.equal(ticked, true);
  assert.equal(writes[1][1], "failed");
});
test("unavailable authorization/pricing is an actionable failure, not healthy idle", async () => {
  const writes = [];
  const r = await runHourly({
    id: () => "run",
    record: async (...x) => writes.push(x),
    deliver: async () => ({ delivered: 0, attention: false }),
    tick: async () => "authorization_or_pricing_unavailable",
  });
  assert.equal(r.attention_required, true);
  assert.equal(writes[1][1], "failed");
});
