import { createClient } from "@supabase/supabase-js";
import {
  runLearningDispatch,
  DispatchError,
  type DispatchScope,
} from "../src/musicdna/learning/dispatcher";
import { materializeLearningCapture } from "../src/musicdna/learning/outbox";
import { learningReferences } from "../src/musicdna/learning/references";
import { learningOutboxRepository } from "../src/musicdna/adapters/learning-outbox";
import { learningDispatchRepository } from "../src/musicdna/adapters/learning-dispatch-repository";
import { learningDispatchTransport } from "../src/musicdna/adapters/learning-dispatch-transport";

const help =
  "Music DNA operator worker (one run; no schedule).\nBuild: npm run build:learning-worker\nStatus: npm run learning:worker -- --source music-dna-staging --environment staging\nInspect: add --inspect <observation/deletion UUID>\nExecute: add --execute [--batch 1..10] [--maintenance]\nDefault is READ ONLY status; --execute also requires the private DB dispatch gate.\n";
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write(help);
    return;
  }
  const values: Record<string, string> = {};
  let execute = false,
    maintenance = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--execute") {
      execute = true;
      continue;
    }
    if (args[i] === "--maintenance") {
      maintenance = true;
      continue;
    }
    if (
      !["--source", "--environment", "--batch", "--inspect"].includes(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw new DispatchError("configuration");
    values[args[i]] = args[++i];
  }
  if (!(
    (values["--source"] === "music-dna-staging" && values["--environment"] === "staging") ||
    (values["--source"] === "music-dna" && values["--environment"] === "production")
  ))
    throw new DispatchError("configuration");
  if (maintenance && !execute) throw new DispatchError("configuration");
  const batch = Number(values["--batch"] ?? 5);
  if (!Number.isInteger(batch) || batch < 1 || batch > 10) throw new DispatchError("configuration");
  if (
    values["--inspect"] &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      values["--inspect"],
    )
  )
    throw new DispatchError("configuration");
  const url = process.env.SUPABASE_URL || "https://udycgnhvaanemhrchbuj.supabase.co";
  const secret =
    process.env.SB_SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new DispatchError("configuration");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const client = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const repository = learningDispatchRepository(client, controller.signal);
    // Receiver tenant is checked in SQL and captured projections, never a CLI override.
    const scope = {
      source: values["--source"],
      environment: values["--environment"],
    } as DispatchScope;
    if (values["--inspect"]) {
      if (execute) throw new DispatchError("configuration");
      const status = await repository.inspect(scope, values["--inspect"]);
      process.stdout.write(
        JSON.stringify({
          mode: "inspect",
          scope: { source: scope.source, environment: scope.environment },
          status,
        }) + "\n",
      );
      return;
    }
    if (!execute) {
      const status = await repository.status(scope);
      process.stdout.write(
        JSON.stringify({
          mode: "status",
          scope: { source: scope.source, environment: scope.environment },
          status,
        }) + "\n",
      );
      return;
    }
    const outbox = learningOutboxRepository(client, controller.signal),
      refs = learningReferences(secret);
    const transport = learningDispatchTransport({
      signal: controller.signal,
      keyForScope: async (source, environment) =>
        source === "music-dna-staging" && environment === "staging"
          ? process.env.MUSICDNA_ECHELON_STAGING_INGEST_KEY || ""
          : source === "music-dna" && environment === "production"
            ? process.env.MUSICDNA_ECHELON_PRODUCTION_INGEST_KEY || ""
            : "",
    });
    const summary = await runLearningDispatch(scope, {
      repository,
      transport,
      maxItems: batch,
      maintenance,
      materialize: (id) => materializeLearningCapture(id, { repository: outbox, references: refs }),
    });
    process.stdout.write(
      JSON.stringify({
        mode: "execute",
        scope: { source: scope.source, environment: scope.environment },
        summary,
      }) + "\n",
    );
    if (summary.attention_required) process.exitCode = 2;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
try {
  await main();
} catch (error) {
  process.stderr.write(
    JSON.stringify({
      event: "musicdna_learning_worker",
      state: "unavailable",
      code: error instanceof DispatchError ? error.code : "worker_unavailable",
    }) + "\n",
  );
  process.exitCode = 1;
}
