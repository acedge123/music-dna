import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const sid = "11111111-1111-4111-8111-111111111111",
  owner = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  first = "44444444-4444-4444-8444-444444444444",
  second = "55555555-5555-4555-8555-555555555555";
let db: PGlite;
const props = (answered = 1, thesis = "Exact first saved response") => ({
  answered,
  result: { thesis },
});
async function save(answered = 1, pairing = first, user = owner, value = props(answered)) {
  return (
    await db.query<{ result: unknown }>(
      "SELECT public.save_musicdna_deferred_read($1,$2,$3,$4,$5::jsonb) AS result",
      [sid, user, pairing, answered, JSON.stringify(value)],
    )
  ).rows[0].result;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.sessions(id uuid PRIMARY KEY,user_id uuid,completed_at timestamptz);
    CREATE TABLE public.choices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid,pairing_id uuid,created_at timestamptz DEFAULT clock_timestamp());
    CREATE TABLE public.event_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,session_id uuid,event_type text,props jsonb,created_at timestamptz DEFAULT clock_timestamp());
    GRANT SELECT,UPDATE ON public.sessions TO service_role;
    GRANT SELECT ON public.choices TO service_role;
    GRANT SELECT,INSERT ON public.event_log TO service_role;`);
  await db.exec(
    await readFile("supabase/migrations/20261112183759_musicdna_deferred_read_cursor.sql", "utf8"),
  );
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("RESET ROLE; TRUNCATE public.sessions,public.choices,public.event_log;");
  await db.query("INSERT INTO public.sessions(id,user_id) VALUES($1,$2)", [sid, owner]);
  await db.query("INSERT INTO public.choices(session_id,pairing_id) VALUES($1,$2)", [sid, first]);
  await db.exec("SET ROLE service_role");
});
describe("atomic deferred read compare-and-save", () => {
  it("saves exactly one response and replays it when a concurrent draft arrives", async () => {
    expect(await save()).toEqual(props().result);
    expect(await save(1, first, owner, props(1, "Different late draft"))).toEqual(props().result);
    expect((await db.query("SELECT id FROM public.event_log")).rows).toHaveLength(1);
  });
  it("cannot insert an older response after the next pick has committed", async () => {
    await db.exec("RESET ROLE");
    await db.query("INSERT INTO public.choices(session_id,pairing_id) VALUES($1,$2)", [
      sid,
      second,
    ]);
    await db.exec("SET ROLE service_role");
    expect(await save()).toBeNull();
    expect((await db.query("SELECT id FROM public.event_log")).rows).toHaveLength(0);
    expect(await save(2, second)).toEqual(props(2).result);
  });
  it("rejects wrong positions, wrong owners and a completed session without writes", async () => {
    expect(await save(2)).toBeNull();
    expect(await save(1, second)).toBeNull();
    expect(await save(1, first, other)).toBeNull();
    await db.exec("RESET ROLE");
    await db.query("UPDATE public.sessions SET completed_at=now() WHERE id=$1", [sid]);
    await db.exec("SET ROLE service_role");
    expect(await save()).toBeNull();
    expect((await db.query("SELECT id FROM public.event_log")).rows).toHaveLength(0);
  });
  it("denies listener roles and does not use security definer", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`RESET ROLE; SET ROLE ${role}`);
      await expect(save()).rejects.toThrow(/permission denied/);
    }
    await db.exec("RESET ROLE");
    expect(
      (
        await db.query<{ prosecdef: boolean }>(
          "SELECT prosecdef FROM pg_proc WHERE proname='save_musicdna_deferred_read'",
        )
      ).rows[0].prosecdef,
    ).toBe(false);
  });
  it("refuses a payload whose result position disagrees with the frozen cursor", async () => {
    await expect(save(1, first, owner, props(2))).rejects.toThrow("invalid_read_cursor");
    expect((await db.query("SELECT id FROM public.event_log")).rows).toHaveLength(0);
  });
});
