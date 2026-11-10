import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
export async function runHourly(deps) {
  const runId = deps.id();
  let delivered = 0,
    attention = false,
    autoState = "unavailable";
  try {
    await deps.record(runId, "started", 0, false);
  } catch {
    attention = true;
  }
  try {
    const delivery = await deps.deliver();
    delivered = delivery.delivered;
    attention ||= delivery.attention;
  } catch {
    attention = true;
  }
  // Receiver retention is independent of source availability.
  try {
    autoState = await deps.tick();
  } catch {
    attention = true;
  }
  if (!["idle", "queued", "busy", "budget_limited", "scope_closed"].includes(autoState))
    attention = true;
  try {
    await deps.record(runId, attention ? "failed" : "completed", delivered, attention);
  } catch {
    attention = true;
  }
  return {
    event: "musicdna_hourly",
    delivery_receipts: delivered,
    review_queue_state: autoState,
    attention_required: attention,
  };
}
async function main() {
  if (process.env.MUSICDNA_HOURLY_ENABLED !== "1") {
    console.log(JSON.stringify({ event: "musicdna_hourly", state: "disabled" }));
    return;
  }
  const url = process.env.SUPABASE_URL,
    key = process.env.SB_SECRET_KEY;
  const sourceId = process.env.MUSICDNA_ECHELON_SOURCE_ID,
    token = process.env.MUSICDNA_AUTOMATION_TOKEN;
  if (url !== "https://udycgnhvaanemhrchbuj.supabase.co" || !key || !sourceId || !token)
    throw Error("hourly_configuration");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await runHourly({
    id: randomUUID,
    async record(id, state, delivered, attention) {
      const { error } = await db
        .rpc("record_musicdna_learning_worker_run", {
          p_run_id: id,
          p_state: state,
          p_delivered: delivered,
          p_attention: attention,
        })
        .abortSignal(AbortSignal.timeout(10000));
      if (error) throw Error("run_receipt_unavailable");
    },
    async deliver() {
      return new Promise((resolve) => {
        let output = "";
        const child = spawn(
          process.execPath,
          [
            fileURLToPath(new URL("../dist-learning-worker/worker.mjs", import.meta.url)),
            "--source",
            "music-dna",
            "--environment",
            "production",
            "--execute",
            "--maintenance",
            "--batch",
            "10",
          ],
          { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
        );
        child.stdout.on("data", (b) => {
          if (output.length < 65536) output += b.toString();
        });
        child.stderr.resume();
        const timeout = setTimeout(() => child.kill("SIGTERM"), 65000);
        child.on("error", () => {
          clearTimeout(timeout);
          resolve({ delivered: 0, attention: true });
        });
        child.on("exit", (code) => {
          clearTimeout(timeout);
          try {
            const s = JSON.parse(output.trim()).summary;
            resolve({
              delivered: Number.isSafeInteger(s?.delivered) ? s.delivered : 0,
              attention: code !== 0 || s?.attention_required === true || s?.state === "disabled",
            });
          } catch {
            resolve({ delivered: 0, attention: true });
          }
        });
      });
    },
    async tick() {
      const r = await fetch(
        "https://yczomejrvihbmydyraqg.supabase.co/functions/v1/musicdna-learning-auto",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ source_id: sourceId }),
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
      const raw = await r.text();
      if (!r.ok || raw.length > 8192) throw Error("automation_unavailable");
      const v = JSON.parse(raw);
      if (v.ok !== true || typeof v.state !== "string") throw Error("automation_unavailable");
      return v.pricing_state === "unavailable_or_changed" ? "pricing_unavailable" : v.state;
    },
  });
  console.log(JSON.stringify(result));
  if (result.attention_required) process.exitCode = 2;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const guard = setTimeout(() => process.exit(2), 120000);
  try {
    await main();
  } catch {
    console.error(JSON.stringify({ event: "musicdna_hourly", state: "unavailable" }));
    process.exitCode = 2;
  } finally {
    clearTimeout(guard);
  }
}
