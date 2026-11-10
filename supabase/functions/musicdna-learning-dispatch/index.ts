import { createClient } from "npm:@supabase/supabase-js@2.110.5";
import {
  createHostedDispatchHandler,
  executeHostedDispatch,
} from "../_shared/musicdna-dispatch.bundle.mjs";
// Supabase supplies this internal credential. It is never transferred to Railway.
Deno.serve(async (req: Request) => {
  if (!/^Bearer [A-Za-z0-9_-]{32,128}$/.test(req.headers.get("Authorization") ?? ""))
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ingest = Deno.env.get("MUSICDNA_ECHELON_PRODUCTION_INGEST_KEY");
  if (url !== "https://udycgnhvaanemhrchbuj.supabase.co" || !key || !ingest)
    return Response.json({ ok: false, error: "dispatch_unavailable" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    signal = AbortSignal.timeout(60000);
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await db
      .rpc(name, args)
      .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(10000)]));
    if (error) throw { code: error.code };
    return data;
  };
  return createHostedDispatchHandler({
    claim: (hash: string) => rpc("claim_musicdna_learning_worker", { p_token_hash: hash }),
    dispatch: () => executeHostedDispatch(db, key, ingest, signal),
    record: async (id: string, state: string, delivered: number, attention: boolean) => {
      await rpc("record_musicdna_learning_worker_run", {
        p_run_id: id,
        p_state: state,
        p_delivered: delivered,
        p_attention: attention,
      });
    },
  })(req);
});
