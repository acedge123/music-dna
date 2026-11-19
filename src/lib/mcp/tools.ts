import { defineTool, type ToolContext, type ToolDefinition } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { DIMS } from "../../musicdna/engine/axes";
import {
  type Actor,
  type Capability,
  loadActor,
  result,
  toolError,
  rpc,
  assertDb,
  McpError,
} from "./access";
import { catalogSummary, getSong, listSongs, ontology, searchSongs } from "./catalog";
import {
  requestWhyAiReview,
  readWhyAiReview,
  listWhyAiReviews,
  whyAiRequestSchema,
  whyReviewRates,
} from "./why-ai-review";
import { getWhy, listWhys, screenWhy, whyHistory } from "./song-whys";
import { hasMoreRows, boundedRows, pageSchema, pageCursor, nextCursor } from "./pagination";

export function tool<S extends z.ZodRawShape>(
  name: string,
  description: string,
  shape: S,
  handler: (input: z.infer<z.ZodObject<S>>, actor: Actor) => Promise<Record<string, unknown>>,
  capability: Capability = "catalog_read",
  mutates = false,
  actorLoader = loadActor,
  openWorld = false,
) {
  const definition = {
    name,
    title: name.replaceAll("_", " "),
    description: `Use this when ${description}`,
    inputSchema: shape,
    annotations: {
      readOnlyHint: !mutates,
      destructiveHint: false,
      idempotentHint: mutates,
      openWorldHint: openWorld,
    },
    handler: async (raw: unknown, ctx: ToolContext) => {
      try {
        return result(
          await handler(z.object(shape).strict().parse(raw), await actorLoader(ctx, capability)),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  };
  // The SDK uses a conditional generic handler type; parsing above enforces S at runtime.
  return defineTool(definition as unknown as ToolDefinition<S>);
}
const id = z.string().uuid();
const short = z.string().trim().min(1).max(200);
const date = z.string().datetime();
const status = z.enum(["approved", "pending_review", "rejected"]);
const whyFilters = {
  lane: short.optional(),
  song_id: id.optional(),
  artist: short.optional(),
  genre: short.optional(),
  decade: z
    .number()
    .int()
    .min(1900)
    .max(2100)
    .refine((n) => n % 10 === 0)
    .optional(),
  axis: z.enum(DIMS).optional(),
  status: status.optional(),
  confidence: short.optional(),
  created_after: date.optional(),
  created_before: date.optional(),
  stale: z.boolean().optional(),
};
const finding = z
  .object({
    severity: z.enum(["info", "warning", "error"]),
    category: z.string().min(1).max(80),
    excerpt: z.string().min(1).max(1000),
    explanation: z.string().min(10).max(2000),
    suggested_wording: z.string().max(1000).optional(),
    verification_kind: z.enum(["catalog_fact", "text_inference", "requires_listening"]),
  })
  .strict();

export const catalogTools = [
  tool(
    "get_profile",
    "identify your own connected MusicDNA operator account and current permissions. Does not enumerate other users.",
    {},
    async (_, a) => ({ id: a.userId, name: "MusicDNA operator", capabilities: a.capabilities }),
  ),
  tool(
    "catalog_get_summary",
    "audit authoritative catalog/Why counts and coverage. Unrecorded model rejection statistics are explicitly unavailable.",
    {},
    async (_, a) => catalogSummary(a),
  ),
  tool(
    "catalog_list_songs",
    "page the catalog with stable IDs and owner/filter-bound cursors. Genre means catalog primary lane; ordering is stable by ID.",
    {
      ...pageSchema,
      artist: short.optional(),
      title: short.optional(),
      genre: short.optional(),
      year_min: z.number().int().min(1800).max(2200).optional(),
      year_max: z.number().int().min(1800).max(2200).optional(),
      active: z.boolean().optional(),
      query: short.optional(),
      updated_after: date.optional(),
      attribute_complete: z.boolean().optional(),
      why_status: status.optional(),
    },
    async (i, a) => listSongs(a, i),
  ),
  tool(
    "catalog_get_song",
    "read one complete authoritative song, scores, associated explanations and catalog pairings. Missing provenance is not inferred.",
    { song_id: id },
    async (i, a) => getSong(a, i.song_id),
  ),
  tool(
    "catalog_search_songs",
    "search titles/artists by normalized title/artist, punctuation/diacritics and partial/fuzzy trigram matching, with stable IDs and heuristic match confidence. Includes verified artwork-release titles; does not assert unique album/recording identity.",
    { query: short, ...pageSchema },
    async (i, a) => searchSongs(a, i),
  ),
  tool(
    "catalog_get_song_attributes",
    "inspect the existing ten dimension scores, poles, provenance and supporting explanations for one song. No new scoring engine or confidence is invented.",
    { song_id: id },
    async (i, a) => {
      const s = await getSong(a, i.song_id);
      return { song: s.song, attributes: s.attributes, unavailable: s.unavailable };
    },
  ),
  tool(
    "catalog_get_attribute_ontology",
    "retrieve the live axes definitions/poles and shared numeric scale; unrecorded versions/thresholds remain unavailable.",
    {},
    async (_, a) => ontology(a.db),
  ),
  tool(
    "song_whys_get_summary",
    "audit saved explanation status/attribute/genre/decade counts. Human approval/rejection is distinct from model reviewer outcomes.",
    {},
    async (_, a) => catalogSummary(a),
  ),
  tool(
    "song_whys_list",
    "retrieve complete saved Song Whys with exact score/ontology and honest provenance, one cursor page at a time; continue until next_cursor is null.",
    { ...pageSchema, ...whyFilters },
    async (i, a) => listWhys(a, i),
  ),
  tool(
    "song_whys_get",
    "inspect a complete saved explanation and review_context_version before a paid re-review. Includes original/current score, authoritative definition, catalog recording identity and honest uncertainty.",
    { explanation_id: id },
    async (i, a) => ({ record: await getWhy(a, i.explanation_id) }),
  ),
  tool(
    "song_whys_request_ai_review",
    "explicitly re-review ONE selected saved explanation (approved included) with the configured stronger reviewer. PAID: obtain explicit human confirmation for this exact version/context before confirm_paid_review=true. Use song_whys_get first. One 20-second / 2,000-output-token attempt, no writer, no automatic retry. Reuse mutation_id after any lost response. Historical review, text, scores and approvals remain unchanged. Read-only access does not authorize this tool.",
    whyAiRequestSchema.shape,
    async (i, a) => requestWhyAiReview(a, i),
    "catalog_review",
    true,
    loadActor,
    true,
  ),
  tool(
    "song_whys_get_ai_review",
    "read one saved advisory AI-review request/result with original text and score, immutable version/context, new findings, nullable suggested score, measurements and separate stale flags. Does not start model work.",
    { request_id: id },
    async (i, a) => ({ review: await readWhyAiReview(a, i.request_id) }),
  ),
  tool(
    "song_whys_list_ai_reviews",
    "page saved AI-review results, score disputes and unavailable/uncertain score suggestions. Findings are new audit records, never retroactive historical verdicts. Does not run an AI review; rule-based song_whys_run_audit is separate.",
    {
      ...pageSchema,
      explanation_id: id.optional(),
      lane: short.optional(),
      score_disputed: z.boolean().optional(),
      suggestion_unavailable: z.boolean().optional(),
      stale: z.boolean().optional(),
      state: z
        .enum(["requested", "running", "completed", "failed", "ambiguous", "expired_or_ambiguous"])
        .optional(),
      policy_version: short.optional(),
    },
    async (i, a) => listWhyAiReviews(a, i),
  ),
  tool(
    "song_whys_get_ai_review_rates",
    "read separate failure and uncertainty rates for one review policy and optionally a selected cohort. Counts latest attempt per explanation, completed reviews only in rate denominators; unavailable attempts and older policies remain separate. No paid calls.",
    {
      policy_version: z.enum(["saved-song-why-review-v1", "saved-song-why-review-v2"]),
      explanation_ids: z.array(id).min(1).max(50).optional(),
    },
    async (i, a) => ({ rates: await whyReviewRates(a, i.policy_version, i.explanation_ids) }),
  ),
  tool(
    "song_whys_export",
    "start or advance an asynchronous complete JSON/CSV export. Start requires a fresh idempotency key. Status advances the queued snapshot job. Ready links expire and require the SAME account and current catalog permission; no records are truncated inline.",
    {
      action: z.enum(["start", "status"]),
      mutation_id: id.optional(),
      job_id: id.optional(),
      format: z.enum(["json", "csv"]).default("json"),
      filters: z
        .object({
          status: status.optional(),
          created_after: date.optional(),
          created_before: date.optional(),
        })
        .strict()
        .default({}),
    },
    async (i, a) => {
      if ((i.action === "start" && !i.mutation_id) || (i.action === "status" && !i.job_id))
        throw new McpError("INVALID_INPUT");
      const job = await rpc<Record<string, unknown>>(a.db, "musicdna_mcp_export", {
        p_action: i.action,
        p_mutation: i.mutation_id ?? null,
        p_id: i.job_id ?? null,
        p_format: i.format,
        p_filters: i.filters,
      });
      return {
        ...job,
        download_url:
          job.state === "ready" ? `https://www.musicdna.fm/admin-mcp/export/${job.id}` : null,
        authentication: "Same MusicDNA account; current permissions and expiry checked on download",
        polling:
          "Explicit status call performs snapshot processing; no model calls or automatic schedule",
      };
    },
    "catalog_read",
    true,
  ),
  tool(
    "song_whys_get_review_history",
    "retrieve only recorded baseline/revisions/review snapshots. Never reconstruct absent older drafts or model reviews.",
    { explanation_id: id, ...pageSchema },
    async (i, a) => whyHistory(a, i.explanation_id, i),
  ),
  tool(
    "song_whys_run_audit",
    "run independent rule-based text/catalog screening without changing content or calling an AI model. Hear claims always require listening; assistant must independently inspect returned evidence before suggesting wording.",
    { explanation_ids: z.array(id).min(1).max(20) },
    async (i, a) => ({
      reports: await Promise.all(
        i.explanation_ids.map(async (key) => screenWhy(await getWhy(a, key))),
      ),
      audit_kind: "deterministic screening, not a listening or independent model verdict",
    }),
  ),
  tool(
    "song_whys_find_conflicts",
    "inspect complete explanations on the same song for potential opposing audible descriptions. Returns exact excerpts/IDs as hypotheses requiring listening, not proven contradictions.",
    { song_id: id },
    async (i, a) => {
      const { data, error, count } = await a.db
        .from("musicdna_mcp_whys")
        .select("record", { count: "exact" })
        .eq("song_id", i.song_id)
        .order("id");
      assertDb(error);
      if (count !== data?.length) throw new McpError("COLLECTION_REQUIRES_PAGINATED_AUDIT");
      const records = (data ?? []).map((r) => r.record);
      const pairs = [
        ["sparse", "dense"],
        ["acoustic", "electronic"],
        ["dry", "reverb"],
        ["soft", "loud"],
      ];
      const possible = [];
      for (let x = 0; x < records.length; x++)
        for (let y = x + 1; y < records.length; y++)
          for (const [left, right] of pairs) {
            const l = records[x].explanation.audible_evidence as string,
              r = records[y].explanation.audible_evidence as string;
            if (
              (new RegExp(`\\b${left}\\b`, "i").test(l) &&
                new RegExp(`\\b${right}\\b`, "i").test(r)) ||
              (new RegExp(`\\b${right}\\b`, "i").test(l) &&
                new RegExp(`\\b${left}\\b`, "i").test(r))
            )
              possible.push({
                ids: [records[x].explanation.id, records[y].explanation.id],
                excerpts: [l, r],
                verification_kind: "requires_listening",
                reason:
                  "Potentially opposing descriptions can coexist in different parts/contexts; not a definitive musical contradiction.",
              });
          }
      return { song_id: i.song_id, possible_conflicts: possible, records_checked: records.length };
    },
  ),
  tool(
    "song_whys_submit_revision",
    "submit a version-bound draft to the existing human Admin Song Whys review queue. Requires explicit confirmation and an idempotency key. NEVER overwrites, approves or publishes the original.",
    {
      explanation_id: id,
      base_version: z.string().regex(/^why-v1:[0-9a-f]{64}$/),
      hear: z.string().trim().min(10).max(300),
      means: z.string().trim().min(10).max(300),
      reason: z.string().trim().min(10).max(2000),
      supporting_evidence: z
        .array(
          z
            .object({
              kind: z.enum([
                "catalog_fact",
                "text_inference",
                "requires_listening",
                "verified_recording_source",
              ]),
              reference: z.string().min(1).max(1000),
              note: z.string().min(1).max(1000),
            })
            .strict(),
        )
        .max(20),
      mutation_id: id,
      confirm_submit: z.literal(true),
    },
    async (i, a) =>
      rpc(a.db, "musicdna_mcp_submit_why_revision", {
        p_id: i.explanation_id,
        p_base_version: i.base_version,
        p_hear: i.hear,
        p_means: i.means,
        p_reason: i.reason,
        p_evidence: i.supporting_evidence,
        p_mutation: i.mutation_id,
      }),
    "catalog_propose",
    true,
  ),
  tool(
    "song_whys_record_audit_findings",
    "explicitly save evidence-bound audit findings without changing explanation approval. Repeated unresolved findings deduplicate; an idempotency key prevents duplicate writes.",
    {
      explanation_id: id,
      base_version: z.string().regex(/^why-v1:[0-9a-f]{64}$/),
      findings: z.array(finding).min(1).max(25),
      mutation_id: id,
      confirm_submit: z.literal(true),
    },
    async (i, a) =>
      rpc(a.db, "musicdna_mcp_record_why_findings", {
        p_id: i.explanation_id,
        p_base_version: i.base_version,
        p_findings: i.findings,
        p_mutation: i.mutation_id,
      }),
    "catalog_propose",
    true,
  ),
  tool(
    "song_whys_list_audit_findings",
    "page saved unresolved/resolved audit findings; no result does not establish that explanations passed an audit.",
    {
      ...pageSchema,
      explanation_id: id.optional(),
      severity: z.enum(["info", "warning", "error"]).optional(),
      song_id: id.optional(),
      axis: z.enum(DIMS).optional(),
      status: z.enum(["open", "resolved", "dismissed"]).default("open"),
      auditor_id: id.optional(),
      created_after: date.optional(),
    },
    async (i, a) => {
      const { limit, cursor, ...filters } = i;
      const state = pageCursor(cursor, a.userId, { tool: "findings", ...filters });
      let query = a.db
        .from("musicdna_song_why_audit_findings")
        .select("*,song_trait_explanations!inner(song_id,axis)", { count: "exact" })
        .lte("created_at", state.snapshot)
        .eq("status", i.status)
        .order("id")
        .limit(limit + 1);
      if (state.last) query = query.gt("id", state.last);
      if (i.song_id) query = query.eq("song_trait_explanations.song_id", i.song_id);
      if (i.axis) query = query.eq("song_trait_explanations.axis", i.axis);
      if (i.explanation_id) query = query.eq("explanation_id", i.explanation_id);
      if (i.severity) query = query.eq("severity", i.severity);
      if (i.auditor_id) query = query.eq("auditor_id", i.auditor_id);
      if (i.created_after) query = query.gte("created_at", i.created_after);
      const { data, error, count } = await query;
      assertDb(error);
      const rows = boundedRows(data ?? [], limit);
      return {
        findings: rows,
        total_count: state.total ?? count,
        returned_count: rows.length,
        next_cursor: hasMoreRows(count, rows.length)
          ? nextCursor(a.userId, { ...state, total: state.total ?? count }, rows.at(-1)!.id)
          : null,
      };
    },
  ),
];

// Standard discovery aliases complement the detailed domain tools; they never expose QA data.
export const discoveryTools = [
  defineTool({
    name: "search",
    title: "Search MusicDNA catalog",
    description:
      "Find catalog songs by title, artist or verified release title. Returns up to 20 identity matches; use catalog_search_songs for complete cursor pagination.",
    inputSchema: { query: z.string().trim().min(1).max(200) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ query }, ctx) => {
      try {
        const a = await loadActor(ctx, "catalog_read");
        const page = await searchSongs(a, { query, limit: 20 });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                results: page.songs.map((s) => ({
                  id: `song:${s.id}`,
                  title: `${s.title} — ${s.artist}`,
                  url: `https://www.musicdna.fm/admin-mcp/song/${s.id}`,
                })),
              }),
            },
          ],
        };
      } catch (e) {
        return toolError(e);
      }
    },
  }),
  defineTool({
    name: "fetch",
    title: "Fetch MusicDNA catalog song",
    description:
      "Read an exact song item returned by search, including canonical scores, associated explanations and provenance. This does not fetch private interview traces.",
    inputSchema: { id: z.string().regex(/^song:[0-9a-f-]{36}$/i) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ id: recordId }, ctx) => {
      try {
        const songId = id.parse(recordId.slice(5));
        const a = await loadActor(ctx, "catalog_read");
        const record = await getSong(a, songId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                id: recordId,
                title: `${record.song.title} — ${record.song.artist}`,
                text: JSON.stringify(record),
                url: `https://www.musicdna.fm/admin-mcp/song/${songId}`,
                metadata: { schema_version: "musicdna-admin.v1" },
              }),
            },
          ],
        };
      } catch (e) {
        return toolError(e);
      }
    },
  }),
];
