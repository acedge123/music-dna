import { openSync, writeFileSync, closeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AcceptanceError,
  runSyntheticJourney,
  type JourneyHttp,
} from "./learning-acceptance/journey.ts";

const help = `AB-50 source journey (operator-only; creates one fresh synthetic persona).
MUSICDNA_LEARNING_ACCEPTANCE_APPROVED=1, MUSICDNA_ACCEPTANCE_EXPECTED_SHA and
AGENT_TEST_HARNESS_KEY are required. Set MUSICDNA_ACCEPTANCE_FIXTURE_PATH to a NEW
private file outside Git. No reset, export enrollment, dispatch, sharing or retries.
Uses https://www.musicdna.fm, max 24 requests, 30s/request, 180s overall.
Reports only bounded states/counts; private checkpoint holds IDs, never content/tokens.
This proves the source journey only, not AB-50 delivery/lifecycle acceptance.
`;
const MAX_REQUESTS = 24;
const REQUEST_TIMEOUT_MS = 30000;
const RUN_TIMEOUT_MS = 180000;
const MAX_RESPONSE_BYTES = 524288;
async function main() {
  if (process.argv.slice(2).length === 1 && process.argv[2] === "--help") {
    process.stdout.write(help);
    return;
  }
  if (process.argv.length !== 2) throw new AcceptanceError("invalid_arguments");
  if (process.env.MUSICDNA_LEARNING_ACCEPTANCE_APPROVED !== "1")
    throw new AcceptanceError("approval_required");
  const sha = process.env.MUSICDNA_ACCEPTANCE_EXPECTED_SHA ?? "";
  const key = process.env.AGENT_TEST_HARNESS_KEY;
  const path = process.env.MUSICDNA_ACCEPTANCE_FIXTURE_PATH;
  if (!key || !path || !/^[0-9a-f]{40}$/.test(sha))
    throw new AcceptanceError("configuration_required");
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const rel = relative(repoRoot, resolve(path));
  if (!isAbsolute(path) || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel)))
    throw new AcceptanceError("private_external_checkpoint_required");
  const persona = `ab50-${randomUUID()}`;
  // O_EXCL prevents accidentally rerunning/resetting an existing synthetic fixture.
  const fd = openSync(path, "wx", 0o600);
  let checkpoint: Record<string, unknown> = {
    schema: "musicdna-learning-acceptance-fixture.v1",
    created_at: new Date().toISOString(),
    persona_id: persona,
    expected_sha: sha,
    phase: "created",
    answered: 0,
  };
  const save = (values: Record<string, unknown>) => {
    checkpoint = { ...checkpoint, ...values, updated_at: new Date().toISOString() };
    writeFileSync(path, JSON.stringify(checkpoint, null, 2) + "\n", { mode: 0o600 });
  };
  closeSync(fd);
  save({});
  const deadline = AbortSignal.timeout(RUN_TIMEOUT_MS);
  let requests = 0;
  const http: JourneyHttp = {
    async request(route, options = {}) {
      if (++requests > MAX_REQUESTS || deadline.aborted)
        throw new AcceptanceError("run_budget_exhausted");
      const url = new URL(route, "https://www.musicdna.fm");
      if (url.origin !== "https://www.musicdna.fm") throw new AcceptanceError("untrusted_origin");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      };
      if (route.startsWith("/api/public/test/")) headers["x-test-harness-secret"] = key;
      if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`;
      if (options.experience) {
        headers["X-MusicDNA-Experience"] = "1";
        headers["X-MusicDNA-Acceptance-Key"] = key;
      }
      try {
        const response = await fetch(url, {
          method: options.body === undefined ? "GET" : "POST",
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          redirect: "error",
          signal: AbortSignal.any([deadline, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
        });
        const reader = response.body?.getReader();
        if (!reader) throw new AcceptanceError("invalid_response");
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new AcceptanceError("response_too_large");
          }
          chunks.push(value);
        }
        const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
        return { status: response.status, data: JSON.parse(text) };
      } catch (error) {
        if (error instanceof AcceptanceError) throw error;
        // No POST retry: a timeout may have committed. Keep the checkpoint for review.
        throw new AcceptanceError("http_unavailable_or_ambiguous");
      }
    },
  };
  try {
    const result = await runSyntheticJourney(
      { approved: true, expectedSha: sha, persona },
      http,
      (p) => save(p),
    );
    process.stdout.write(
      JSON.stringify({ ...result, requests, evidence: "hosted_source_journey_only" }) + "\n",
    );
  } catch (error) {
    save({
      state: "interrupted",
      failure: error instanceof AcceptanceError ? error.code : "unavailable",
    });
    throw error;
  }
}
try {
  await main();
} catch (error) {
  process.stderr.write(
    JSON.stringify({
      event: "ab50_source_journey",
      state: "unavailable_or_failed",
      code:
        error instanceof AcceptanceError ? error.code : "configuration_or_checkpoint_unavailable",
    }) + "\n",
  );
  process.exitCode = 1;
}
