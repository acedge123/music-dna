import { runLearningDispatch, type DispatchSummary } from "./dispatcher";
import { materializeLearningCapture } from "./outbox";
import { learningReferences } from "./references";
import { learningOutboxRepository } from "../adapters/learning-outbox";
import { learningDispatchRepository } from "../adapters/learning-dispatch-repository";
import { learningDispatchTransport } from "../adapters/learning-dispatch-transport";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function executeHostedDispatch(
  client: SupabaseClient,
  referenceSecret: string,
  ingestKey: string,
  signal: AbortSignal,
) {
  const repository = learningDispatchRepository(client, signal),
    outbox = learningOutboxRepository(client, signal),
    references = learningReferences(referenceSecret);
  const transport = learningDispatchTransport({
    signal,
    keyForScope: async (source, environment) =>
      source === "music-dna" && environment === "production" ? ingestKey : "",
  });
  return runLearningDispatch(
    { source: "music-dna", environment: "production" },
    {
      repository,
      transport,
      maxItems: 10,
      maintenance: true,
      materialize: (id) => materializeLearningCapture(id, { repository: outbox, references }),
    },
  );
}
export function createHostedDispatchHandler(deps: {
  claim(hash: string): Promise<{ state: string; run_id?: string }>;
  dispatch(): Promise<DispatchSummary>;
  record(
    id: string,
    state: "completed" | "failed",
    delivered: number,
    attention: boolean,
  ): Promise<void>;
}) {
  return async (req: Request): Promise<Response> => {
    const reply = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);
    const token = (req.headers.get("Authorization") ?? "").match(
      /^Bearer ([A-Za-z0-9_-]{32,128})$/,
    )?.[1];
    if (!token) return reply({ ok: false, error: "unauthorized" }, 401);
    // No listener data, target, actor, batch size, SQL or model parameters are accepted.
    const reader = req.body?.getReader();
    if (!reader) return reply({ ok: false, error: "invalid_request" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 256) {
          await reader.cancel();
          return reply({ ok: false, error: "invalid_request" }, 413);
        }
        chunks.push(value);
      }
    } catch {
      return reply({ ok: false, error: "invalid_request" }, 400);
    } finally {
      reader.releaseLock();
    }
    try {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const b of chunks) {
        bytes.set(b, offset);
        offset += b.length;
      }
      const v = JSON.parse(new TextDecoder().decode(bytes));
      if (!v || Array.isArray(v) || typeof v !== "object" || Object.keys(v).length)
        throw Error("invalid");
    } catch {
      return reply({ ok: false, error: "invalid_request" }, 400);
    }
    let runId: string | undefined;
    try {
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const lease = await deps.claim(hash);
      if (lease.state !== "leased") {
        if (!["disabled", "busy", "rate_limited"].includes(lease.state)) throw Error("invalid");
        return reply({
          ok: true,
          state: lease.state,
          delivered: 0,
          attention_required: lease.state === "disabled",
        });
      }
      if (!lease.run_id) throw Error("invalid");
      runId = lease.run_id;
      const s = await deps.dispatch(),
        attention = s.attention_required || s.state === "disabled";
      await deps.record(runId, attention ? "failed" : "completed", s.delivered, attention);
      return reply({
        ok: true,
        state: s.state,
        delivered: s.delivered,
        attention_required: attention,
      });
    } catch (e) {
      if (runId) {
        try {
          await deps.record(runId, "failed", 0, true);
        } catch {
          /* unavailable receipt stays unavailable; preserve last good */
        }
      }
      const code = e && typeof e === "object" && "code" in e ? e.code : null;
      return reply(
        { ok: false, error: code === "42501" ? "unauthorized" : "dispatch_unavailable" },
        code === "42501" ? 401 : 503,
      );
    }
  };
}
