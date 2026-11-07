// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  createOutboxTestDatabase,
  OWNER,
  OTHER,
  SESSION,
  RESULT,
  SUBJECT,
} from "./testing/outbox-db";
import {
  canonicalLearningJson,
  mapLearningCapture,
  materializeLearningCapture,
  type CaptureRecord,
  type LearningOutboxRepository,
  type MaterializationReceipt,
} from "./outbox";
import { learningReferences } from "./references";
import { validateMusicDnaLearningEnvelopeV1 } from "../contracts/learning-observation-v1";

const refs = learningReferences("synthetic-server-secret-not-production");
const originalEvidence = {
  version: "ledger-v2",
  policy: "claims-test",
  answered: 6,
  unavailable: 0,
  entries: [
    {
      choice_id: "10000000-0000-4000-8000-000000000005",
      catalog_revision: "catalog.1",
      chosen: "PRIVATE_SONG",
      chosen_artist: "PRIVATE_ARTIST",
    },
  ],
  axes: [],
};
const payload = (id: string, version = 1) => ({
  mutation_id: id,
  result_version: version,
  accuracy: "accurate",
  rating: 1,
  comment: "PRIVATE_COMMENT",
  target: null,
  most_accurate_sentence: "PRIVATE_QUOTE",
  least_accurate_sentence: null,
});

