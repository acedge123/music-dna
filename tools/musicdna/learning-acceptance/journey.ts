export class AcceptanceError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
type Reply = { status: number; data: unknown };
export interface JourneyHttp {
  request(
    path: string,
    options?: { body?: unknown; bearer?: string; experience?: boolean },
  ): Promise<Reply>;
}
export type JourneyConfig = {
  approved: boolean;
  expectedSha: string;
  persona: string;
};
export type JourneyProgress = {
  phase: string;
  answered: number;
  session_id?: string;
  owner_user_id?: string;
  result_version?: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AcceptanceError("invalid_response");
  return value as Record<string, unknown>;
}
function expect(condition: unknown, code: string): asserts condition {
  if (!condition) throw new AcceptanceError(code);
}
function id(value: unknown): string {
  expect(typeof value === "string" && uuid.test(value), "invalid_identifier");
  return value;
}
async function success(reply: Promise<Reply>) {
  const response = await reply;
  expect(response.status === 200, "unexpected_http_status");
  return object(response.data);
}
/** One new, bounded synthetic journey. Never resets users, retries POSTs, shares,
 * grants export consent, or treats the harness's pairing counter as DB proof.
 * Replies/prose/tokens stay in memory; the checkpoint is a closed ID/count DTO.
 */
export async function runSyntheticJourney(
  config: JourneyConfig,
  http: JourneyHttp,
  checkpoint: (value: JourneyProgress) => void,
) {
  expect(config.approved, "approval_required");
  expect(/^[0-9a-f]{40}$/.test(config.expectedSha), "expected_sha_required");
  expect(/^ab50-[0-9a-f-]{36}$/.test(config.persona), "fresh_persona_required");
  const progress: JourneyProgress = { phase: "version", answered: 0 };
  const save = (phase: string) => checkpoint({ ...progress, phase });
  const version = await success(http.request("/api/public/version"));
  expect(version.serving_sha === config.expectedSha, "serving_sha_mismatch");
  expect(version.persistence_v2 === true, "persistence_v2_required");
  const absent = await http.request(`/api/public/test/status?persona_id=${config.persona}`);
  expect(absent.status === 404, "persona_not_fresh_or_harness_denied");
  save("opener_started");
  const opener = await success(
    http.request("/api/public/test/opener", {
      body: {
        persona_id: config.persona,
        songs: ["Black Hole Sun — Soundgarden", "Maps — Yeah Yeah Yeahs", "Idioteque — Radiohead"],
        pairing_count: 6,
        reset: false,
      },
    }),
  );
  expect(opener.ok === true, "opener_not_committed");
  progress.owner_user_id = id(opener.user_id);
  const auth = await success(
    http.request("/api/public/test/bearer", { body: { persona_id: config.persona } }),
  );
  expect(
    typeof auth.access_token === "string" &&
      auth.access_token.length > 20 &&
      auth.user_id === progress.owner_user_id,
    "bearer_unavailable",
  );
  const bearer = auth.access_token;
  save("session_started");
  const session = await success(
    http.request("/api/v1/session", { body: {}, bearer, experience: true }),
  );
  progress.session_id = id(session.session_id);
  const path = `/api/v1/session/${progress.session_id}`;
  const pairings = new Set<string>();
  for (let round = 0; round < 6; round++) {
    save("next_started");
    const next = await success(http.request(`${path}/next`, { bearer, experience: true }));
    expect(next.contract === 1 && object(next.completion).done === false, "premature_completion");
    const position = object(next.progress);
    expect(position.answered === round && position.max_answered === 6, "progress_mismatch");
    const pairing = object(next.pairing);
    const pairingId = id(pairing.id);
    expect(!pairings.has(pairingId), "duplicate_pairing");
    pairings.add(pairingId);
    const song = object(round % 2 ? pairing.song_b : pairing.song_a);
    save("choice_started");
    const choice = await success(
      http.request(`${path}/choice`, {
        bearer,
        experience: true,
        body: {
          pairing_id: pairingId,
          chosen_song_id: id(song.id),
          ms_to_decide: 4200,
          mutation_id: `${config.persona}-r${round + 1}`,
        },
      }),
    );
    expect(choice.contract === 1 && choice.replayed === false, "choice_not_committed");
    progress.answered++;
    save("choice_acknowledged");
  }
  const done = await success(http.request(`${path}/next`, { bearer, experience: true }));
  expect(
    done.contract === 1 &&
      object(done.completion).done === true &&
      done.pairing === null &&
      object(done.progress).answered === 6 &&
      object(done.progress).max_answered === 6,
    "six_answer_stop_missing",
  );
  save("reveal_started");
  const report = await success(
    http.request(`${path}/reveal`, { body: {}, bearer, experience: true }),
  );
  expect(
    report.contract === 1 && report.result_version === 1 && report.share_token === null,
    "reveal_or_publication_invalid",
  );
  for (const experience of [false, true]) {
    const snapshot = await success(http.request(path, { bearer: auth.access_token, experience }));
    expect(
      snapshot.status === "completed" && snapshot.rounds_completed === 6,
      "persisted_six_answers_missing",
    );
    expect(snapshot.is_public === false, "unexpected_publication");
    if (experience) {
      expect(
        snapshot.contract === 1 && Array.isArray(snapshot.result_versions),
        "v1_snapshot_missing",
      );
      const original = snapshot.result_versions
        .map(object)
        .find((r) => r.source === "pairings" && r.version === 1);
      expect(original, "original_result_missing");
      progress.result_version = 1;
    }
  }
  const endVersion = await success(http.request("/api/public/version"));
  expect(
    endVersion.serving_sha === config.expectedSha && endVersion.persistence_v2 === true,
    "runtime_changed_during_run",
  );
  save("journey_passed");
  return {
    phase: "journey_passed",
    answered: 6,
    result_version: 1,
    serving_sha: config.expectedSha,
  };
}
