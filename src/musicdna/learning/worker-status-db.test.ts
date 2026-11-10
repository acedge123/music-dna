// @vitest-environment node
import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { randomUUID } from "node:crypto";
import { createOutboxTestDatabase, readSourceFile, OWNER } from "./testing/outbox-db";
describe.skipIf(!process.env.AB45_TEST_DATABASE_URL)("native worker operational state", () => {
  let f: Awaited<ReturnType<typeof createOutboxTestDatabase>>;
  beforeAll(async () => {
    f = await createOutboxTestDatabase(true);
    await f.sql.unsafe(
      readSourceFile("supabase/migrations/20261110150538_musicdna_worker_status.sql"),
    );
    await f.sql.unsafe(
      readSourceFile("supabase/migrations/20261110150542_musicdna_scoped_dispatch_caller.sql"),
    );
    await f.sql`INSERT INTO public.musicdna_export_scopes(source_key,environment,observed_from,expires_at,approved_by) VALUES('music-dna','production',now(),now()+interval '1 day',${OWNER})`;
  }, 30000);
  afterAll(async () => {
    await f?.close();
  });
  const receipt = (id: string, state: string) =>
    f.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE service_role`;
      await tx`SELECT public.record_musicdna_learning_worker_run(${id},${state},0,${state === "failed"})`;
    });
  it("preserves last successful history, marks failure and rejects stale completions", async () => {
    const first = randomUUID();
    await receipt(first, "started");
    await receipt(first, "completed");
    const [good] = await f.sql`SELECT last_success_at FROM public.musicdna_learning_worker_status`;
    const second = randomUUID();
    await receipt(second, "started");
    await receipt(second, "failed");
    const [bad] = await f.sql`SELECT * FROM public.musicdna_learning_worker_status`;
    expect(bad.state).toBe("failed");
    expect(bad.last_success_at).toEqual(good.last_success_at);
    await expect(receipt(first, "completed")).rejects.toMatchObject({ code: "40001" });
  });

  it("authenticates the scoped API key, throttles calls and prevents overlapping execution", async () => {
    const hash = "a".repeat(64);
    await f.sql`INSERT INTO public.musicdna_learning_worker_callers(source_key,environment,token_hash,enabled,valid_until) VALUES('music-dna','production',${hash},false,now()+interval '1 day')`;
    const claim = (h = hash) =>
      f.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`;
        return (await tx`SELECT public.claim_musicdna_learning_worker(${h}) AS v`)[0].v;
      });
    await expect(claim("b".repeat(64))).rejects.toMatchObject({ code: "42501" });
    expect((await claim()).state).toBe("disabled");
    await f.sql`UPDATE public.musicdna_learning_worker_callers SET enabled=true`;
    const first = await claim();
    expect(first.state).toBe("leased");
    expect((await claim()).state).toBe("busy");
    await receipt(first.run_id, "completed");
    expect((await claim()).state).toBe("rate_limited");
    await f.sql`UPDATE public.musicdna_learning_worker_callers SET valid_until=now()-interval '1 second'`;
    await expect(claim()).rejects.toMatchObject({ code: "42501" });
    await expect(
      f.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT public.claim_musicdna_learning_worker(${hash})`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("denies browser reads and writes", async () => {
    await expect(
      f.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT * FROM public.musicdna_learning_worker_status`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

// Browser roles cannot use the narrow caller RPC or read its verifier.
