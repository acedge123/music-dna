// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import {
  createOutboxTestDatabase,
  readSourceFile,
  OWNER,
  OTHER,
  SESSION,
  RESULT,
  SUBJECT,
} from "./testing/outbox-db";
import { createRoutingTestDatabase } from "./testing/routing-db";
import { appliedRoutingContext } from "./applied-routing";
import artifact from "./routing-artifact.json";
import { mapLearningCapture, canonicalLearningJson } from "./outbox";
import { learningReferences } from "./references";

const A = "20000000-0000-4000-8000-000000000001";
const B = "20000000-0000-4000-8000-000000000002";
const PAIRS = Array.from({ length: 6 }, (_, i) => `30000000-0000-4000-8000-00000000000${i + 1}`);
const design = {
  experiment_id: "ab52.synthetic.v1",
  variant: "control",
  policy_id: artifact.policy_id,
  policy_version: artifact.version,
  strategy_version: artifact.version,
  routing_mode: "shadow",
  eligibility_version: "authorized-synthetic.v1",
  measurement_window_seconds: 3600,
  data_class: "synthetic",
};

describe.skipIf(!process.env.AB45_TEST_DATABASE_URL)(
  "native applied decision/outcome joins",
  () => {
    let f: Awaited<ReturnType<typeof createOutboxTestDatabase>>;
    const asRole = <T>(
      role: "authenticated" | "service_role" | "anon",
      fn: (tx: TransactionSql) => Promise<T>,
      user = OWNER,
    ) =>
      f.sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE ${role}`);
        await tx`SELECT set_config('request.jwt.claim.sub',${role === "authenticated" ? user : ""},true)`;
        return fn(tx);
      });
    const assign = (d = design, owner = OWNER) =>
      asRole(
        "service_role",
        async (tx) =>
          (
            await tx`SELECT public.assign_musicdna_routing_experiment(${SESSION},${owner},${tx.json(d)}) AS a`
          )[0].a,
      );
    const emit = async (n = 0, changes: Record<string, unknown> = {}) => {
      const props = appliedRoutingContext({
        enabled: "1",
        vector: { n },
        answered: n,
        routingMode: "shadow",
        mode: "diagnostic_first",
        knobs: null,
        bootstrap: false,
        fallback: false,
        steer: null,
        recommendation: { regime: "explore", pairing_knobs: {} },
      });
      return asRole(
        "service_role",
        async (tx) =>
          (
            await tx`INSERT INTO public.event_log(user_id,session_id,pairing_id,event_type,client,props)
      VALUES(${OWNER},${SESSION},${PAIRS[n]},'regime_recommended','server',${tx.json({ ...props, applied_routing: { ...props.applied_routing, ...changes } })}) RETURNING *`
          )[0],
      );
    };
    const vote = (n = 0, prior = n, user = OWNER) =>
      asRole(
        "authenticated",
        async (tx) =>
          tx`SELECT public.record_choice_atomic(${SESSION},${PAIRS[n]},${A},${B},123,${"pick." + n},${tx.json({ n: prior })},${tx.json({ vector: { n: n + 1 } })},'{"verdict":"saved"}',NULL)`,
        user,
      );
    const result = async (
      version = 1,
      source = "pairings",
      hoursAgo = 0,
      duplicateAxes = false,
    ) => {
      const choices =
        await f.sql`SELECT id,pairing_id FROM public.choices WHERE session_id=${SESSION} ORDER BY created_at,id`;
      const entries = choices.flatMap((c) =>
        Array.from({ length: duplicateAxes ? 2 : 1 }, () => ({
          choice_id: c.id,
          pairing_id: c.pairing_id,
          catalog_revision: "catalog.1",
        })),
      );
      return asRole(
        "authenticated",
        async (tx) =>
          (
            await tx`INSERT INTO public.session_results(session_id,user_id,version,source,content,evidence,ledger_version,policy_version,engine_version,created_at)
      VALUES(${SESSION},${OWNER},${version},${source},'{"text":"PRIVATE_READING"}',${tx.json({ version: "ledger-v2", answered: 6, unavailable: 0, entries })},'ledger-v2','CLAIM_POLICY_NOT_ROUTING','engine.v1',clock_timestamp()-make_interval(hours=>${hoursAgo})) RETURNING *`
          )[0],
      );
    };
    const journey = async (
      opts: { assign?: boolean; mode?: string; hoursAgo?: number; duplicateAxes?: boolean } = {},
    ) => {
      if (opts.assign !== false) await assign();
      for (let n = 0; n < 6; n++) {
        await emit(n, opts.mode ? { routing_mode: opts.mode } : {});
        await vote(n);
      }
      await f.sql`UPDATE public.sessions SET completed_at=now() WHERE id=${SESSION}`;
      return result(1, "pairings", opts.hoursAgo ?? 0, opts.duplicateAxes ?? false);
    };
    const read = (id: string) =>
      asRole(
        "service_role",
        async (tx) => (await tx`SELECT public.read_musicdna_routing_outcome(${id}) AS o`)[0].o,
      );
    const feedback = (version = 1, commentOnly = false) =>
      asRole(
        "authenticated",
        async (tx) =>
          (
            await tx`SELECT public.save_result_feedback(${SESSION},${tx.json({ mutation_id: randomUUID(), result_version: version, accuracy: commentOnly ? null : "accurate", rating: commentOnly ? null : 1, comment: "PRIVATE_COMMENT" })}) AS receipt`
          )[0].receipt,
      );
    beforeAll(async () => {
      f = await createRoutingTestDatabase();
      await f.sql`INSERT INTO public.songs(id,title,artist,movement) VALUES(${A},'PRIVATE_SONG','PRIVATE_ARTIST',20),(${B},'PRIVATE_OTHER','PRIVATE_ARTIST',-20)`;
      for (const id of PAIRS)
        await f.sql`INSERT INTO public.pairings(id,song_a_id,song_b_id,tests,diagnostic_weight) VALUES(${id},${A},${B},ARRAY['movement'],50)`;
    }, 30000);
    afterAll(async () => {
      await f?.close();
    });
    beforeEach(async () => {
      await f.sql`TRUNCATE public.sessions,public.event_log,public.musicdna_export_scopes CASCADE`;
      await f.sql`INSERT INTO public.sessions(id,user_id,vector) VALUES(${SESSION},${OWNER},'{"n":0}')`;
    });
    it("pins one assignment and replays it, rejects conflicting and cross-owner requests", async () => {
      const a = await assign();
      expect(await assign()).toEqual(a);
      await expect(assign({ ...design, variant: "treatment" })).rejects.toMatchObject({
        code: "23505",
      });
      await expect(assign(design, OTHER)).rejects.toMatchObject({ code: "42501" });
      await expect(assign({ ...design, measurement_window_seconds: 0 })).rejects.toMatchObject({
        code: "22023",
      });
      await expect(assign({ ...design, data_class: "real_user" })).rejects.toMatchObject({
        code: "22023",
      });
    });
    it("denies listener assignment/reader RPCs and direct provenance forgery", async () => {
      await expect(
        asRole(
          "authenticated",
          (tx) =>
            tx`SELECT public.assign_musicdna_routing_experiment(${SESSION},${OWNER},${tx.json(design)})`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asRole(
          "authenticated",
          (tx) => tx`UPDATE public.sessions SET routing_assignment='{}' WHERE id=${SESSION}`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asRole("authenticated", (tx) => tx`SELECT public.read_musicdna_routing_outcome(${RESULT})`),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asRole("anon", (tx) => tx`SELECT public.read_musicdna_routing_outcome(${RESULT})`),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asRole(
          "authenticated",
          (tx) =>
            tx`INSERT INTO public.event_log(user_id,session_id,event_type,client,props) VALUES(${OWNER},${SESSION},'regime_recommended','server','{"applied_routing":{}}')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await asRole(
        "authenticated",
        (tx) =>
          tx`INSERT INTO public.choices(session_id,pairing_id,chosen_song_id,rejected_song_id,response,routing_context) VALUES(${SESSION},${PAIRS[0]},${A},${B},'{}','{"state":"recorded"}')`,
      );
      expect((await f.sql`SELECT routing_context FROM public.choices`)[0].routing_context).toEqual({
        state: "missing",
      });
    });
    it("serializes assignment with serving, freezes identity and rejects late assignment", async () => {
      const a = await assign();
      await emit();
      await expect(
        asRole(
          "service_role",
          (tx) => tx`UPDATE public.sessions SET routing_assignment=NULL WHERE id=${SESSION}`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
      await expect(
        asRole(
          "service_role",
          (tx) => tx`UPDATE public.sessions SET user_id=${OTHER} WHERE id=${SESSION}`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
      expect(a.assignment_id).toBeTruthy();
      await f.sql`TRUNCATE public.sessions,public.event_log CASCADE`;
      await f.sql`INSERT INTO public.sessions(id,user_id,vector) VALUES(${SESSION},${OWNER},'{"n":0}')`;
      await emit();
      await expect(assign()).rejects.toMatchObject({ code: "23505" });
    });
    it("serializes concurrent first assignments without rebucketing", async () => {
      const outcomes = await Promise.allSettled([
        assign(),
        assign({ ...design, variant: "treatment" }),
      ]);
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((o) => o.status === "rejected")).toHaveLength(1);
      const stored = (
        await f.sql`SELECT routing_assignment FROM public.sessions WHERE id=${SESSION}`
      )[0].routing_assignment;
      expect(["control", "treatment"]).toContain(stored.variant);
      expect(await assign({ ...design, variant: stored.variant })).toEqual(stored);
    });
    it("binds exact served context inside the real atomic vote; stale writes roll back", async () => {
      await assign();
      const event = await emit();
      await emit();
      await expect(vote(0, 9)).rejects.toMatchObject({ code: "40001" });
      expect(await f.sql`SELECT id FROM public.choices`).toHaveLength(0);
      await vote();
      const c = (await f.sql`SELECT * FROM public.choices`)[0];
      expect(c.routing_context).toMatchObject({
        state: "recorded",
        event_id: event.id,
        decision: { recommendation_applied: false, proposed: { regime: "explore" } },
      });
      expect(c.evidence.choice_id).toBe(c.id);
      expect(c.response).toEqual({ verdict: "saved" });
      await expect(vote()).rejects.toMatchObject({ code: "23505" });
      await expect(
        asRole(
          "authenticated",
          (tx) => tx`UPDATE public.choices SET routing_context='{}' WHERE id=${c.id}`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
    });
    it("keeps conflicting served contexts ambiguous and ignores stale serving", async () => {
      await assign();
      await emit();
      await emit(0, { steer: "harder" });
      await vote();
      expect((await f.sql`SELECT routing_context FROM public.choices`)[0].routing_context).toEqual({
        state: "ambiguous",
      });
      const stale = await emit(1, { prior_vector: { n: 0 } });
      expect(stale.props).not.toHaveProperty("applied_routing");
      await vote(1);
      expect(
        (await f.sql`SELECT routing_context FROM public.choices WHERE pairing_id=${PAIRS[1]}`)[0]
          .routing_context,
      ).toEqual({ state: "missing" });
    });
    it("freezes six exact choices with multiple axes and an open missing-feedback window", async () => {
      const r = await journey({ duplicateAxes: true });
      expect(r.routing_context).toMatchObject({
        state: "complete",
        assignment_match: true,
        policy: { id: artifact.policy_id, version: artifact.version, variant: "control" },
      });
      expect(r.routing_context.choices).toHaveLength(6);
      const o = await read(r.id);
      expect(o).toMatchObject({
        outcome_state: "awaiting_feedback",
        window_state: "open",
        feedback: [],
      });
      await feedback(1, true);
      expect(await read(r.id)).toMatchObject({ outcome_state: "awaiting_feedback", feedback: [] });
      await expect(
        asRole(
          "service_role",
          (tx) => tx`UPDATE public.session_results SET evidence='{}' WHERE id=${r.id}`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
    });
    it("does not label a mismatched treatment as an applied experiment", async () => {
      await assign({ ...design, variant: "treatment", routing_mode: "live" });
      const r = await journey({ assign: false });
      expect(r.routing_context).toMatchObject({
        state: "complete",
        assignment_match: false,
        policy: { experiment_id: null, variant: null },
      });
    });
    it("does not treat requested live routing as applied when recommendation is unavailable", async () => {
      await assign({ ...design, variant: "treatment", routing_mode: "live" });
      for (let n = 0; n < 6; n++) {
        await emit(n, {
          routing_mode: "live",
          applied_routing_mode: "legacy",
          router_knobs_used: false,
          proposed: null,
        });
        await vote(n);
      }
      const r = await result();
      expect(r.routing_context).toMatchObject({
        state: "complete",
        assignment_match: false,
        policy: { experiment_id: null, variant: null },
      });
    });
    it("records a matching treatment only when live knobs were actually used", async () => {
      await assign({ ...design, variant: "treatment", routing_mode: "live" });
      for (let n = 0; n < 6; n++) {
        await emit(n, {
          routing_mode: "live",
          applied_routing_mode: "live",
          router_knobs_used: true,
          recommendation_applied: true,
        });
        await vote(n);
      }
      const r = await result();
      expect(r.routing_context).toMatchObject({
        assignment_match: true,
        policy: { experiment_id: design.experiment_id, variant: "treatment" },
      });
    });
    it("keeps an incomplete choice join, changed artifact and chat revision unknown", async () => {
      await assign();
      for (let n = 0; n < 6; n++) {
        await emit(n, n === 5 ? { policy_version: "other.v1" } : {});
        await vote(n);
      }
      const mixed = await result();
      expect(mixed.routing_context.state).toBe("unknown");
      expect(await read(mixed.id)).toMatchObject({
        window_state: "open",
        outcome_state: "awaiting_feedback",
      });
      const chat = await result(2, "chat_self_report");
      expect(chat.routing_context).toMatchObject({
        state: "unknown",
        reason: "non_pairing_revision",
      });
    });
    it("reports no assignment as unknown measurement, not zero or failure", async () => {
      const r = await journey({ assign: false });
      expect(await read(r.id)).toMatchObject({ window_state: "unknown", outcome_state: "unknown" });
      expect(r.routing_context.state).toBe("unknown");
    });
    it("keeps result versions separate and distinguishes late feedback from missing", async () => {
      const r = await journey({ hoursAgo: 2 });
      expect(await read(r.id)).toMatchObject({ outcome_state: "missing", window_state: "closed" });
      await result(2, "chat_self_report");
      await feedback(2);
      expect((await read(r.id)).feedback).toEqual([]);
      await feedback();
      const o = await read(r.id);
      expect(o.outcome_state).toBe("observed");
      expect(o.feedback).toHaveLength(1);
      expect(o.feedback[0]).toMatchObject({ timing: "late", observation_id: null });
      expect(JSON.stringify(o)).not.toContain("PRIVATE_");
    });
    it("exports pinned applied attribution through the existing feedback outbox and purges on withdrawal", async () => {
      const r = await journey();
      await f.sql`INSERT INTO public.musicdna_export_scopes(source_key,environment,approved_by,observed_from,expires_at,capture_enabled,receiver_tenant_id) VALUES('music-dna-staging','staging',${OWNER},now()-interval '1 hour',now()+interval '1 day',true,'tenant-a')`;
      await f.sql`INSERT INTO public.musicdna_learning_enrollments(result_id,session_id,owner_user_id,source_key,environment,receiver_tenant_id,subject_ref,decision_ref,result_ref,result_fingerprint,approved_by)
      SELECT id,session_id,user_id,'music-dna-staging','staging','tenant-a',${SUBJECT},${"d_" + "b".repeat(64)},${"r_" + "c".repeat(64)},musicdna_learning_private.result_fingerprint(r),${OWNER} FROM public.session_results r WHERE id=${r.id}`;
      await feedback();
      const o = (await f.sql`SELECT * FROM public.musicdna_learning_outbox`)[0];
      expect(o.state).toBe("captured");
      expect(o.projection.policy).toEqual(r.routing_context.policy);
      const mapped = await mapLearningCapture(
        {
          observationId: o.observation_id,
          feedbackId: o.feedback_id,
          scope: {
            source: o.source_key,
            environment: o.environment,
            tenantId: o.receiver_tenant_id,
          },
          state: o.state,
          projection: o.projection,
        },
        learningReferences("synthetic-not-production"),
      );
      expect(mapped?.metadata.observation.policy).toEqual(r.routing_context.policy);
      await asRole(
        "service_role",
        (tx) =>
          tx`SELECT public.materialize_musicdna_learning_observation(${o.observation_id},${canonicalLearningJson(mapped)})`,
      );
      expect((await read(r.id)).feedback[0]).toMatchObject({
        observation_id: o.observation_id,
        capture_state: "pending",
        dispatch_state: null,
        receiver_receipt_id: null,
        timing: "on_time",
      });
      expect(JSON.stringify(mapped)).not.toContain("PRIVATE_");
      await asRole(
        "service_role",
        (tx) =>
          tx`SELECT public.request_musicdna_learning_withdrawal('music-dna-staging','staging',${SUBJECT},${randomUUID()},'withdrawal')`,
      );
      const withdrawn = (await f.sql`SELECT * FROM public.musicdna_learning_outbox`)[0];
      expect(withdrawn.state).toBe("cancelled");
      expect(withdrawn.projection).toBeNull();
    });
    it("retains all-null attribution for an unknown history and leaves capture off by default", async () => {
      // Actual choices with no served provenance cannot acquire policy attribution later.
      for (let n = 0; n < 6; n++) await vote(n);
      const r = await result();
      await f.sql`UPDATE public.sessions SET completed_at=now() WHERE id=${SESSION}`;
      await f.sql`INSERT INTO public.musicdna_export_scopes(source_key,environment,approved_by,observed_from,expires_at,receiver_tenant_id)
        VALUES('music-dna-staging','staging',${OWNER},now()-interval '1 hour',now()+interval '1 day','tenant-a')`;
      await f.sql`INSERT INTO public.musicdna_learning_enrollments(result_id,session_id,owner_user_id,source_key,environment,receiver_tenant_id,subject_ref,decision_ref,result_ref,result_fingerprint,approved_by)
        SELECT id,session_id,user_id,'music-dna-staging','staging','tenant-a',${SUBJECT},${"d_" + "b".repeat(64)},${"r_" + "c".repeat(64)},musicdna_learning_private.result_fingerprint(r),${OWNER} FROM public.session_results r WHERE id=${r.id}`;
      await feedback();
      expect(await f.sql`SELECT * FROM public.musicdna_learning_outbox`).toHaveLength(0);
      await f.sql`UPDATE public.musicdna_export_scopes SET capture_enabled=true`;
      await feedback();
      const o = (await f.sql`SELECT * FROM public.musicdna_learning_outbox`)[0];
      expect(o.state).toBe("captured");
      expect(o.projection.policy).toEqual({
        id: null,
        version: null,
        recommendation_event_id: null,
        experiment_id: null,
        variant: null,
      });
    });
    it("preserves pre-migration result fingerprints", async () => {
      const legacy = (
        await f.sql`INSERT INTO public.session_results(session_id,user_id,version,source,content,evidence,ledger_version,policy_version,engine_version) VALUES(${SESSION},${OWNER},1,'pairings','{}','{}','ledger-v2','claims.v1','engine.v1') RETURNING *`
      )[0];
      // Emulate an existing row that predates the migration, without rewriting a frozen row.
      await f.sql`ALTER TABLE public.session_results DISABLE TRIGGER session_results_routing_context`;
      await f.sql`UPDATE public.session_results SET routing_context=NULL WHERE id=${legacy.id}`;
      await f.sql`ALTER TABLE public.session_results ENABLE TRIGGER session_results_routing_context`;
      const rows = await f.sql`SELECT musicdna_learning_private.result_fingerprint(r) AS actual,
      encode(sha256(convert_to(jsonb_build_object('id',r.id,'session_id',r.session_id,'owner',r.user_id,'version',r.version,'source',r.source,'evidence',r.evidence,'ledger_version',r.ledger_version,'policy_version',r.policy_version,'engine_version',r.engine_version)::text,'UTF8')),'hex') AS expected FROM public.session_results r WHERE id=${legacy.id}`;
      expect(rows[0].actual).toBe(rows[0].expected);
    });
  },
);
