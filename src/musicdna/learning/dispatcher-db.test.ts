// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createOutboxTestDatabase, OWNER, SESSION, RESULT, SUBJECT } from "./testing/outbox-db";
import { canonicalLearningJson, mapLearningCapture, type CaptureRecord } from "./outbox";
import { learningReferences } from "./references";
import type {
  Lease,
  ClaimResult,
  BeginResult,
  DispatchOutcome,
  FinishResult,
  DispatchRepository,
  DispatchControl,
} from "./dispatcher";
import { runLearningDispatch } from "./dispatcher";

const scope = { source: "music-dna-staging" as const, environment: "staging" as const };
const refs = learningReferences("synthetic-dispatch-test-key");
const evidence = {
  version: "ledger-v2",
  answered: 6,
  unavailable: 0,
  entries: [
    { choice_id: "10000000-0000-4000-8000-000000000005", catalog_revision: "catalog-test" },
  ],
  axes: [],
};

describe.skipIf(!process.env.AB45_TEST_DATABASE_URL)("native PostgreSQL bounded dispatcher", () => {
  let fixture: Awaited<ReturnType<typeof createOutboxTestDatabase>>;
  const rpc = async (name: string, args: unknown[] = [], jsonLast = false) =>
    fixture.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE service_role`;
      const placeholders = args.map(
        (_, i) => "$" + (i + 1) + (jsonLast && i === args.length - 1 ? "::text::jsonb" : ""),
      );
      return (
        await tx.unsafe(`SELECT public.${name}(${placeholders.join(",")}) AS result`, args as never)
      )[0].result;
    });
  const claim = () =>
    rpc("claim_musicdna_learning_dispatch", [
      scope.source,
      scope.environment,
    ]) as Promise<ClaimResult>;
  const lease = async () => {
    const value = await claim();
    if (value.state !== "leased") throw new Error("test expected lease: " + JSON.stringify(value));
    return value;
  };
  const begin = (l: Lease) =>
    rpc("begin_musicdna_learning_send", [
      scope.source,
      scope.environment,
      l.kind,
      l.work_id,
      l.lease_token,
    ]) as Promise<BeginResult>;
  const finish = (l: Lease, result: DispatchOutcome) =>
    rpc(
      "finish_musicdna_learning_dispatch",
      [
        scope.source,
        scope.environment,
        l.kind,
        l.work_id,
        l.lease_token,
        result.outcome,
        "failure" in result ? result.failure : null,
        "retryAfterSeconds" in result ? (result.retryAfterSeconds ?? 0) : 0,
        "receipt" in result ? JSON.stringify(result.receipt) : null,
      ],
      true,
    ) as Promise<FinishResult>;
  const status = () =>
    fixture.sql.begin(async (tx) => {
      await tx`SET TRANSACTION READ ONLY`;
      await tx`SET LOCAL statement_timeout='10s'`;
      await tx`SET LOCAL ROLE service_role`;
      return (
        await tx`SELECT public.musicdna_learning_dispatch_status(${scope.source},${scope.environment}) AS value`
      )[0].value as DispatchControl;
    });
  const jobs = () =>
    fixture.sql`SELECT * FROM public.musicdna_learning_dispatch_jobs ORDER BY kind,work_id`;
  const observationReceipt = (id: string, eventId = randomUUID()) => ({
    ok: true,
    event_id: eventId,
    observation_id: id,
    duplicate: false,
    status: "received",
    route: "audit_only",
    agent_job_id: null,
    approval_id: null,
  });
  const deletionReceipt = (id: string) => ({
    ok: true,
    deletion_id: id,
    status: "completed",
    completed_at: new Date().toISOString(),
    purged_count: 1,
    duplicate: false,
  });
  async function resetRate() {
    await fixture.sql`UPDATE public.musicdna_learning_dispatch_rates SET next_request_at=now()-interval '1 second',cooldown_until=NULL`;
  }
  async function due() {
    await fixture.sql`UPDATE public.musicdna_learning_dispatch_jobs SET next_attempt_at=now()-interval '1 second' WHERE state='retry'`;
    await resetRate();
  }
  async function expireLease() {
    await fixture.sql`UPDATE public.musicdna_learning_dispatch_jobs SET lease_until=now()-interval '1 second' WHERE state='leased'`;
    await resetRate();
  }
  async function observation(key = randomUUID()) {
    await fixture.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claim.sub',${OWNER},true)`;
      await tx.unsafe("SELECT public.save_result_feedback($1,$2::text::jsonb)", [
        SESSION,
        JSON.stringify({
          mutation_id: key,
          result_version: 1,
          accuracy: "accurate",
          rating: 1,
          comment: "PRIVATE",
          target: null,
          most_accurate_sentence: null,
          least_accurate_sentence: null,
        }),
      ]);
    });
    const row = (
      await fixture.sql`SELECT * FROM public.musicdna_learning_outbox WHERE state='captured' ORDER BY created_at LIMIT 1`
    )[0];
    const record = {
      observationId: row.observation_id,
      feedbackId: row.feedback_id,
      state: row.state,
      scope: { ...scope, tenantId: row.receiver_tenant_id },
      projection: row.projection,
    } as CaptureRecord;
    const body = canonicalLearningJson(await mapLearningCapture(record, refs));
    await rpc("materialize_musicdna_learning_observation", [record.observationId, body]);
    return { id: record.observationId, body };
  }
  const withdraw = () =>
    rpc("request_musicdna_learning_withdrawal", [
      scope.source,
      scope.environment,
      SUBJECT,
      randomUUID(),
      "withdrawal",
    ]);
  beforeAll(async () => {
    fixture = await createOutboxTestDatabase(true);
  }, 30000);
  beforeEach(async () => {
    await fixture.sql`TRUNCATE public.sessions,public.musicdna_export_scopes CASCADE`;
    await fixture.sql`INSERT INTO auth.users VALUES(${OWNER}) ON CONFLICT DO NOTHING`;
    await fixture.sql`INSERT INTO public.sessions(id,user_id,completed_at) VALUES(${SESSION},${OWNER},now())`;
    await fixture.sql`INSERT INTO public.session_results(id,session_id,user_id,version,source,content,evidence,ledger_version,policy_version,engine_version)
      VALUES(${RESULT},${SESSION},${OWNER},1,'pairings','{"synthesis":"PRIVATE"}',${fixture.sql.json(evidence)},'ledger-v2','claims-test','engine-test')`;
    await fixture.sql`INSERT INTO public.musicdna_export_scopes(source_key,environment,observed_from,expires_at,approved_by,capture_enabled,dispatch_enabled,receiver_tenant_id)
      VALUES(${scope.source},${scope.environment},now()-interval '1 day',now()+interval '1 day',${OWNER},true,true,'tenant-a')`;
    await fixture.sql`INSERT INTO public.musicdna_learning_enrollments(result_id,session_id,owner_user_id,source_key,environment,receiver_tenant_id,subject_ref,decision_ref,result_ref,result_fingerprint,approved_by)
      SELECT r.id,r.session_id,r.user_id,${scope.source},${scope.environment},'tenant-a',${SUBJECT},${"d_" + "b".repeat(64)},${"r_" + "c".repeat(64)},musicdna_learning_private.result_fingerprint(r),${OWNER} FROM public.session_results r WHERE id=${RESULT}`;
  });
  afterAll(async () => {
    await fixture?.close();
  });

  it("defaults dispatch off, retains recoverable payloads and performs no claim writes", async () => {
    const row = await observation();
    await fixture.sql`UPDATE public.musicdna_export_scopes SET dispatch_enabled=false`;
    expect(await claim()).toEqual({ state: "disabled" });
    expect(await jobs()).toHaveLength(0);
    expect(
      (
        await fixture.sql`SELECT canonical_envelope FROM public.musicdna_learning_outbox WHERE observation_id=${row.id}`
      )[0].canonical_envelope,
    ).toBe(row.body);
  });
  it("leases one logical observation to only one of twelve duplicate workers", async () => {
    await observation();
    const claimed = await Promise.all(Array.from({ length: 12 }, claim));
    expect(claimed.filter((r) => r.state === "leased")).toHaveLength(1);
    expect(await jobs()).toHaveLength(1);
    expect((await jobs())[0]).toMatchObject({ claims: 1, attempts: 0 });
  });
  it("never acknowledges a claim before send authorization or an unvalidated receipt", async () => {
    const row = await observation();
    const l = await lease();
    expect(await finish(l, { outcome: "delivered", receipt: observationReceipt(row.id) })).toEqual({
      state: "stale",
    });
    expect((await begin(l)).state).toBe("send");
    await expect(
      finish(l, {
        outcome: "delivered",
        receipt: { ...observationReceipt(row.id), agent_job_id: randomUUID() },
      }),
    ).rejects.toMatchObject({ code: "22023" });
    expect((await jobs())[0]).toMatchObject({ state: "leased", receipt_id: null });
  });
  it("enforces single-use send authorization and one request per second across workers", async () => {
    await observation();
    await observation();
    const first = await lease(),
      second = await lease();
    expect((await begin(first)).state).toBe("send");
    expect((await begin(first)).state).toBe("stale");
    expect((await begin(second)).state).toBe("rate_limited");
    expect((await jobs()).reduce((sum, r) => sum + r.attempts, 0)).toBe(1);
  });
  it("recovers a crash before send without counting an HTTP attempt or reusing the old token", async () => {
    await observation();
    const first = await lease();
    await expireLease();
    const second = await lease();
    expect(second.work_id).toBe(first.work_id);
    expect(second.lease_token).not.toBe(first.lease_token);
    expect((await begin(first)).state).toBe("stale");
    expect((await jobs())[0]).toMatchObject({ claims: 2, attempts: 0 });
  });
  it("retries exact content after remote acceptance/ack loss and rejects a stale lease acknowledgement", async () => {
    const row = await observation();
    const first = await lease();
    const send1 = await begin(first);
    if (send1.state !== "send") throw new Error("test expected send");
    const remoteId = randomUUID(); // Fake receiver accepted before the worker died.
    await expireLease();
    const second = await lease();
    const send2 = await begin(second);
    if (send2.state !== "send") throw new Error("test expected send");
    expect(send2.body).toBe(send1.body);
    expect(send2.body).toBe(row.body);
    expect(
      await finish(first, { outcome: "delivered", receipt: observationReceipt(row.id, remoteId) }),
    ).toEqual({ state: "stale" });
    expect(
      await finish(second, {
        outcome: "delivered",
        receipt: { ...observationReceipt(row.id, remoteId), duplicate: true },
      }),
    ).toEqual({ state: "delivered", receipt_id: remoteId });
    expect((await jobs())[0]).toMatchObject({
      state: "delivered",
      attempts: 2,
      claims: 2,
      receipt_id: remoteId,
    });
    await resetRate();
    expect(await claim()).toEqual({ state: "idle" });
  });
  it("retains committed acknowledgement if the worker dies before observing its response", async () => {
    const row = await observation(),
      l = await lease();
    await begin(l);
    await finish(l, { outcome: "delivered", receipt: observationReceipt(row.id) });
    await resetRate();
    expect(await claim()).toEqual({ state: "idle" });
    expect((await jobs())[0].state).toBe("delivered");
  });
  it("uses bounded server backoff/jitter and honors Retry-After without changing payloads", async () => {
    const row = await observation(),
      l = await lease();
    await begin(l);
    const result = await finish(l, {
      outcome: "retry",
      failure: "rate_limited",
      retryAfterSeconds: 37,
    });
    expect(result.state).toBe("retry");
    const saved = (await jobs())[0];
    const seconds = (saved.next_attempt_at.getTime() - Date.now()) / 1000;
    expect(seconds).toBeGreaterThan(35);
    expect(seconds).toBeLessThanOrEqual(38);
    await resetRate();
    expect(await claim()).toEqual({ state: "idle" });
    await due();
    const next = await lease();
    const send = await begin(next);
    expect(send.state === "send" && send.body).toBe(row.body);
  });
  it.each(["auth_rejected", "source_disabled", "configuration"] as const)(
    "halts the scope on %s until an operator clears it",
    async (failure) => {
      await observation();
      const l = await lease();
      await begin(l);
      expect((await finish(l, { outcome: "halted", failure })).state).toBe("halted");
      expect(await claim()).toMatchObject({ state: "halted", reason: failure });
      expect((await status()).halt_reason).toBe(failure);
      await expect(
        fixture.sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE service_role`;
          await tx`UPDATE public.musicdna_learning_dispatch_halts SET cleared_at=now()`;
        }),
      ).rejects.toMatchObject({ code: "42501" });
      await fixture.sql`UPDATE public.musicdna_learning_dispatch_halts SET cleared_at=now(),cleared_by=${OWNER}`;
      await due();
      expect((await claim()).state).toBe("leased");
    },
  );
  it("opens a cooldown circuit after five transient failures instead of a retry storm", async () => {
    await observation();
    for (let i = 0; i < 5; i++) {
      await due();
      const l = await lease();
      await begin(l);
      await finish(l, { outcome: "retry", failure: "server_error" });
    }
    const value = await claim();
    expect(value.state).toBe("rate_limited");
    if (value.state === "rate_limited") expect(value.retry_after_ms).toBeGreaterThan(290000);
    expect((await status()).cooldown_until).not.toBeNull();
  });
  it("quarantines exhausted work, permits one operator-authorized replay, and keeps IDs immutable", async () => {
    const row = await observation();
    const l = await lease();
    await fixture.sql`UPDATE public.musicdna_learning_dispatch_jobs SET attempts=8,lease_until=now()-interval '1 second'`;
    expect(await claim()).toEqual({ state: "idle" });
    expect((await jobs())[0]).toMatchObject({
      state: "quarantined",
      last_failure: "retry_exhausted",
    });
    await expect(
      fixture.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`;
        await tx`UPDATE public.musicdna_learning_dispatch_jobs SET replay_count=1`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
    await fixture.sql`UPDATE public.musicdna_learning_dispatch_jobs SET replay_count=1,state='retry',next_attempt_at=now()`;
    const replay = await lease();
    expect(replay.work_id).toBe(row.id);
    expect(replay.work_id).toBe(l.work_id);
  });
  it("quarantines old observations and leaves overdue deletion obligations pending with attention", async () => {
    await observation();
    await claim();
    await fixture.sql`UPDATE public.musicdna_learning_dispatch_jobs SET created_at=now()-interval '25 hours',lease_until=now()-interval '1 second'`;
    expect(await claim()).toEqual({ state: "idle" });
    expect((await jobs())[0].last_failure).toBe("max_age");
    await withdraw();
    await fixture.sql`UPDATE public.musicdna_export_withdrawals SET requested_at=now()-interval '8 days'`;
    expect(await claim()).toEqual({ state: "idle" });
    expect((await status()).pending_deletions).toBe(1);
    expect((await status()).job_counts.quarantined).toBe(2);
  });
  it.each(["invalid_payload", "observation_conflict", "invalid_receipt"] as const)(
    "permanently quarantines %s without changing immutable bytes",
    async (failure) => {
      const row = await observation(),
        l = await lease();
      await begin(l);
      expect((await finish(l, { outcome: "quarantined", failure })).state).toBe("quarantined");
      await resetRate();
      expect(await claim()).toEqual({ state: "idle" });
      expect(
        (
          await fixture.sql`SELECT canonical_envelope FROM public.musicdna_learning_outbox WHERE observation_id=${row.id}`
        )[0].canonical_envelope,
      ).toBe(row.body);
    },
  );
  it("rechecks withdrawal after claim and gives deletion priority over observations", async () => {
    await observation();
    const first = await lease();
    await withdraw();
    expect((await begin(first)).state).toBe("cancelled");
    const deletion = await lease();
    expect(deletion.kind).toBe("deletion");
  });
  it("a late observation acknowledgement cannot undo source withdrawal", async () => {
    const row = await observation(),
      l = await lease();
    await begin(l);
    await withdraw();
    expect(await finish(l, { outcome: "delivered", receipt: observationReceipt(row.id) })).toEqual({
      state: "cancelled",
    });
    expect((await jobs())[0].receipt_id).toBeNull();
    expect((await status()).pending_deletions).toBe(1);
  });
  it("delivers a validated deletion even when capture is off and scope expired", async () => {
    await observation();
    await withdraw();
    await fixture.sql`UPDATE public.musicdna_export_scopes SET capture_enabled=false,expires_at=now()-interval '1 second'`;
    const l = await lease();
    expect(l.kind).toBe("deletion");
    expect((await begin(l)).state).toBe("send");
    expect(
      (await finish(l, { outcome: "delivered", receipt: deletionReceipt(l.work_id) })).state,
    ).toBe("delivered");
    const row = (
      await fixture.sql`SELECT completed_at,subject_ref FROM public.musicdna_export_withdrawals`
    )[0];
    expect(row.completed_at).not.toBeNull();
    expect(row.subject_ref).toBeNull();
  });
  it("does not acknowledge mismatching deletion receipts or allow the old unleased completion path", async () => {
    await withdraw();
    const l = await lease();
    await begin(l);
    await expect(
      finish(l, { outcome: "delivered", receipt: deletionReceipt(randomUUID()) }),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc("finish_musicdna_learning_withdrawal", [
        scope.source,
        scope.environment,
        l.work_id,
        new Date().toISOString(),
        1,
        null,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await status()).pending_deletions).toBe(1);
  });
  it("rolls deletion completion and receipt metadata back together on acknowledgement storage failure", async () => {
    await withdraw();
    const l = await lease();
    await begin(l);
    await fixture.sql
      .unsafe(`CREATE FUNCTION public.ab47_ack_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='delivered' THEN RAISE EXCEPTION 'synthetic ack fault'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER ab47_ack_fault BEFORE UPDATE ON public.musicdna_learning_dispatch_jobs FOR EACH ROW EXECUTE FUNCTION public.ab47_ack_fault()`);
    try {
      await expect(
        finish(l, { outcome: "delivered", receipt: deletionReceipt(l.work_id) }),
      ).rejects.toMatchObject({ code: "P0001" });
      expect(
        (await fixture.sql`SELECT completed_at FROM public.musicdna_export_withdrawals`)[0]
          .completed_at,
      ).toBeNull();
      expect((await jobs())[0]).toMatchObject({ state: "leased", receipt_id: null });
    } finally {
      await fixture.sql`DROP TRIGGER ab47_ack_fault ON public.musicdna_learning_dispatch_jobs`;
      await fixture.sql`DROP FUNCTION public.ab47_ack_fault()`;
    }
    expect(
      (await finish(l, { outcome: "delivered", receipt: deletionReceipt(l.work_id) })).state,
    ).toBe("delivered");
  });
  it("rechecks max age at send authorization with an accurate quarantine reason", async () => {
    await observation();
    const l = await lease();
    await fixture.sql`UPDATE public.musicdna_learning_dispatch_jobs SET created_at=now()-interval '25 hours'`;
    expect(await begin(l)).toEqual({ state: "quarantined", reason: "max_age" });
    expect((await jobs())[0].attempts).toBe(0);
  });
  it("preserves an old enrollment's tenant binding and halts instead of deleting another tenant", async () => {
    await fixture.sql`UPDATE public.musicdna_export_scopes SET receiver_tenant_id='tenant-b'`;
    await fixture.sql`DELETE FROM public.musicdna_learning_enrollments WHERE result_id=${RESULT}`;
    expect(
      (await fixture.sql`SELECT receiver_tenant_id FROM public.musicdna_export_withdrawals`)[0]
        .receiver_tenant_id,
    ).toBe("tenant-a");
    const l = await lease();
    expect(await begin(l)).toEqual({ state: "halted", reason: "binding_changed" });
  });
  it("never invents binding for older pending deletion rows lacking immutable tenant provenance", async () => {
    await withdraw();
    await fixture.sql`UPDATE public.musicdna_export_withdrawals SET receiver_tenant_id=NULL`;
    expect(await claim()).toEqual({ state: "idle" });
    expect((await jobs())[0]).toMatchObject({
      state: "quarantined",
      last_failure: "missing_binding",
    });
    expect((await status()).pending_deletions).toBe(1);
  });
  it("does not starve new work behind the first hundred already-delivered source rows", async () => {
    for (let i = 0; i < 101; i++) await observation();
    await fixture.sql`INSERT INTO public.musicdna_learning_dispatch_jobs(source_key,environment,kind,work_id,receiver_tenant_id,state,completed_at,receipt_id)
      SELECT source_key,environment,'observation',observation_id,receiver_tenant_id,'delivered',now(),gen_random_uuid() FROM public.musicdna_learning_outbox ORDER BY created_at LIMIT 100`;
    expect((await lease()).kind).toBe("observation");
    expect(await jobs()).toHaveLength(101);
  });
  it("exposes numeric/operator traces only in READ ONLY and keeps private mutation access restricted", async () => {
    const row = await observation();
    await lease();
    const s = await status();
    expect(s.job_counts.leased).toBe(1);
    expect(s.attempts_started).toBe(0);
    const inspect = await fixture.sql.begin(async (tx) => {
      await tx`SET TRANSACTION READ ONLY`;
      await tx`SET LOCAL statement_timeout='10s'`;
      await tx`SET LOCAL ROLE service_role`;
      return (
        await tx`SELECT public.inspect_musicdna_learning_dispatch(${scope.source},${scope.environment},${row.id}) AS data`
      )[0].data;
    });
    expect(inspect[0].work_id).toBe(row.id);
    expect(JSON.stringify(inspect)).not.toContain("lease_token");
    expect(JSON.stringify(inspect)).not.toContain(SUBJECT);
    for (const role of ["anon", "authenticated"]) {
      for (const statement of [
        "SELECT * FROM public.musicdna_learning_dispatch_jobs",
        "SELECT * FROM public.musicdna_learning_dispatch_halts",
        `SELECT public.claim_musicdna_learning_dispatch('${scope.source}','staging')`,
        `SELECT public.musicdna_learning_dispatch_status('${scope.source}','staging')`,
      ])
        await expect(
          fixture.sql.begin(async (tx) => {
            await tx.unsafe(`SET LOCAL ROLE ${role}`);
            await tx.unsafe(statement);
          }),
        ).rejects.toMatchObject({ code: "42501" });
    }
    await expect(
      fixture.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`;
        await tx`UPDATE public.musicdna_export_scopes SET dispatch_enabled=true`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("retains unresolved privacy jobs during metadata cleanup and removes expired observation metadata", async () => {
    await observation();
    await lease();
    await withdraw();
    await claim();
    await fixture.sql`UPDATE public.musicdna_export_scopes SET observed_from=now()-interval '20 days',expires_at=now()-interval '8 days'`;
    expect(await rpc("purge_musicdna_learning_dispatch", [100])).toBe(1);
    expect((await jobs()).map((r) => r.kind)).toEqual(["deletion"]);
    expect((await status()).pending_deletions).toBe(1);
  });
  it("runs the bounded worker against actual lease/ack SQL and an idempotent fake receiver", async () => {
    const row = await observation();
    let clock = Date.now();
    const repository: DispatchRepository = {
      status: () => status(),
      recoverable: async () => [],
      claim: () => claim(),
      begin: (_s, l) => begin(l),
      finish: (_s, l, r) => finish(l, r),
      maintain: async () => ({
        purged_outbox: 0,
        purged_enrollments: 0,
        purged_jobs: 0,
        purged_completed_withdrawals: 0,
      }),
    };
    const sent: string[] = [];
    const summary = await runLearningDispatch(scope, {
      repository,
      maxItems: 1,
      materialize: async () => null,
      now: () => clock,
      delay: async (ms) => {
        clock += ms;
      },
      transport: {
        send: async (_s, kind, body) => {
          expect(kind).toBe("observation");
          sent.push(body);
          return { status: 200, body: observationReceipt(row.id), retryAfter: null };
        },
      },
    });
    expect(summary.delivered).toBe(1);
    expect(summary.http_responses).toBe(1);
    expect(sent).toEqual([row.body]);
    expect((await status()).job_counts.delivered).toBe(1);
  });
});