describe.skipIf(!process.env.AB45_TEST_DATABASE_URL)(
  "native PostgreSQL atomic learning outbox",
  () => {
    let fixture: Awaited<ReturnType<typeof createOutboxTestDatabase>>;
    const txSave = async (
      tx: Pick<ReturnType<typeof postgres>, "unsafe">,
      key: string,
      user = OWNER,
      version = 1,
      changes: Record<string, unknown> = {},
    ) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx.unsafe("SELECT set_config('request.jwt.claim.sub',$1,true)", [user]);
      const rows = await tx.unsafe(
        "SELECT public.save_result_feedback($1,$2::text::jsonb) AS receipt",
        [SESSION, JSON.stringify({ ...payload(key, version), ...changes })],
      );
      return rows[0].receipt;
    };
    const save = (
      key = randomUUID(),
      user = OWNER,
      version = 1,
      changes: Record<string, unknown> = {},
    ) => fixture.sql.begin((tx) => txSave(tx, key, user, version, changes));
    const rows = () =>
      fixture.sql`SELECT * FROM public.musicdna_learning_outbox ORDER BY created_at,observation_id`;
    const captures = async () =>
      (await rows()).map(
        (r) =>
          ({
            observationId: r.observation_id,
            feedbackId: r.feedback_id,
            scope: {
              source: r.source_key,
              environment: r.environment,
              tenantId: r.receiver_tenant_id,
            },
            state: r.state,
            projection: r.projection,
          }) as CaptureRecord,
      );
    const withdraw = () =>
      fixture.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`;
        return (
          await tx`SELECT public.request_musicdna_learning_withdrawal('music-dna-staging','staging',${SUBJECT},${randomUUID()},'withdrawal') AS receipt`
        )[0].receipt;
      });
    const repo: LearningOutboxRepository = {
      async load(id) {
        return (await captures()).find((r) => r.observationId === id) ?? null;
      },
      async materialize(id, canonical) {
        return fixture.sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE service_role`;
          return (
            await tx`SELECT public.materialize_musicdna_learning_observation(${id},${canonical}) AS receipt`
          )[0].receipt as MaterializationReceipt;
        });
      },
      async exclude(id) {
        return fixture.sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE service_role`;
          return (await tx`SELECT public.exclude_musicdna_learning_capture(${id}) AS receipt`)[0]
            .receipt as MaterializationReceipt;
        });
      },
    };
    async function enroll(
      id = RESULT,
      version = 1,
      source = "pairings",
      evidence: unknown = originalEvidence,
    ) {
      if (id !== RESULT)
        await fixture.sql`INSERT INTO public.session_results(id,session_id,user_id,version,source,content,evidence,ledger_version,policy_version,engine_version)
      VALUES(${id},${SESSION},${OWNER},${version},${source},'{"synthesis":"PRIVATE_READING"}',${fixture.sql.json(evidence as never)},'ledger-v2','claims-test','engine-test')`;
      else
        await fixture.sql`UPDATE public.session_results SET evidence=${fixture.sql.json(evidence as never)} WHERE id=${id}`;
      await fixture.sql`INSERT INTO public.musicdna_learning_enrollments(result_id,session_id,owner_user_id,source_key,environment,receiver_tenant_id,subject_ref,decision_ref,result_ref,result_fingerprint,approved_by)
      SELECT r.id,r.session_id,r.user_id,'music-dna-staging','staging','tenant-a',${SUBJECT},${"d_" + "b".repeat(64)},${"r_" + (version === 1 ? "c" : "d").repeat(64)},musicdna_learning_private.result_fingerprint(r),${OWNER} FROM public.session_results r WHERE r.id=${id}`;
    }
    async function ready(id: string) {
      return materializeLearningCapture(id, { repository: repo, references: refs });
    }
    beforeAll(async () => {
      fixture = await createOutboxTestDatabase();
    }, 30000);
    beforeEach(async () => {
      await fixture.sql`TRUNCATE public.sessions,public.musicdna_export_scopes CASCADE`;
      await fixture.sql`INSERT INTO auth.users VALUES(${OWNER}) ON CONFLICT DO NOTHING`;
      await fixture.sql`INSERT INTO public.sessions(id,user_id,completed_at,vector) VALUES(${SESSION},${OWNER},now(),'{"unchanged":1}')`;
      await fixture.sql`INSERT INTO public.session_results(id,session_id,user_id,version,source,content,evidence,ledger_version,policy_version,engine_version)
      VALUES(${RESULT},${SESSION},${OWNER},1,'pairings','{"synthesis":"PRIVATE_READING"}',${fixture.sql.json(originalEvidence)},'ledger-v2','claims-test','engine-test')`;
      await fixture.sql`INSERT INTO public.musicdna_export_scopes(source_key,environment,observed_from,expires_at,approved_by,capture_enabled,receiver_tenant_id)
      VALUES('music-dna-staging','staging',now()-interval '1 day',now()+interval '1 day',${OWNER},true,'tenant-a')`;
      await enroll();
    });
    afterAll(async () => {
      await fixture?.close();
    });

    it("is default-disabled and preserves feedback shape without touching learning tables", async () => {
      await fixture.sql`DELETE FROM public.musicdna_learning_enrollments`; // withdrawal is explicit when an existing enrollment is removed
      await fixture.sql`TRUNCATE public.musicdna_export_withdrawals`;
      await fixture.sql`DELETE FROM public.musicdna_export_scopes`;
      await fixture.sql`INSERT INTO public.musicdna_export_scopes(source_key,environment,observed_from,expires_at,approved_by)
      VALUES('music-dna-staging','staging',now()-interval '1 day',now()+interval '1 day',${OWNER})`;
      await enroll();
      const saved = await save();
      expect(saved).toMatchObject({ updated: false, replayed: false, result_version: 1 });
      expect(
        (await fixture.sql`SELECT capture_enabled FROM public.musicdna_export_scopes`)[0]
          .capture_enabled,
      ).toBe(false);
      expect(await rows()).toHaveLength(0);
      expect(
        (
          await fixture.sql`SELECT public.musicdna_learning_export_allowed('music-dna-staging','staging',${SUBJECT},now()) AS allowed`
        )[0].allowed,
      ).toBe(false);
    });
    it("captures one immutable projection in the authenticated feedback transaction", async () => {
      const saved = await save();
      const entries = await rows();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        feedback_id: saved.id,
        state: "captured",
        canonical_envelope: null,
      });
      expect(entries[0].projection.decision).toMatchObject({
        result_version: 1,
        result_source: "pairings",
        answered_count: 6,
      });
      expect(entries[0].projection.versions).toEqual({
        evidence: "ledger-v2",
        catalog: "catalog.1",
      });
      const text = JSON.stringify(entries);
      for (const secret of [
        "PRIVATE_COMMENT",
        "PRIVATE_QUOTE",
        "PRIVATE_READING",
        "PRIVATE_SONG",
        "PRIVATE_ARTIST",
        OWNER,
      ])
        expect(text).not.toContain(secret);
    });
    it("survives a process crash after domain commit and recovers without a new feedback write", async () => {
      await save();
      const first = (await rows())[0];
      expect(first.state).toBe("captured");
      // A fresh use case instance simulates a restarted process discovering the DB row.
      expect(await ready(first.observation_id)).toMatchObject({
        state: "pending",
        duplicate: false,
      });
      const stored = (await rows())[0];
      expect(stored.projection).toBeNull();
      expect(stored.payload_fingerprint).toBe(
        createHash("sha256").update(stored.canonical_envelope, "utf8").digest("hex"),
      );
      expect(validateMusicDnaLearningEnvelopeV1(JSON.parse(stored.canonical_envelope)).ok).toBe(
        true,
      );
      expect(
        (await fixture.sql`SELECT count(*)::integer AS n FROM public.result_feedback`)[0].n,
      ).toBe(1);
    });
    it("replays feedback without creating a second observation and preserves original commit time", async () => {
      const id = randomUUID();
      const first = await save(id);
      const captured = (await rows())[0];
      expect(await save(id)).toMatchObject({ id: first.id, replayed: true });
      expect(await rows()).toHaveLength(1);
      await ready(captured.observation_id);
      expect((await rows())[0].observed_at).toEqual(captured.observed_at);
    });
    it("rejects conflicting retries with existing 409 semantics without changing outbox", async () => {
      const key = randomUUID();
      await save(key);
      const before = await rows();
      await expect(save(key, OWNER, 1, { comment: "changed" })).rejects.toMatchObject({
        code: "23505",
        message: "MUTATION_CONFLICT",
      });
      expect(await rows()).toEqual(before);
    });
    it("appends distinct feedback on original and revised result versions", async () => {
      const revised = randomUUID();
      await enroll(revised, 2, "chat_self_report");
      await save();
      await save(randomUUID(), OWNER, 2);
      await save();
      const captured = await rows();
      expect(captured).toHaveLength(3);
      expect(captured.map((r) => r.projection.decision.result_version).sort()).toEqual([1, 1, 2]);
      for (const row of captured) await ready(row.observation_id);
      expect(
        new Set(
          (await rows()).map(
            (r) => JSON.parse(r.canonical_envelope).metadata.observation.feedback.ref,
          ),
        ).size,
      ).toBe(3);
    });
    it("freezes source provenance instead of reading a subsequently changed result/catalog", async () => {
      await save();
      const capture = (await rows())[0];
      await fixture.sql`UPDATE public.session_results SET evidence='{"version":"ledger-new","answered":9}',ledger_version='ledger-new' WHERE id=${RESULT}`;
      await ready(capture.observation_id);
      const observation = JSON.parse((await rows())[0].canonical_envelope).metadata.observation;
      expect(observation.versions).toEqual({ evidence: "ledger-v2", catalog: "catalog.1" });
      expect(observation.decision.result_version).toBe(1);
      expect(observation.policy).toEqual({
        id: null,
        version: null,
        recommendation_event_id: null,
        experiment_id: null,
        variant: null,
      });
    });
    it("rolls back feedback and capture together when outbox storage fails", async () => {
      await fixture.sql
        .unsafe(`CREATE FUNCTION public.ab45_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic storage fault'; END $$;
      CREATE TRIGGER ab45_fault BEFORE INSERT ON public.musicdna_learning_outbox FOR EACH ROW EXECUTE FUNCTION public.ab45_fault()`);
      const id = randomUUID();
      try {
        await expect(save(id)).rejects.toMatchObject({ code: "P0001" });
        expect(
          (await fixture.sql`SELECT count(*)::integer AS n FROM public.result_feedback`)[0].n,
        ).toBe(0);
        expect(await rows()).toHaveLength(0);
      } finally {
        await fixture.sql`DROP TRIGGER ab45_fault ON public.musicdna_learning_outbox`;
        await fixture.sql`DROP FUNCTION public.ab45_fault()`;
      }
      await save(id);
      expect(await rows()).toHaveLength(1);
    });
    it("denies another user before feedback or evidence capture", async () => {
      await expect(save(randomUUID(), OTHER)).rejects.toMatchObject({ code: "42501" });
      expect(await rows()).toHaveLength(0);
    });
    it("does not infer eligibility from public sharing, account existence or client payload fields", async () => {
      await fixture.sql`DELETE FROM public.musicdna_learning_enrollments`;
      await fixture.sql`UPDATE public.sessions SET is_public=true WHERE id=${SESSION}`;
      await save(randomUUID(), OWNER, 1, {
        synthetic: true,
        consent: true,
        source: "music-dna-staging",
        learning_envelope: { private: "must-not-be-read" },
      });
      expect(await rows()).toHaveLength(0);
    });
    it("never backfills feedback saved before enrollment or after a disabled scope", async () => {
      await fixture.sql`UPDATE public.musicdna_export_scopes SET capture_enabled=false`;
      const id = randomUUID();
      await save(id);
      await fixture.sql`UPDATE public.musicdna_export_scopes SET capture_enabled=true`;
      expect(await save(id)).toMatchObject({ replayed: true });
      expect(await rows()).toHaveLength(0);
    });
    it.each([
      { evidence: {}, reason: "missing_provenance" },
      { evidence: { ...originalEvidence, answered: 5 }, reason: "invalid_provenance" },
      { evidence: { ...originalEvidence, unavailable: 1 }, reason: "invalid_provenance" },
    ])(
      "records an explicit exclusion for unavailable/invalid provenance: $reason",
      async ({ evidence, reason }) => {
        await fixture.sql`DELETE FROM public.musicdna_learning_enrollments`;
        await fixture.sql`TRUNCATE public.musicdna_export_withdrawals`;
        await enroll(RESULT, 1, "pairings", evidence);
        await save();
        expect((await rows())[0]).toMatchObject({
          state: "excluded",
          reason,
          projection: null,
          canonical_envelope: null,
        });
      },
    );
    it("excludes malformed frozen choice provenance rather than guessing six accepted answers", async () => {
      await fixture.sql`DELETE FROM public.musicdna_learning_enrollments`;
      await fixture.sql`TRUNCATE public.musicdna_export_withdrawals`;
      await enroll(RESULT, 1, "pairings", {
        ...originalEvidence,
        entries: [{ catalog_revision: "cat1" }],
      });
      await save();
      expect((await rows())[0]).toMatchObject({
        state: "excluded",
        reason: "invalid_provenance",
        projection: null,
      });
    });
    it("excludes a changed unapproved result fingerprint", async () => {
      await fixture.sql`UPDATE public.session_results SET engine_version='changed' WHERE id=${RESULT}`;
      await save();
      expect((await rows())[0]).toMatchObject({ state: "excluded", reason: "invalid_provenance" });
    });
    it("excludes comment-only feedback and leaves unknown/mixed catalog versions null", async () => {
      await save(randomUUID(), OWNER, 1, { accuracy: null, rating: null });
      expect((await rows())[0]).toMatchObject({ state: "excluded", reason: "empty_feedback" });
      await fixture.sql`DELETE FROM public.musicdna_learning_enrollments`;
      await fixture.sql`TRUNCATE public.musicdna_export_withdrawals`;
      await enroll(RESULT, 1, "pairings", {
        ...originalEvidence,
        entries: [
          { choice_id: "10000000-0000-4000-8000-000000000005", catalog_revision: "cat1" },
          { choice_id: "10000000-0000-4000-8000-000000000006", catalog_revision: "cat2" },
        ],
      });
      await save();
      expect(
        (await rows()).find((r) => r.state === "captured")?.projection.versions.catalog,
      ).toBeNull();
    });
    it("terminal withdrawal before save prevents capture; after capture purges all payloads atomically", async () => {
      await withdraw();
      await save();
      expect(await rows()).toHaveLength(0);
      await fixture.sql`TRUNCATE public.musicdna_export_withdrawals`;
      await save();
      const id = (await rows())[0].observation_id;
      await ready(id);
      await withdraw();
      expect((await rows())[0]).toMatchObject({
        state: "cancelled",
        reason: "withdrawn",
        projection: null,
        canonical_envelope: null,
        payload_fingerprint: null,
      });
      expect(await ready(id)).toMatchObject({ state: "cancelled" });
    });
    it("purges captured projections too, and rejects stale materialization after withdrawal", async () => {
      await save();
      const record = (await captures())[0];
      const body = canonicalLearningJson(await mapLearningCapture(record, refs));
      await withdraw();
      expect(await repo.materialize(record.observationId, body)).toMatchObject({
        state: "cancelled",
      });
      expect((await rows())[0].projection).toBeNull();
    });
    it("scope disable removes queued payloads and cannot cause automatic historical export on re-enable", async () => {
      await save();
      const id = (await rows())[0].observation_id;
      await ready(id);
      await fixture.sql`UPDATE public.musicdna_export_scopes SET capture_enabled=false`;
      expect((await rows())[0]).toMatchObject({ state: "cancelled", canonical_envelope: null });
      await fixture.sql`UPDATE public.musicdna_export_scopes SET capture_enabled=true`;
      expect(await ready(id)).toMatchObject({ state: "cancelled" });
    });
    it("result/session/feedback removal creates durable downstream deletion and clears local queues", async () => {
      await save();
      const id = (await rows())[0].observation_id;
      await ready(id);
      await fixture.sql`DELETE FROM public.sessions WHERE id=${SESSION}`;
      expect(await rows()).toHaveLength(0);
      expect(
        (await fixture.sql`SELECT reason,completed_at FROM public.musicdna_export_withdrawals`)[0],
      ).toEqual({ reason: "deletion", completed_at: null });
    });
    it("direct feedback deletion propagates deletion even if the reading remains", async () => {
      const saved = await save();
      await fixture.sql`DELETE FROM public.result_feedback WHERE id=${saved.id}`;
      expect(await rows()).toHaveLength(0);
      expect(
        (
          await fixture.sql`SELECT count(*)::integer AS n FROM public.musicdna_export_withdrawals`
        )[0].n,
      ).toBe(1);
    });
    it("preserves linked captured feedback against accidental legacy updates", async () => {
      const saved = await save();
      await expect(
        fixture.sql`UPDATE public.result_feedback SET comment='overwrite' WHERE id=${saved.id}`,
      ).rejects.toMatchObject({ code: "23505", message: "LEARNING_FEEDBACK_IMMUTABLE" });
      expect((await rows())[0].state).toBe("captured");
    });
    it("materialization is idempotent and rejects reused IDs with changed content", async () => {
      await save();
      const record = (await captures())[0];
      const body = canonicalLearningJson(await mapLearningCapture(record, refs));
      expect(await repo.materialize(record.observationId, body)).toMatchObject({
        duplicate: false,
      });
      expect(await repo.materialize(record.observationId, body)).toMatchObject({ duplicate: true });
      await expect(repo.materialize(record.observationId, body + " ")).rejects.toMatchObject({
        code: "23505",
      });
    });
    it("rejects every payload override compared with the exact transaction projection", async () => {
      await save();
      const record = (await captures())[0];
      const value = await mapLearningCapture(record, refs);
      if (!value) throw new Error("test mapper unavailable");
      for (const changed of [
        { ...value, tenant_id: "other" },
        { ...value, source: "music-dna" },
        {
          ...value,
          metadata: {
            ...value.metadata,
            observation: {
              ...value.metadata.observation,
              privacy: { ...value.metadata.observation.privacy, data_class: "real" },
            },
          },
        },
      ])
        await expect(
          repo.materialize(record.observationId, canonicalLearningJson(changed)),
        ).rejects.toMatchObject({ code: "22023" });
      expect((await rows())[0].state).toBe("captured");
    });
    it("retention cutoff blocks capture and physically purges a bounded outbox", async () => {
      await save();
      await save();
      await fixture.sql`UPDATE public.musicdna_export_scopes SET expires_at=now()-interval '1 second'`;
      expect(
        (await rows()).every((r) => r.canonical_envelope === null && r.projection === null),
      ).toBe(true);
      await save();
      expect(await rows()).toHaveLength(2);
      for (let i = 0; i < 2; i++)
        expect(
          (await fixture.sql`SELECT public.purge_musicdna_learning_outbox(1) AS n`)[0].n
            .purged_outbox,
        ).toBe(1);
      expect(await rows()).toHaveLength(0);
    });
    it("expiry cleanup removes derived enrollment links and records downstream deletion as pending", async () => {
      await save();
      await fixture.sql`UPDATE public.musicdna_export_scopes SET expires_at=now()-interval '1 second'`;
      const result = (
        await fixture.sql`SELECT public.purge_musicdna_learning_outbox(100) AS counts`
      )[0].counts;
      expect(result).toEqual({ purged_outbox: 1, purged_enrollments: 1 });
      expect(
        (
          await fixture.sql`SELECT count(*)::integer AS n FROM public.musicdna_learning_enrollments`
        )[0].n,
      ).toBe(0);
      expect(
        (await fixture.sql`SELECT completed_at FROM public.musicdna_export_withdrawals`)[0]
          .completed_at,
      ).toBeNull();
      expect(
        (await fixture.sql`SELECT count(*)::integer AS n FROM public.session_results`)[0].n,
      ).toBe(1);
    });
    it("does not change session activity/vector, immutable reading or create chat/jobs", async () => {
      const before = (await fixture.sql`SELECT * FROM public.sessions WHERE id=${SESSION}`)[0];
      const result = (
        await fixture.sql`SELECT * FROM public.session_results WHERE id=${RESULT}`
      )[0];
      await save();
      await ready((await rows())[0].observation_id);
      expect((await fixture.sql`SELECT * FROM public.sessions WHERE id=${SESSION}`)[0]).toEqual(
        before,
      );
      expect(
        (await fixture.sql`SELECT * FROM public.session_results WHERE id=${RESULT}`)[0],
      ).toEqual(result);
      expect(
        (await fixture.sql`SELECT count(*)::integer AS n FROM public.chat_messages`)[0].n,
      ).toBe(0);
    });
    it("keeps all controls private and trigger functions inaccessible to Data API roles", async () => {
      for (const role of ["anon", "authenticated"]) {
        for (const statement of [
          "SELECT * FROM public.musicdna_learning_enrollments",
          "SELECT * FROM public.musicdna_learning_outbox",
          "UPDATE public.musicdna_export_scopes SET capture_enabled=true",
          `SELECT public.materialize_musicdna_learning_observation('${randomUUID()}','{}')`,
          `SELECT public.exclude_musicdna_learning_capture('${randomUUID()}')`,
          "SELECT public.purge_musicdna_learning_outbox(1)",
          "SELECT musicdna_learning_private.capture_feedback()",
        ]) {
          await expect(
            fixture.sql.begin(async (tx) => {
              await tx.unsafe(`SET LOCAL ROLE ${role}`);
              await tx.unsafe(statement);
            }),
          ).rejects.toMatchObject({ code: "42501" });
        }
      }
      expect(
        (
          await fixture.sql`SELECT count(*)::integer AS n FROM pg_class WHERE oid IN ('public.musicdna_learning_enrollments'::regclass,'public.musicdna_learning_outbox'::regclass) AND relrowsecurity`
        )[0].n,
      ).toBe(2);
    });
    it("service maintenance cannot rewrite immutable observation/feedback anchors or approve enrollment", async () => {
      await save();
      const row = (await rows())[0];
      for (const statement of [
        `UPDATE public.musicdna_learning_outbox SET feedback_id='${randomUUID()}' WHERE observation_id='${row.observation_id}'`,
        `UPDATE public.musicdna_learning_outbox SET observation_id='${randomUUID()}' WHERE observation_id='${row.observation_id}'`,
        "UPDATE public.musicdna_learning_enrollments SET approved_by=NULL",
        "UPDATE public.musicdna_export_scopes SET capture_enabled=true",
      ])
        await expect(
          fixture.sql.begin(async (tx) => {
            await tx`SET LOCAL ROLE service_role`;
            await tx.unsafe(statement);
          }),
        ).rejects.toMatchObject({ code: "42501" });
    });
    it("concurrent feedback retries converge to one committed operation and one observation", async () => {
      const key = randomUUID();
      const outputs = await Promise.all(Array.from({ length: 12 }, () => save(key)));
      expect(new Set(outputs.map((r) => r.id)).size).toBe(1);
      expect(await rows()).toHaveLength(1);
    });
    it("concurrent materialization converges without changing the persisted canonical payload", async () => {
      await save();
      const record = (await captures())[0];
      const body = canonicalLearningJson(await mapLearningCapture(record, refs));
      const responses = await Promise.all(
        Array.from({ length: 12 }, () => repo.materialize(record.observationId, body)),
      );
      expect(responses.filter((r) => r.duplicate === false)).toHaveLength(1);
      expect((await rows())[0].canonical_envelope).toBe(body);
    });
    it("rolls back failed materialization and retries the same durable capture", async () => {
      await save();
      const record = (await captures())[0];
      const body = canonicalLearningJson(await mapLearningCapture(record, refs));
      await fixture.sql
        .unsafe(`CREATE FUNCTION public.ab45_materialize_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='pending' THEN RAISE EXCEPTION 'synthetic materialization fault'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER ab45_materialize_fault BEFORE UPDATE ON public.musicdna_learning_outbox FOR EACH ROW EXECUTE FUNCTION public.ab45_materialize_fault()`);
      try {
        await expect(repo.materialize(record.observationId, body)).rejects.toMatchObject({
          code: "P0001",
        });
        expect((await rows())[0]).toMatchObject({
          state: "captured",
          observation_id: record.observationId,
        });
      } finally {
        await fixture.sql`DROP TRIGGER ab45_materialize_fault ON public.musicdna_learning_outbox`;
        await fixture.sql`DROP FUNCTION public.ab45_materialize_fault()`;
      }
      expect(await repo.materialize(record.observationId, body)).toMatchObject({
        state: "pending",
        observation_id: record.observationId,
      });
    });
    it("clears pending detail immediately when enrollment approval is revoked", async () => {
      await save();
      await ready((await rows())[0].observation_id);
      await fixture.sql`UPDATE public.musicdna_learning_enrollments SET approved_by=NULL WHERE result_id=${RESULT}`;
      expect((await rows())[0]).toMatchObject({
        state: "cancelled",
        canonical_envelope: null,
        projection: null,
      });
    });
    it("enrollment revocation records pending downstream withdrawal before any remote acknowledgement", async () => {
      await save();
      await ready((await rows())[0].observation_id);
      await fixture.sql`UPDATE public.musicdna_learning_enrollments SET approved_by=NULL WHERE result_id=${RESULT}`;
      expect(
        (await fixture.sql`SELECT reason,completed_at FROM public.musicdna_export_withdrawals`)[0],
      ).toEqual({ reason: "withdrawal", completed_at: null });
      expect((await rows())[0]).toMatchObject({
        state: "cancelled",
        reason: "withdrawn",
        canonical_envelope: null,
      });
    });
    it("auth-admin account deletion propagates withdrawal without private-table privileges", async () => {
      await save();
      await ready((await rows())[0].observation_id);
      await fixture.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE ab45_auth_admin`;
        await tx`DELETE FROM auth.users WHERE id=${OWNER}`;
      });
      expect(await rows()).toHaveLength(0);
      expect(
        (await fixture.sql`SELECT reason,completed_at FROM public.musicdna_export_withdrawals`)[0],
      ).toEqual({ reason: "deletion", completed_at: null });
    });
    async function materializationOverlap(materializeFirst: boolean) {
      await save();
      const record = (await captures())[0];
      const body = canonicalLearningJson(await mapLearningCapture(record, refs));
      let release!: () => void;
      const hold = new Promise<void>((r) => (release = r));
      let entered!: () => void;
      const started = new Promise<void>((r) => (entered = r));
      const first = fixture.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`;
        if (materializeFirst)
          await tx`SELECT public.materialize_musicdna_learning_observation(${record.observationId},${body})`;
        else
          await tx`SELECT public.request_musicdna_learning_withdrawal('music-dna-staging','staging',${SUBJECT},${randomUUID()},'withdrawal')`;
        entered();
        await hold;
      });
      await started;
      const second = (
        materializeFirst ? withdraw() : repo.materialize(record.observationId, body)
      ).then(
        (value) => ({ ok: true as const, value }),
        (error) => ({ ok: false as const, error }),
      );
      try {
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const n = (
            await fixture.sql`SELECT count(*)::integer AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`
          )[0].n;
          if (n > 0) {
            waiting = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        expect(waiting).toBe(true);
      } finally {
        release();
      }
      await first;
      const result = await second;
      if (!result.ok) throw result.error;
      expect((await rows())[0]).toMatchObject({
        state: "cancelled",
        canonical_envelope: null,
        projection: null,
        payload_fingerprint: null,
      });
    }
    it("withdrawal waits for in-flight materialization then purges it before acknowledgement", () =>
      materializationOverlap(true));
    it("in-flight withdrawal prevents stale materialization from restoring a payload", () =>
      materializationOverlap(false));

    it("enrollment deletion cannot deadlock an in-flight capture on its foreign key", async () => {
      let release!: () => void;
      const hold = new Promise<void>((r) => (release = r));
      let entered!: () => void;
      const started = new Promise<void>((r) => (entered = r));
      const deletion = fixture.sql.begin(async (tx) => {
        await tx`SELECT result_id FROM public.musicdna_learning_enrollments WHERE result_id=${RESULT} FOR UPDATE`;
        entered();
        await hold;
        await tx`DELETE FROM public.session_results WHERE id=${RESULT}`;
      });
      await started;
      const capture = save().then(
        (value) => ({ ok: true as const, value }),
        (error) => ({ ok: false as const, error }),
      );
      try {
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const n = (
            await fixture.sql`SELECT count(*)::integer AS n FROM pg_locks WHERE NOT granted AND database IS NULL AND locktype='transactionid'`
          )[0].n;
          if (n > 0) {
            waiting = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        expect(waiting).toBe(true);
      } finally {
        release();
      }
      await deletion;
      const result = await capture;
      if (!result.ok) throw result.error;
      expect(await rows()).toHaveLength(0);
      expect(
        (
          await fixture.sql`SELECT count(*)::integer AS n FROM public.musicdna_export_withdrawals`
        )[0].n,
      ).toBe(1);
    });

    async function overlap(writeFirst: boolean) {
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      let entered!: () => void;
      const started = new Promise<void>((r) => (entered = r));
      const first = fixture.sql.begin(async (tx) => {
        if (writeFirst) await txSave(tx, randomUUID());
        else {
          await tx`SET LOCAL ROLE service_role`;
          await tx`SELECT public.request_musicdna_learning_withdrawal('music-dna-staging','staging',${SUBJECT},${randomUUID()},'withdrawal')`;
        }
        entered();
        await held;
      });
      await started;
      const second = (writeFirst ? withdraw() : save()).then(
        (value) => ({ ok: true as const, value }),
        (error) => ({ ok: false as const, error }),
      );
      try {
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const n = (
            await fixture.sql`SELECT count(*)::integer AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`
          )[0].n;
          if (n > 0) {
            waiting = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        expect(waiting).toBe(true);
      } finally {
        release();
      }
      await first;
      const other = await second;
      if (!other.ok) throw other.error;
    }
    it("withdrawal waits for in-flight feedback capture then removes its projection before commit", async () => {
      await overlap(true);
      expect((await rows())[0]).toMatchObject({
        state: "cancelled",
        projection: null,
        canonical_envelope: null,
      });
    });
    it("in-flight withdrawal blocks a concurrent feedback capture from enqueueing", async () => {
      await overlap(false);
      expect(await rows()).toHaveLength(0);
      expect(
        (await fixture.sql`SELECT count(*)::integer AS n FROM public.result_feedback`)[0].n,
      ).toBe(1);
    });
  },
);
