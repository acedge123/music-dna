import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const approver = "10000000-0000-4000-8000-000000000001";
const subject = "s_" + "a".repeat(64),
  other = "s_" + "b".repeat(64);
let db: PGlite;
async function rpc(name: string, args: unknown[]) {
  return (
    await db.query<{ result: unknown }>(
      `SELECT public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) AS result`,
      args,
    )
  ).rows[0].result;
}
const allowed = () =>
  rpc("musicdna_learning_export_allowed", [
    "music-dna-staging",
    "staging",
    subject,
    new Date().toISOString(),
  ]);
const request = (
  ref = subject,
  id: string = randomUUID(),
  reason = "withdrawal",
  source = "music-dna-staging",
  env = "staging",
) =>
  rpc("request_musicdna_learning_withdrawal", [source, env, ref, id, reason]) as Promise<{
    deletion_id: string;
    status: string;
    requested_at: string;
    completed_at: string | null;
  }>;
const finish = (id: string, failure: string | null = null) =>
  rpc("finish_musicdna_learning_withdrawal", [
    "music-dna-staging",
    "staging",
    id,
    failure ? null : new Date().toISOString(),
    failure ? null : 2,
    failure,
  ]);

describe.sequential(
  "source synthetic lifecycle (isolated PostgreSQL/PGlite, no production)",
  () => {
    beforeAll(async () => {
      db = new PGlite();
      await db.exec(
        "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;",
      );
      await db.exec(
        await readFile(
          "supabase/migrations/20261107202345_musicdna_synthetic_learning_lifecycle.sql",
          "utf8",
        ),
      );
      await db.query<Record<string, unknown>>("INSERT INTO auth.users VALUES($1)", [approver]);
    }, 20000);
    beforeEach(async () => {
      await db.exec("RESET ROLE; TRUNCATE public.musicdna_export_scopes CASCADE;");
      await db.query<Record<string, unknown>>(
        "INSERT INTO public.musicdna_export_scopes(source_key,environment,observed_from,expires_at,approved_by) VALUES('music-dna-staging','staging',now()-interval '1 day',now()+interval '1 day',$1)",
        [approver],
      );
      await db.exec("SET ROLE service_role");
    });
    afterAll(async () => {
      await db?.close();
    });
    it("defaults off without an operator-approved synthetic scope", async () => {
      expect(await allowed()).toBe(true);
      await db.exec("RESET ROLE; DELETE FROM public.musicdna_export_scopes; SET ROLE service_role");
      expect(await allowed()).toBe(false);
      await expect(request()).rejects.toMatchObject({ code: "42501" });
    });
    it("withdraws immediately before any send and durably queues minimal deletion evidence", async () => {
      const result = await request();
      expect(result.status).toBe("pending");
      expect(await allowed()).toBe(false);
      const rows = await db.query<Record<string, unknown>>(
        "SELECT * FROM public.musicdna_export_withdrawals",
      );
      expect(rows.rows).toHaveLength(1);
      expect(Object.keys(rows.rows[0])).not.toEqual(
        expect.arrayContaining(["payload", "email", "user_id", "conversation"]),
      );
    });
    it("keeps an offline receiver pending while export remains blocked, then clears the routing reference on ack", async () => {
      const result = await request();
      await finish(result.deletion_id, "unavailable");
      expect(await allowed()).toBe(false);
      let row = (
        await db.query<Record<string, unknown>>(
          "SELECT completed_at,attempts,last_failure,subject_ref FROM public.musicdna_export_withdrawals",
        )
      ).rows[0];
      expect(row).toMatchObject({
        completed_at: null,
        attempts: 1,
        last_failure: "unavailable",
        subject_ref: subject,
      });
      await finish(result.deletion_id);
      row = (
        await db.query<Record<string, unknown>>(
          "SELECT completed_at,attempts,last_failure,subject_ref FROM public.musicdna_export_withdrawals",
        )
      ).rows[0];
      expect(row.completed_at).not.toBeNull();
      expect(row).toMatchObject({ attempts: 2, last_failure: null, subject_ref: null });
      expect(await allowed()).toBe(false);
    });
    it("preserves the first deletion ID and request clock across retries and later reasons", async () => {
      const first = await request();
      expect(await request(subject, first.deletion_id)).toEqual(first);
      expect(await request(subject, randomUUID(), "deletion")).toEqual(first);
      await finish(first.deletion_id);
      const after = await request();
      expect(after.status).toBe("completed");
      expect(after.deletion_id).toBe(first.deletion_id);
      expect(after.requested_at).toBe(first.requested_at);
    });
    it("rejects request ID rebinding and wrong-source completion", async () => {
      const first = await request();
      await expect(request(other, first.deletion_id)).rejects.toMatchObject({ code: "23505" });
      await expect(request(subject, first.deletion_id, "retention")).rejects.toMatchObject({
        code: "23505",
      });
      await expect(
        rpc("finish_musicdna_learning_withdrawal", [
          "music-dna",
          "production",
          first.deletion_id,
          new Date().toISOString(),
          1,
          null,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
    });
    it("cannot resurrect a completed request with a late failure or duplicate acknowledgement", async () => {
      const first = await request();
      await finish(first.deletion_id);
      const before = (
        await db.query<Record<string, unknown>>("SELECT * FROM public.musicdna_export_withdrawals")
      ).rows;
      await finish(first.deletion_id, "unavailable");
      await finish(first.deletion_id);
      expect(
        (
          await db.query<Record<string, unknown>>(
            "SELECT * FROM public.musicdna_export_withdrawals",
          )
        ).rows,
      ).toEqual(before);
    });
    it("rejects malformed/future/missing completion evidence", async () => {
      const first = await request();
      for (const args of [
        [null, null, null],
        [new Date().toISOString(), -1, null],
        [new Date(Date.now() + 3600000).toISOString(), 1, null],
        [null, null, "anything"],
      ])
        await expect(
          rpc("finish_musicdna_learning_withdrawal", [
            "music-dna-staging",
            "staging",
            first.deletion_id,
            ...args,
          ]),
        ).rejects.toMatchObject({ code: "22023" });
      expect((await request()).status).toBe("pending");
    });
    it("expires completed markers only after the fixed scope closes, never silently drops an offline task", async () => {
      const completed = await request();
      await finish(completed.deletion_id);
      await request(other);
      expect(await rpc("purge_completed_musicdna_learning_withdrawals", [100])).toBe(0);
      await db.exec(
        "RESET ROLE; UPDATE public.musicdna_export_scopes SET observed_from=now()-interval '10 days',expires_at=now()-interval '8 days'; SET ROLE service_role",
      );
      expect(await rpc("purge_completed_musicdna_learning_withdrawals", [1])).toBe(1);
      expect(await allowed()).toBe(false);
      expect(
        (
          await db.query<Record<string, unknown>>(
            "SELECT subject_ref,completed_at FROM public.musicdna_export_withdrawals",
          )
        ).rows,
      ).toEqual([{ subject_ref: other, completed_at: null }]);
    });
    it("keeps source/environment purposes isolated and rejects arbitrary user identifiers", async () => {
      await expect(
        request(subject, randomUUID(), "withdrawal", "music-dna", "staging"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(request("user@example.com")).rejects.toMatchObject({ code: "22023" });
      expect(
        await rpc("musicdna_learning_export_allowed", [
          "music-dna",
          "production",
          subject,
          new Date().toISOString(),
        ]),
      ).toBe(false);
      expect(
        await rpc("musicdna_learning_export_allowed", [
          "music-dna-staging",
          "staging",
          "raw-user-id",
          new Date().toISOString(),
        ]),
      ).toBe(false);
    });
    it("allows retention propagation after expiry without enabling export", async () => {
      await db.exec(
        "RESET ROLE; UPDATE public.musicdna_export_scopes SET observed_from=now()-interval '2 days',expires_at=now()-interval '1 day'; SET ROLE service_role",
      );
      expect((await request(subject, randomUUID(), "retention")).status).toBe("pending");
      expect(await allowed()).toBe(false);
    });
    it("does not let clients read/alter scope, eligibility, withdrawals or retention", async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`RESET ROLE; SET ROLE ${role}`);
        for (const sql of [
          "SELECT * FROM public.musicdna_export_scopes",
          "SELECT * FROM public.musicdna_export_withdrawals",
          "DELETE FROM public.musicdna_export_withdrawals",
          "SELECT public.purge_completed_musicdna_learning_withdrawals(1)",
        ])
          await expect(db.exec(sql)).rejects.toMatchObject({ code: "42501" });
        await expect(allowed()).rejects.toMatchObject({ code: "42501" });
        await expect(request()).rejects.toMatchObject({ code: "42501" });
      }
      await db.exec("RESET ROLE; SET ROLE service_role");
      await expect(
        db.exec("UPDATE public.musicdna_export_scopes SET expires_at=now()+interval '30 days'"),
      ).rejects.toMatchObject({ code: "42501" });
    });
  },
);
