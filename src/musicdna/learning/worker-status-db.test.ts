// @vitest-environment node
import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { randomUUID } from "node:crypto";
import { createOutboxTestDatabase, readSourceFile, OWNER } from "./testing/outbox-db";
describe.skipIf(!process.env.AB45_TEST_DATABASE_URL)("native worker operational state", () => {
  let f: Awaited<ReturnType<typeof createOutboxTestDatabase>>;
  beforeAll(async () => {
    f = await createOutboxTestDatabase(true);
    await f.sql.unsafe(
      readSourceFile("supabase/migrations/20261110064656_musicdna_worker_status.sql"),
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
  it("denies browser reads and writes", async () => {
    await expect(
      f.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT * FROM public.musicdna_learning_worker_status`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
