// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRoutingTestDatabase } from "./testing/routing-db";
import { OWNER, OTHER, readSourceFile } from "./testing/outbox-db";
import { mapLearningCapture, canonicalLearningJson } from "./outbox";
import { learningReferences } from "./references";
import { validateMusicDnaLearningEnvelopeV2 } from "../contracts/learning-observation-v2";
const subject = "s_" + "c".repeat(64);
const evidence = {
  version: "ledger-v2",
  answered: 6,
  unavailable: 0,
  entries: [{ choice_id: randomUUID(), catalog_revision: "catalog.1", chosen: "PRIVATE_SONG" }],
  axes: [],
};
describe.skipIf(!process.env.AB45_TEST_DATABASE_URL)("native consented real QA", () => {
  let f: Awaited<ReturnType<typeof createRoutingTestDatabase>>;
  beforeAll(async () => {
    f = await createRoutingTestDatabase();
    await f.sql.unsafe(
      "ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz DEFAULT now(),ADD COLUMN is_anonymous boolean DEFAULT false",
    );
    await f.sql.unsafe(
      readSourceFile("supabase/migrations/20261110053326_musicdna_real_qa_learning.sql"),
    );
    await f.sql.unsafe(
      readSourceFile("supabase/migrations/20261110053647_musicdna_real_qa_approver_cleanup.sql"),
    );
  }, 30000);
  afterAll(async () => {
    await f?.close();
  });
  beforeEach(async () => {
    await f.sql`TRUNCATE public.musicdna_export_scopes,public.sessions CASCADE`;
    await f.sql`INSERT INTO public.musicdna_export_scopes(source_key,environment,observed_from,expires_at,policy_version,approved_by,capture_enabled,dispatch_enabled,receiver_tenant_id)
   VALUES('music-dna','production',now()-interval '1 minute',now()+interval '1 day','real-qa-lifecycle.v1',${OWNER},true,false,'tenant-a')`;
  });
  const enroll = () =>
    f.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE service_role`;
      await tx`SELECT public.enroll_musicdna_real_qa(${OWNER},${randomUUID()},${OWNER},${subject},now()-interval '1 second',now()+interval '12 hours')`;
    });
  async function result(user = OWNER, createdAt = new Date().toISOString()) {
    const session = randomUUID();
    await f.sql`INSERT INTO public.sessions(id,user_id,created_at,completed_at) VALUES(${session},${user},${createdAt},now())`;
    const [r] =
      await f.sql`INSERT INTO public.session_results(session_id,user_id,version,source,content,evidence,ledger_version,policy_version,engine_version)
   VALUES(${session},${user},1,'pairings','{"text":"PRIVATE_READING"}',${f.sql.json(evidence)},'ledger-v2','claims.v1','engine.v1') RETURNING id`;
    await f.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claim.sub',${user},true)`;
      await tx`SELECT public.save_result_feedback(${session},${tx.json({ mutation_id: randomUUID(), result_version: 1, accuracy: "mixed", rating: null, comment: "PRIVATE_COMMENT", target: null, most_accurate_sentence: null, least_accurate_sentence: null })})`;
    });
    return r.id as string;
  }
  it("captures every new consenting reading as V2 without exporting private content", async () => {
    await enroll();
    await result();
    await result();
    const rows = await f.sql`SELECT * FROM public.musicdna_learning_outbox ORDER BY created_at`;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.projection.privacy.data_class).toBe("consented_qa");
      expect(JSON.stringify(row.projection)).not.toMatch(/PRIVATE_|@/);
      const envelope = await mapLearningCapture(
        {
          observationId: row.observation_id,
          feedbackId: row.feedback_id,
          scope: { source: "music-dna", environment: "production", tenantId: "tenant-a" },
          state: "captured",
          projection: row.projection,
        },
        learningReferences("local-only-test-reference-secret"),
      );
      expect(validateMusicDnaLearningEnvelopeV2(envelope).ok).toBe(true);
      await f.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`;
        await tx`SELECT public.materialize_musicdna_learning_observation(${row.observation_id},${canonicalLearningJson(envelope)})`;
      });
    }
    expect(
      (
        await f.sql`SELECT count(*)::int n FROM public.musicdna_learning_outbox WHERE state='pending'`
      )[0].n,
    ).toBe(2);
  });
  it("keeps feedback corrections as separate immutable events", async () => {
    await enroll();
    await result();
    const [feedback] = await f.sql`SELECT session_id FROM public.result_feedback`;
    await f.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claim.sub',${OWNER},true)`;
      await tx`SELECT public.save_result_feedback(${feedback.session_id},${tx.json({ mutation_id: randomUUID(), result_version: 1, accuracy: "accurate", rating: 1, comment: null, target: null, most_accurate_sentence: null, least_accurate_sentence: null })})`;
    });
    expect(
      (await f.sql`SELECT accuracy FROM public.result_feedback ORDER BY created_at DESC LIMIT 1`)[0]
        .accuracy,
    ).toBe("accurate");
    expect(
      (await f.sql`SELECT projection FROM public.musicdna_learning_outbox ORDER BY created_at`).map(
        (x) => x.projection.feedback.accuracy,
      ),
    ).toEqual(["mixed", "accurate"]);
  });
  it("does not enroll another account or backfill a pre-consent session", async () => {
    await enroll();
    await result(OTHER);
    await result(OWNER, new Date(Date.now() - 3600000).toISOString());
    expect(await f.sql`SELECT observation_id FROM public.musicdna_learning_outbox`).toHaveLength(0);
  });
  it("denies browser configuration and unverified account consent", async () => {
    await expect(
      f.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`;
        await tx`SELECT * FROM public.musicdna_real_qa_consents`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
    await f.sql`UPDATE auth.users SET is_anonymous=true WHERE id=${OWNER}`;
    await expect(enroll()).rejects.toMatchObject({ code: "42501" });
    await f.sql`UPDATE auth.users SET is_anonymous=false WHERE id=${OWNER}`;
  });
  it("deleting an approver withdraws other tester consents instead of blocking account deletion", async () => {
    await f.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE service_role`;
      await tx`SELECT public.enroll_musicdna_real_qa(${OTHER},${randomUUID()},${OWNER},${"s_" + "e".repeat(64)},now()-interval '1 second',now()+interval '12 hours')`;
    });
    await result(OTHER);
    await f.sql`DELETE FROM auth.users WHERE id=${OWNER}`;
    expect(await f.sql`SELECT user_id FROM public.musicdna_real_qa_consents`).toHaveLength(0);
    expect(
      await f.sql`SELECT observation_id FROM public.musicdna_learning_outbox WHERE projection IS NOT NULL OR canonical_envelope IS NOT NULL`,
    ).toHaveLength(0);
    await f.sql`INSERT INTO auth.users(id) VALUES(${OWNER})`;
  });
  it("withdrawal clears pending detail and prevents further capture", async () => {
    await enroll();
    await result();
    await f.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE service_role`;
      await tx`DELETE FROM public.musicdna_real_qa_consents WHERE user_id=${OWNER}`;
    });
    await result();
    expect(
      await f.sql`SELECT observation_id FROM public.musicdna_learning_outbox WHERE projection IS NOT NULL OR canonical_envelope IS NOT NULL`,
    ).toHaveLength(0);
    expect(
      (
        await f.sql`SELECT count(*)::int n FROM public.musicdna_export_withdrawals WHERE completed_at IS NULL`
      )[0].n,
    ).toBe(1);
    await expect(enroll()).rejects.toMatchObject({ code: "42501" });
  });
});
