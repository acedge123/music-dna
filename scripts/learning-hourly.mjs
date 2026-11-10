import { fileURLToPath } from "node:url";
export async function runHourly(deps) {
  let delivered = 0,
    attention = false,
    sourceState = "unavailable",
    autoState = "unavailable";
  try {
    const d = await deps.deliver();
    delivered = d.delivered;
    sourceState = d.state;
    attention = d.attention;
  } catch {
    attention = true;
  }
  // Receiver retention remains independent of source availability.
  try {
    autoState = await deps.tick();
  } catch {
    attention = true;
  }
  if (!["idle", "queued", "busy", "budget_limited", "scope_closed"].includes(autoState))
    attention = true;
  return {
    event: "musicdna_hourly",
    delivery_receipts: delivered,
    delivery_state: sourceState,
    review_queue_state: autoState,
    attention_required: attention,
  };
}
async function call(url, token, body, timeout) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok || !r.body) throw Error("unavailable");
  const reader = r.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw Error("oversize");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const b of chunks) {
    bytes.set(b, offset);
    offset += b.length;
  }
  const v = JSON.parse(new TextDecoder().decode(bytes));
  if (v.ok !== true || typeof v.state !== "string") throw Error("unavailable");
  return v;
}
async function main() {
  if (process.env.MUSICDNA_HOURLY_ENABLED !== "1") {
    console.log(JSON.stringify({ event: "musicdna_hourly", state: "disabled" }));
    return;
  }
  if (
    process.env.SB_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY
  )
    throw Error("backend_credentials_forbidden");
  const sourceId = process.env.MUSICDNA_ECHELON_SOURCE_ID,
    exportKey = process.env.MUSICDNA_EXPORT_API_KEY,
    reviewKey = process.env.MUSICDNA_AUTOMATION_TOKEN;
  if (!sourceId || !exportKey || !reviewKey) throw Error("configuration");
  const result = await runHourly({
    async deliver() {
      const v = await call(
        "https://udycgnhvaanemhrchbuj.supabase.co/functions/v1/musicdna-learning-dispatch",
        exportKey,
        {},
        70000,
      );
      if (
        !Number.isSafeInteger(v.delivered) ||
        v.delivered < 0 ||
        typeof v.attention_required !== "boolean"
      )
        throw Error("invalid");
      return { delivered: v.delivered, state: v.state, attention: v.attention_required };
    },
    async tick() {
      const v = await call(
        "https://yczomejrvihbmydyraqg.supabase.co/functions/v1/musicdna-learning-auto",
        reviewKey,
        { source_id: sourceId },
        15000,
      );
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
