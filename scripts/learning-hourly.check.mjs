import { test } from "node:test";
import assert from "node:assert/strict";
import { runHourly } from "./learning-hourly.mjs";
test("delivery and queued work never imply completed model work", async () => {
  const r = await runHourly({
    deliver: async () => ({ delivered: 2, state: "complete", attention: false }),
    tick: async () => "queued",
  });
  assert.equal(r.delivery_receipts, 2);
  assert.equal(r.review_queue_state, "queued");
  assert.equal(r.attention_required, false);
  assert.equal(Object.hasOwn(r, "review_completed"), false);
});
test("source outage still runs independent receiver retention", async () => {
  let ticked = false;
  const r = await runHourly({
    deliver: async () => {
      throw Error("source outage");
    },
    tick: async () => {
      ticked = true;
      return "idle";
    },
  });
  assert.equal(ticked, true);
  assert.equal(r.attention_required, true);
});
test("unavailable review authorization or pricing is never healthy idle", async () => {
  const r = await runHourly({
    deliver: async () => ({ delivered: 0, state: "idle", attention: false }),
    tick: async () => "authorization_or_pricing_unavailable",
  });
  assert.equal(r.attention_required, true);
});
