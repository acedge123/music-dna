// @vitest-environment node
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { createRoutingTestDatabase } from "./testing/routing-db";
import { OWNER, OTHER, SESSION, readSourceFile } from "./testing/outbox-db";
const version = "sha256:" + "a".repeat(64),
  consent = randomUUID(),
  approval = randomUUID();
describe.skipIf(!process.env.AB45_TEST_DATABASE_URL)("native invited pilot", () => {
  let f: Awaited<ReturnType<typeof createRoutingTestDatabase>>,
    design: Record<string, unknown>,
    consented: string;
  const role = <T>(
    r: "authenticated" | "service_role",
    fn: (tx: TransactionSql) => Promise<T>,
    user = OWNER,
  ) =>
    f.sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE " + r);
      await tx`SELECT set_config('request.jwt.claim.sub',${r === "authenticated" ? user : ""},true)`;
      return fn(tx);
    });
  const enroll = (owner = OWNER, d = design) =>
    role(
      "service_role",
      async (tx) =>
        (
          await tx`SELECT public.enroll_musicdna_pilot_participant(${owner},${tx.json(d)},${consent},${consented},${approval}) AS e`
        )[0].e,
    );
  const session = async (id = SESSION, owner = OWNER) =>
    f.sql`INSERT INTO public.sessions(id,user_id,vector) VALUES(${id},${owner},'{}')`;
  const prepare = (id = SESSION, owner = OWNER, pin = version) =>
    role(
      "service_role",
      async (tx) =>
        (await tx`SELECT public.prepare_musicdna_pilot_session(${id},${owner},${pin}) AS a`)[0].a,
    );
  const withdraw = () =>
    role(
      "service_role",
      async (tx) =>
        (
          await tx`SELECT public.withdraw_musicdna_pilot_participant(${OWNER},${String(design.experiment_id)}) AS a`
        )[0].a,
    );
  beforeAll(async () => {
    f = await createRoutingTestDatabase();
    await f.sql
      .unsafe(`CREATE TABLE public.experiment_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,experiment_key text,variant text,assigned_at timestamptz DEFAULT now(),UNIQUE(user_id,experiment_key));
   GRANT SELECT,INSERT ON public.experiment_assignments TO authenticated; GRANT ALL ON public.experiment_assignments TO service_role;
   ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users read their own assignments" ON public.experiment_assignments FOR SELECT TO authenticated USING(user_id=auth.uid());
   CREATE POLICY "users insert their own assignments" ON public.experiment_assignments FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());`);
    const dir = new URL("../../../supabase/migrations/", import.meta.url);
    const files = readdirSync(dir).filter(
      (name) =>
        name.endsWith(".sql") &&
        readFileSync(new URL(name, dir), "utf8").includes(
          "CREATE FUNCTION public.enroll_musicdna_pilot_participant(",
        ),
    );
    if (files.length !== 1) throw Error("Expected one invited-pilot migration");
    await f.sql.unsafe(readSourceFile("supabase/migrations/" + files[0]));
  }, 30000);
  afterAll(async () => {
    await f?.close();
  });
  beforeEach(async () => {
    await f.sql`TRUNCATE public.sessions,public.experiment_assignments,public.event_log,public.musicdna_export_scopes CASCADE`;
    consented = new Date(Date.now() - 1000).toISOString();
    design = {
      experiment_id: "ab52.test.v1",
      policy_id: "musicdna-selector",
      policy_version: version,
      strategy_version: version,
      eligibility_version: "invited-adult-testflight.v1",
      measurement_window_seconds: 86400,
      enrollment_closes_at: new Date(Date.now() + 86400000).toISOString(),
      max_participants: 2,
      metric_version: "first-result-perceived-accuracy.v1",
      allocation: "random_50_50",
    };
  });
  it("randomizes once, preserves replay and prevents plan/consent changes", async () => {
    const e = await enroll();
    expect(["control", "treatment"]).toContain(e.variant);
    expect(await enroll()).toMatchObject({
      enrollment_id: e.enrollment_id,
      variant: e.variant,
      duplicate: true,
    });
    await expect(
      enroll(OWNER, { ...design, measurement_window_seconds: 7200 }),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      enroll(OTHER, { ...design, allocation: "owner_qa_treatment" }),
    ).rejects.toMatchObject({ code: "23505" });
  });
  it("denies forged invitations, hidden arm reads and operator RPCs to listeners", async () => {
    await enroll();
    expect(
      await role("authenticated", (tx) => tx`SELECT id FROM public.experiment_assignments`),
    ).toHaveLength(0);
    await expect(
      role(
        "authenticated",
        (tx) =>
          tx`INSERT INTO public.experiment_assignments(user_id,experiment_key,variant) VALUES(${OTHER},'ab52.fake','treatment')`,
        OTHER,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      role(
        "authenticated",
        (tx) => tx`SELECT public.prepare_musicdna_pilot_session(${SESSION},${OWNER},${version})`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      role(
        "authenticated",
        (tx) => tx`SELECT public.read_musicdna_pilot_cohort('ab52.test.v1',now())`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      role(
        "authenticated",
        (tx) =>
          tx`INSERT INTO public.event_log(user_id,event_type,client,props) VALUES(${OWNER},'ab52_pilot_withdrawn','server','{}')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("leaves older ordinary experiment behavior unchanged", async () => {
    await role(
      "authenticated",
      (tx) =>
        tx`INSERT INTO public.experiment_assignments(user_id,experiment_key,variant) VALUES(${OWNER},'ordinary-exp','a')`,
    );
    expect(
      await role("authenticated", (tx) => tx`SELECT variant FROM public.experiment_assignments`),
    ).toHaveLength(1);
  });
  it("binds one new session atomically and does not rebucket across resume or another session", async () => {
    await enroll();
    await session();
    const other = randomUUID();
    await session(other);
    const a = await prepare();
    expect(a).toMatchObject({
      policy_version: version,
      data_class: "consented_pilot",
      measurement_window_seconds: 86400,
    });
    expect(await prepare()).toEqual(a);
    expect(await prepare(other)).toBeNull();
    await enroll(OTHER);
    await expect(prepare(SESSION, OTHER)).rejects.toMatchObject({ code: "42501" });
  });
  it("serializes concurrent first-session binding", async () => {
    await enroll();
    const a = randomUUID(),
      b = randomUUID();
    await session(a);
    await session(b);
    const results = await Promise.all([prepare(a), prepare(b)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("does not enroll old sessions or change policy pins silently", async () => {
    await session();
    await enroll();
    expect(await prepare()).toBeNull();
    const next = randomUUID();
    await session(next);
    expect(await prepare(next, OWNER, "sha256:" + "b".repeat(64))).toBeNull();
  });
  it("provides an explicitly labelled owner-QA treatment without implying randomization", async () => {
    await enroll(OWNER, { ...design, allocation: "owner_qa_treatment" });
    await session();
    expect(await prepare()).toMatchObject({ variant: "treatment", routing_mode: "live" });
  });
  it("withdrawal stops serving and does not clear frozen assignments or re-enable consent", async () => {
    await enroll();
    await session();
    const a = await prepare();
    expect(await withdraw()).toEqual({ withdrawn: true });
    expect(await prepare()).toBeNull();
    expect(
      (await f.sql`SELECT routing_assignment FROM public.sessions WHERE id=${SESSION}`)[0]
        .routing_assignment,
    ).toEqual(a);
    await expect(
      role(
        "service_role",
        (tx) =>
          tx`UPDATE public.experiment_assignments SET pilot=jsonb_set(pilot,'{withdrawn_at}','null')`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
    const snapshot = await role(
      "service_role",
      async (tx) =>
        (
          await tx`SELECT public.read_musicdna_pilot_cohort(${String(design.experiment_id)},statement_timestamp()) AS c`
        )[0].c,
    );
    expect(snapshot.participants[0]).toMatchObject({
      withdrawn: true,
      session_id: null,
      result_id: null,
      feedback: [],
    });
    expect(JSON.stringify(snapshot)).not.toContain(OWNER);
  });
  it("keeps actual human feedback local even if a synthetic export is mistakenly enrolled", async () => {
    await enroll();
    await session();
    const a = await prepare();
    const left = randomUUID(),
      right = randomUUID();
    await f.sql`INSERT INTO public.songs(id,title,artist,movement) VALUES(${left},'PRIVATE_SONG','PRIVATE_ARTIST',20),(${right},'PRIVATE_OTHER','PRIVATE_ARTIST',-20)`;
    for (let n = 0; n < 6; n++) {
      const pair = randomUUID();
      await f.sql`INSERT INTO public.pairings(id,song_a_id,song_b_id,tests,diagnostic_weight) VALUES(${pair},${left},${right},ARRAY['movement'],50)`;
      await role(
        "service_role",
        (tx) =>
          tx`INSERT INTO public.event_log(user_id,session_id,pairing_id,event_type,client,props) VALUES(${OWNER},${SESSION},${pair},'regime_recommended','server',${tx.json({ applied_routing: { schema_version: "applied-routing.v1", prior_vector: {}, answered_before: n, policy_id: "musicdna-selector", policy_version: version, strategy_version: version, routing_mode: a.routing_mode, bootstrap: false, router_knobs_used: a.routing_mode === "live" } })})`,
      );
      await role(
        "authenticated",
        (tx) =>
          tx`SELECT public.record_choice_atomic(${SESSION},${pair},${left},${right},100,${"v" + n},'{}','{"vector":{}}','{}',NULL)`,
      );
    }
    await f.sql`UPDATE public.sessions SET completed_at=now() WHERE id=${SESSION}`;
    const choices =
      await f.sql`SELECT id,pairing_id,evidence FROM public.choices WHERE session_id=${SESSION}`;
    const ledger = {
      version: "ledger-v2",
      answered: 6,
      unavailable: 0,
      entries: choices.map((c) => ({
        choice_id: c.id,
        pairing_id: c.pairing_id,
        catalog_revision: c.evidence.catalog_revision,
      })),
    };
    const r = (
      await role(
        "authenticated",
        (tx) =>
          tx`INSERT INTO public.session_results(session_id,user_id,version,source,evidence,ledger_version,policy_version,engine_version,content) VALUES(${SESSION},${OWNER},1,'pairings',${tx.json(ledger)},'ledger-v2','claims.v1','engine.v1','{}') RETURNING *`,
      )
    )[0];
    expect(r.routing_context).toMatchObject({ state: "complete", assignment_match: true });
    await f.sql`INSERT INTO public.musicdna_export_scopes(source_key,environment,approved_by,observed_from,expires_at,capture_enabled,receiver_tenant_id) VALUES('music-dna-staging','staging',${OWNER},now()-interval '1 hour',now()+interval '1 day',true,'tenant-a')`;
    await f.sql`INSERT INTO public.musicdna_learning_enrollments(result_id,session_id,owner_user_id,source_key,environment,receiver_tenant_id,subject_ref,decision_ref,result_ref,result_fingerprint,approved_by)
   SELECT id,session_id,user_id,'music-dna-staging','staging','tenant-a',${"s_" + "a".repeat(64)},${"d_" + "b".repeat(64)},${"r_" + "c".repeat(64)},musicdna_learning_private.result_fingerprint(sr),${OWNER} FROM public.session_results sr WHERE id=${r.id}`;
    await role(
      "authenticated",
      (tx) =>
        tx`SELECT public.save_result_feedback(${SESSION},${tx.json({ mutation_id: randomUUID(), result_version: 1, accuracy: "accurate" })})`,
    );
    expect(await f.sql`SELECT id FROM public.result_feedback`).toHaveLength(1);
    expect(await f.sql`SELECT observation_id FROM public.musicdna_learning_outbox`).toHaveLength(0);
    const c = await role(
      "service_role",
      async (tx) =>
        (
          await tx`SELECT public.read_musicdna_pilot_cohort(${String(design.experiment_id)},statement_timestamp()) AS c`
        )[0].c,
    );
    expect(c.participants[0]).toMatchObject({
      result_id: r.id,
      result_version: 1,
      assignment_match: true,
      feedback: [{ accuracy: "accurate", result_id: r.id }],
    });
    expect(JSON.stringify(c)).not.toContain("PRIVATE_");
    expect(JSON.stringify(c)).not.toContain(OWNER);
  });
  it("keeps enrollment and assignment changes inside rollback boundaries", async () => {
    await expect(
      role("service_role", async (tx) => {
        await tx`SELECT public.enroll_musicdna_pilot_participant(${OWNER},${tx.json(design)},${consent},${consented},${approval})`;
        throw Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await f.sql`SELECT id FROM public.experiment_assignments`).toHaveLength(0);
  });
});
