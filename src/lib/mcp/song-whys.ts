import type { Actor } from "./access";
import { assertDb, McpError, rpc } from "./access";
import { hasMoreRows, boundedRows, nextCursor, pageCursor, safeSearch } from "./pagination";
export type WhyFilters = {
  lane?: string;
  song_id?: string;
  artist?: string;
  genre?: string;
  decade?: number;
  axis?: string;
  status?: string;
  confidence?: string;
  created_after?: string;
  created_before?: string;
  stale?: boolean;
};
export async function listWhys(
  actor: Actor,
  input: WhyFilters & { limit: number; cursor?: string },
) {
  const { limit, cursor, ...filters } = input;
  const state = pageCursor(cursor, actor.userId, { tool: "song_whys_list", ...filters });
  let query = actor.db
    .from("musicdna_mcp_whys")
    .select("id,record", { count: "exact" })
    .lte("created_at", state.snapshot)
    .order("id")
    .limit(limit + 1);
  if (state.last) query = query.gt("id", state.last);
  if (filters.song_id) query = query.eq("song_id", filters.song_id);
  if (filters.artist) query = query.ilike("artist", `%${safeSearch(filters.artist)}%`);
  if (filters.lane && filters.genre && filters.lane !== filters.genre)
    throw new McpError("INVALID_INPUT");
  if (filters.lane ?? filters.genre) query = query.eq("genre", filters.lane ?? filters.genre);
  if (filters.decade !== undefined)
    query = query.gte("year", filters.decade).lt("year", filters.decade + 10);
  if (filters.axis) query = query.eq("axis", filters.axis);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.confidence) query = query.eq("confidence", filters.confidence);
  if (filters.created_after) query = query.gte("created_at", filters.created_after);
  if (filters.created_before) query = query.lte("created_at", filters.created_before);
  if (filters.stale !== undefined) query = query.eq("stale", filters.stale);
  const { data, error, count } = await query;
  assertDb(error);
  const rows = boundedRows(data ?? [], limit);
  return {
    records: rows.map((r) => r.record),
    total_count: state.total ?? count,
    remaining_count: count,
    returned_count: rows.length,
    snapshot: state.snapshot,
    sort: "id ascending",
    count_scope: "total at first page; mutable records are not a cross-page snapshot",
    next_cursor: hasMoreRows(count, rows.length)
      ? nextCursor(actor.userId, { ...state, total: state.total ?? count }, rows.at(-1)!.id)
      : null,
    availability: {
      reviewer_model_filter: "not_recorded",
      numeric_reviewer_confidence: "not_recorded",
    },
  };
}
export async function getWhy(actor: Actor, id: string) {
  return rpc<WhyRecord>(actor.db, "musicdna_mcp_why_review_context", { p_id: id });
}
export type WhyRecord = {
  explanation: {
    id: string;
    song_id: string;
    axis: string;
    score_at_write: number;
    audible_evidence: string;
    interpretation: string;
    review_note: string | null;
    scoring_version: string | null;
    status: string;
    [key: string]: unknown;
  };
  version: string;
  review_context_version?: string;
  song: { id: string; title: string; artist: string; year: number | null; genre?: string };
  attribute: {
    key: string | null;
    current_score: number | null;
    score_at_write: number;
    [key: string]: unknown;
  };
  availability: Record<string, string>;
};
export async function whyHistory(
  actor: Actor,
  id: string,
  input: { limit: number; cursor?: string },
) {
  await getWhy(actor, id);
  const state = pageCursor(input.cursor, actor.userId, {
    tool: "song_whys_get_review_history",
    id,
  });
  let query = actor.db
    .from("musicdna_song_why_history")
    .select("id,version,snapshot,recorded_at,recording_kind", { count: "exact" })
    .eq("explanation_id", id)
    .lte("recorded_at", state.snapshot)
    .order("id")
    .limit(input.limit + 1);
  if (state.last) query = query.gt("id", state.last);
  const { data, error, count } = await query;
  assertDb(error);
  const rows = boundedRows(data ?? [], input.limit);
  return {
    explanation_id: id,
    history: rows,
    total_count: state.total ?? count,
    history_complete_before_baseline: false,
    unavailable:
      "Original drafts, model rejections and edits before the baseline were not recorded; no reconstruction is attempted.",
    snapshot: state.snapshot,
    next_cursor: hasMoreRows(count, rows.length)
      ? nextCursor(actor.userId, { ...state, total: state.total ?? count }, rows.at(-1)!.id)
      : null,
  };
}
export function screenWhy(record: WhyRecord) {
  const w = record.explanation;
  const findings: Array<Record<string, unknown>> = [];
  const inspect = (
    text: string,
    regex: RegExp,
    category: string,
    explanation: string,
    kind: string,
  ) => {
    for (const match of text.matchAll(regex))
      findings.push({
        explanation_id: w.id,
        version: record.version,
        category,
        severity: "warning",
        excerpt: match[0],
        explanation,
        verification_kind: kind,
        recording_verification_required: kind === "requires_listening",
      });
  };
  for (const text of [w.audible_evidence, w.interpretation, w.review_note ?? ""]) {
    inspect(
      text,
      /\b(?:choos(?:es|ing) to reveal (?:his|her|their) insecurities|a (?:man|woman) unravell?ing|(?:he|she|they|the artist) (?:wants?|intends?|is trying) to)\b/gi,
      "unsupported_intention",
      "Text asserts intention or psychology not established by the saved choices or catalog. Qualify or remove; this is textual screening, not an auditory verdict.",
      "text_inference",
    );
    inspect(
      text,
      /\b(?:close[- ]mi(?:c|k)(?:ed|ing)|recorded (?:in|at)|(?:ribbon|condenser|dynamic) microphone|double[- ]tracked|falsetto|steel guitar)\b/gi,
      "recording_claim",
      "This instrumentation, technique or recording claim needs listening or an authoritative recording source. Catalog data alone cannot verify it.",
      "requires_listening",
    );
  }
  if (record.attribute.current_score !== w.score_at_write)
    findings.push({
      explanation_id: w.id,
      version: record.version,
      category: "stale_score",
      severity: "error",
      excerpt: w.audible_evidence,
      explanation:
        "The saved score differs from the current song score. Do not attach this explanation to the new score.",
      verification_kind: "catalog_fact",
      recording_verification_required: false,
    });
  if (!record.attribute.key)
    findings.push({
      category: "ontology_missing",
      severity: "error",
      excerpt: w.axis,
      explanation: "No authoritative attribute definition was found.",
      verification_kind: "catalog_fact",
    });
  return {
    explanation_id: w.id,
    version: record.version,
    recommendation: findings.length ? "Needs Revision" : "Pass",
    pass_scope:
      "Rule-based catalog/text checks only; not an independent model verdict or proof that the recording sounds this way.",
    confidence: "limited",
    recording_verification_required: true,
    findings,
    next_step:
      "The assistant should independently inspect the complete explanation, exact score and ontology; verify auditory claims by listening before proposing changes. No approved content changed.",
  };
}
