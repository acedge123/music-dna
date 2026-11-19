import type { Actor } from "./access";
import { assertDb, McpError, rpc } from "./access";
import { hasMoreRows, boundedRows, nextCursor, pageCursor, safeSearch } from "./pagination";
import { approvedArtwork } from "../../musicdna/adapters/song-artwork";
import { DIMS } from "../../musicdna/engine/axes";
export type CatalogFilters = {
  artist?: string;
  title?: string;
  genre?: string;
  year_min?: number;
  year_max?: number;
  active?: boolean;
  query?: string;
  updated_after?: string;
  attribute_complete?: boolean;
  why_status?: "approved" | "pending_review" | "rejected";
};
export async function ontology(db: Actor["db"]) {
  const { data, error } = await db
    .from("axes")
    .select("key,low_pole,high_pole,analyst_label,tradeoff_sentence,sort_order,updated_at")
    .in("key", [...DIMS])
    .order("sort_order");
  assertDb(error);
  return {
    axes: data,
    scale: { min: 0, max: 100, high: 100, low: 0 },
    ontology_source: "public.axes + shared engine axes.ts",
    version: null,
    unavailable: {
      ontology_version: "No version column recorded",
      per_attribute_confidence_thresholds:
        "Not recorded; diagnostic_power_confidence is not per-attribute confidence",
    },
  };
}
export async function listSongs(
  actor: Actor,
  input: CatalogFilters & { limit: number; cursor?: string },
) {
  const { limit, cursor, ...filters } = input;
  const state = pageCursor(cursor, actor.userId, { tool: "catalog_list_songs", ...filters });
  let query = actor.db
    .from("songs")
    .select(
      "id,title,artist,year,primary_lane,sub_lane,active,scoring_version,updated_at" +
        (filters.why_status ? ",song_trait_explanations!inner(status)" : ""),
      {
        count: "exact",
      },
    )
    .lte("created_at", state.snapshot)
    .order("id")
    .limit(limit + 1);
  if (state.last) query = query.gt("id", state.last);
  if (filters.why_status) query = query.eq("song_trait_explanations.status", filters.why_status);
  if (filters.artist) query = query.ilike("artist", `%${safeSearch(filters.artist)}%`);
  if (filters.title) query = query.ilike("title", `%${safeSearch(filters.title)}%`);
  if (filters.genre) query = query.eq("primary_lane", filters.genre);
  if (filters.active !== undefined) query = query.eq("active", filters.active);
  if (filters.year_min !== undefined) query = query.gte("year", filters.year_min);
  if (filters.year_max !== undefined) query = query.lte("year", filters.year_max);
  if (filters.updated_after) query = query.gte("updated_at", filters.updated_after);
  if (filters.query) {
    const text = safeSearch(filters.query);
    if (!text) throw new McpError("INVALID_INPUT");
    query = query.or(`title.ilike.%${text}%,artist.ilike.%${text}%`);
  }
  if (filters.attribute_complete === true)
    for (const dim of DIMS) query = query.not(dim, "is", null);
  if (filters.attribute_complete === false)
    query = query.or(DIMS.map((dim) => `${dim}.is.null`).join(","));
  const { data, error, count } = await query;
  assertDb(error);
  const rows = boundedRows(
    (data ?? []) as unknown as { id: string; [key: string]: unknown }[],
    limit,
  );
  return {
    songs: rows,
    remaining_count: count,
    total_count: state.total ?? count,
    sort: "id ascending",
    snapshot: state.snapshot,
    count_scope:
      "matching rows at or after this cursor; total is the initial matching count; not a frozen cross-page snapshot",
    next_cursor: hasMoreRows(count, rows.length)
      ? nextCursor(actor.userId, { ...state, total: state.total ?? count }, rows.at(-1)!.id)
      : null,
    unavailable_filters: {
      album: "Album exists only on optional release artwork, not a song identity field",
      popularity:
        "Live usage metrics arrive with QA tools; this list does not invent a popularity ordering",
    },
  };
}
export async function getSong(actor: Actor, id: string) {
  const [
    { data: song, error },
    { data: whys, error: whyError },
    { data: pairings, error: pairError, count: pairCount },
  ] = await Promise.all([
    actor.db.from("songs").select("*").eq("id", id).maybeSingle(),
    actor.db
      .from("musicdna_mcp_whys")
      .select("record", { count: "exact" })
      .eq("song_id", id)
      .order("id")
      .limit(21),
    actor.db
      .from("pairings")
      .select("id,song_a_id,song_b_id,tests,active,lane,user_facing_tradeoff", { count: "exact" })
      .or(`song_a_id.eq.${id},song_b_id.eq.${id}`)
      .order("id")
      .limit(21),
  ]);
  assertDb(error);
  assertDb(whyError);
  assertDb(pairError);
  if (!song) throw new McpError("NOT_FOUND");
  const axes = await ontology(actor.db);
  const { data: art, error: artError } = await actor.db
    .from("song_artwork")
    .select("*")
    .eq("song_id", id)
    .maybeSingle();
  assertDb(artError);
  const artwork = art ? approvedArtwork(art) : null;
  return {
    song,
    artwork,
    album: artwork?.album_title ?? null,
    album_source: artwork
      ? "verified licensed artwork release; not unique recording identity"
      : "not recorded/approved",
    attributes: DIMS.map((key) => ({
      key,
      score: song[key],
      definition: axes.axes?.find((a) => a.key === key),
      scale: { min: 0, max: 100 },
      confidence: null,
      scoring_method: song.scoring_version,
      scored_at: song.scored_at,
      supporting_evidence: song.rationale,
    })),
    song_whys: whys?.slice(0, 20).map((w) => w.record),
    song_whys_complete: (whys?.length ?? 0) <= 20,
    song_whys_continuation: "song_whys_list with song_id",
    pairings: pairings?.slice(0, 20),
    pairing_count: pairCount,
    pairings_complete: (pairings?.length ?? 0) <= 20,
    unavailable: {
      live_usage_statistics: "Phase 2 authorized aggregate tools pending",
      pairing_continuation: "Phase 2 pairings_list pending",
      per_attribute_confidence: "Not recorded",
      review_history: "Use song_whys_get_review_history; only stored history is authoritative",
    },
  };
}
export async function catalogSummary(actor: Actor) {
  return rpc<Record<string, unknown>>(actor.db, "musicdna_mcp_catalog_summary");
}

export async function searchSongs(
  actor: Actor,
  input: { query: string; limit: number; cursor?: string },
) {
  const state = pageCursor(input.cursor, actor.userId, {
    tool: "catalog_search_songs",
    query: input.query,
  });
  const result = await rpc<{ songs: Record<string, unknown>[]; total_count: number }>(
    actor.db,
    "musicdna_mcp_search_songs",
    {
      p_query: input.query,
      p_limit: input.limit,
      p_after: state.last ?? null,
      p_snapshot: state.snapshot,
    },
  );
  const rows = result.songs.slice(0, input.limit);
  return {
    ...result,
    songs: rows,
    returned_count: rows.length,
    match_method:
      "normalized punctuation/diacritics, substring or trigram Dice >=0.3; heuristic text similarity, not probability of a correct recording identity",
    sort: "id ascending",
    snapshot: state.snapshot,
    album_search:
      "Search includes verified, display-enabled licensed artwork release titles; a release match does not prove recording identity",
    next_cursor:
      result.songs.length > input.limit
        ? nextCursor(actor.userId, state, String(rows.at(-1)!.id))
        : null,
  };
}
