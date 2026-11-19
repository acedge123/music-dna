import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accessSchema, assertDb, rpc, McpError } from "./access";

async function authorized(db: SupabaseClient, capability: "catalog_read" | "catalog_review") {
  const value = accessSchema.parse(await rpc(db, "musicdna_mcp_access"));
  if (!value[capability]) throw new McpError("FORBIDDEN");
}
export type Proposal = {
  id: string;
  explanation_id: string;
  base_version: string;
  base_snapshot: { audible_evidence: string; interpretation: string };
  audible_evidence: string;
  interpretation: string;
  reason: string;
  supporting_evidence: { kind: string; reference: string; note: string }[];
  version: number;
  created_at: string;
};
export const listWhyProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ after: z.string().uuid().optional() }).strict().parse(raw),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as SupabaseClient;
    await authorized(db, "catalog_review");
    let query = db
      .from("musicdna_song_why_proposals")
      .select(
        "id,explanation_id,base_version,base_snapshot,audible_evidence,interpretation,reason,supporting_evidence,version,created_at",
        { count: "exact" },
      )
      .eq("status", "pending_review")
      .order("id")
      .limit(21);
    if (data.after) query = query.gt("id", data.after);
    const { data: rows, error, count } = await query;
    assertDb(error);
    const page = (rows ?? []).slice(0, 20) as Proposal[];
    return {
      rows: page,
      remaining_count: count,
      next_after: (rows?.length ?? 0) > 20 ? page.at(-1)!.id : null,
    };
  });
export const decideWhyProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        version: z.number().int().positive(),
        decision: z.enum(["approved", "rejected"]),
        mutation_id: z.string().uuid(),
      })
      .strict()
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as SupabaseClient;
    await authorized(db, "catalog_review");
    return rpc<{ id: string; status: string; version: number; replayed: boolean }>(
      db,
      "musicdna_mcp_review_why_revision",
      {
        p_id: data.id,
        p_version: data.version,
        p_decision: data.decision,
        p_mutation: data.mutation_id,
      },
    );
  });
export type ExportSnapshot = {
  schema_version: string;
  id: string;
  format: "json" | "csv";
  generation_timestamp: string;
  expires_at: string;
  total_record_count: number;
  export_count: number;
  offset: number;
  next_offset: number | null;
  records: {
    explanation: Record<string, string | number | boolean | null>;
    version: string;
    song: Record<string, string | number | boolean | null>;
    attribute: Record<string, string | number | boolean | null>;
    availability: Record<string, string>;
  }[];
};
export const downloadWhyExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ id: z.string().uuid(), offset: z.number().int().nonnegative().default(0) })
      .strict()
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as SupabaseClient;
    await authorized(db, "catalog_read");
    // The RPC additionally requires the export owner and checks expiry on every download.
    return rpc<ExportSnapshot>(db, "musicdna_mcp_export", {
      p_action: "download_page",
      p_offset: data.offset,
      p_id: data.id,
    });
  });

/** Citation view reads the same caller-authorized canonical records as MCP, never an admin client. */
export const readCatalogSong = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).strict().parse(raw))
  .handler(async ({ data, context }) => {
    const db = context.supabase as SupabaseClient;
    await authorized(db, "catalog_read");
    const { getSong } = await import("./catalog");
    return {
      json: JSON.stringify(
        await getSong(
          {
            db,
            userId: context.userId,
            capabilities: accessSchema.parse(await rpc(db, "musicdna_mcp_access")),
          },
          data.id,
        ),
        null,
        2,
      ),
    };
  });
