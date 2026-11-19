import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  FALLBACK_SUPABASE_URL,
  FALLBACK_SUPABASE_PUBLISHABLE_KEY,
} from "../../integrations/supabase/config";

export type Capability = "catalog_read" | "catalog_propose" | "catalog_review" | "qa_read";
export type Actor = {
  db: SupabaseClient;
  userId: string;
  capabilities: Record<Capability, boolean>;
};
export class McpError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false,
  ) {
    super(code);
  }
}
export const accessSchema = z.object({
  catalog_read: z.boolean(),
  catalog_propose: z.boolean(),
  catalog_review: z.boolean(),
  qa_read: z.boolean(),
});
export async function loadActor(ctx: ToolContext, capability: Capability): Promise<Actor> {
  if (!ctx.isAuthenticated() || !ctx.getToken() || !ctx.getUserId())
    throw new McpError("UNAUTHENTICATED");
  const db = createClient(
    process.env.SUPABASE_URL ?? FALLBACK_SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await db.auth.getUser(ctx.getToken());
  if (error || !data.user || data.user.id !== ctx.getUserId() || data.user.is_anonymous)
    throw new McpError("UNAUTHENTICATED");
  const { data: raw, error: permissionError } = await db.rpc("musicdna_mcp_access");
  if (permissionError) throw new McpError("PERMISSIONS_UNAVAILABLE", true);
  const parsed = accessSchema.safeParse(raw);
  if (!parsed.success) throw new McpError("PERMISSIONS_UNAVAILABLE", true);
  const capabilities = parsed.data;
  if (!capabilities[capability]) throw new McpError("FORBIDDEN");
  return { db, userId: data.user.id, capabilities };
}
export function assertDb(error: { message?: string; code?: string } | null) {
  if (!error) return;
  const known = [
    "FORBIDDEN",
    "NOT_FOUND",
    "INVALID_INPUT",
    "IDEMPOTENCY_CONFLICT",
    "STALE_VERSION",
    "STALE_SCORE",
    "EVIDENCE_MISMATCH",
    "EXPORT_EXPIRED",
    "EXPORT_NOT_READY",
    "REVIEW_CONTEXT_UNAVAILABLE",
    "REVIEW_RATE_LIMIT",
  ];
  const code = known.find((c) => error.message?.includes(`MCP_${c}`));
  throw new McpError(
    code ?? (error.code === "42501" ? "FORBIDDEN" : "DATA_UNAVAILABLE"),
    !code && error.code !== "42501",
  );
}
export async function rpc<T>(
  db: SupabaseClient,
  name: string,
  parameters?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db.rpc(name, parameters);
  assertDb(error);
  return data as T;
}
export function toolError(error: unknown) {
  const code =
    error instanceof McpError
      ? error.code
      : error instanceof z.ZodError
        ? "INVALID_INPUT"
        : "DATA_UNAVAILABLE";
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `MusicDNA: ${code}. No change or successful check is implied.`,
      },
    ],
    structuredContent: {
      ok: false,
      schema_version: "musicdna-admin.v1",
      error: { code, retryable: error instanceof McpError && error.retryable },
    },
  };
}
export function result(data: Record<string, unknown>) {
  if (Buffer.byteLength(JSON.stringify(data)) > 60000)
    throw new McpError("RESPONSE_TOO_LARGE_USE_SMALLER_BATCH_OR_EXPORT");
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: { ok: true, schema_version: "musicdna-admin.v1", ...data },
  };
}
