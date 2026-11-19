import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { boundedRows, pageCursor, nextCursor, safeSearch } from "./pagination";
import { csvCell, formatExport } from "./export-format";
import { screenWhy, type WhyRecord, listWhys } from "./song-whys";
import { type Actor, McpError, toolError, result } from "./access";
import { catalogTools, discoveryTools, tool } from "./tools";
import manifest from "../../../.lovable/mcp/manifest.json";
const owner = randomUUID();
describe("MCP contract boundaries", () => {
  it("binds cursors to owner, filter and expiry", () => {
    const state = pageCursor(undefined, owner, { status: "approved" }),
      cursor = nextCursor(owner, state, randomUUID());
    expect(pageCursor(cursor, owner, { status: "approved" }).query).toBe(state.query);
    expect(() => pageCursor(cursor, randomUUID(), { status: "approved" })).toThrow(
      "INVALID_CURSOR",
    );
    expect(() => pageCursor(cursor, owner, { status: "rejected" })).toThrow("INVALID_CURSOR");
    expect(() =>
      pageCursor(
        nextCursor(owner, { ...state, snapshot: "2020-01-01T00:00:00.000Z" }, randomUUID()),
        owner,
        { status: "approved" },
      ),
    ).toThrow("INVALID_CURSOR");
    expect(safeSearch("a,b%()\\*c")).toBe("a b c");
  });
  it("shrinks pages at record boundaries rather than truncating their text", () => {
    const rows = [
      { id: 1, text: "a".repeat(100) },
      { id: 2, text: "b".repeat(100) },
    ];
    expect(boundedRows(rows, 20, 150)).toEqual([rows[0]]);
    expect(() => boundedRows(rows, 20, 10)).toThrow("RECORD_REQUIRES_EXPORT");
  });
  it("exports lossless JSON, full nested CSV and spreadsheet-safe strings", () => {
    expect(csvCell('  =HYPERLINK("bad")')).toContain("'  =HYPERLINK");
    const snapshot = {
      schema_version: "musicdna-admin-export.v1",
      id: randomUUID(),
      format: "json" as const,
      offset: 0,
      next_offset: null,
      generation_timestamp: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      total_record_count: 1,
      export_count: 1,
      records: [
        {
          explanation: { audible_evidence: 'A voice, "dry"\nwith guitar', id: randomUUID() },
          version: "v1",
          song: { title: "Test" },
          attribute: { score: 80 },
          availability: { writer_model_id: "not_recorded" },
        },
      ],
    };
    expect(JSON.parse(formatExport(snapshot).text)).toEqual(snapshot);
    expect(formatExport({ ...snapshot, format: "csv" }).text).toContain(
      '""writer_model_id"":""not_recorded""',
    );
    expect(() => formatExport({ ...snapshot, export_count: 2 })).toThrow("EXPORT_COUNT_MISMATCH");
  });
  it("flags the requested Burn regression without pretending to listen", () => {
    const record = {
      explanation: {
        id: randomUUID(),
        song_id: randomUUID(),
        axis: "texture",
        score_at_write: 80,
        audible_evidence: "A close-miked vocal.",
        interpretation: "A man unravelling, choosing to reveal his insecurities.",
        review_note: null,
        scoring_version: "v1",
        status: "approved",
      },
      version: "saved-v1",
      song: { id: randomUUID(), title: "Burn, Burn, Burn", artist: "Zach Bryan", year: 2022 },
      attribute: { key: "texture", current_score: 80, score_at_write: 80 },
      availability: {},
    } as WhyRecord;
    const report = screenWhy(record);
    expect(report.recommendation).toBe("Needs Revision");
    expect(report.recording_verification_required).toBe(true);
    expect(report.findings.some((f) => f.category === "unsupported_intention")).toBe(true);
    expect(report.findings.some((f) => f.category === "recording_claim")).toBe(true);
  });
  it("commits the same tool inventory and permits no assistant approval/delete/rescore tools", () => {
    expect(manifest.mcp.tools.map((t) => t.name).sort()).toEqual(
      [...discoveryTools, ...catalogTools].map((t) => t.name).sort(),
    );
    expect(catalogTools.some((t) => /approve|delete|rescore/.test(t.name))).toBe(false);
    expect(manifest.auth).toMatchObject({
      type: "oauth",
      require_oauth_client_claim: true,
      accepted_audiences: ["authenticated"],
    });
  });
  it("never exposes raw errors or secrets and rejects oversized inline results", () => {
    expect(JSON.stringify(toolError(new Error("credential=DO_NOT_DISCLOSE")))).not.toContain(
      "DO_NOT_DISCLOSE",
    );
    expect(() => result({ records: "x".repeat(61000) })).toThrow("RESPONSE_TOO_LARGE");
  });
  it("validates strict schemas before checking access, and fails closed on missing permission", async () => {
    const loader = vi.fn(async () => {
      throw new McpError("FORBIDDEN");
    });
    const t = tool("example", "test", {}, async () => ({}), "catalog_read", false, loader);
    const handler = t.handler as (input: unknown, ctx: never) => Promise<unknown>;
    expect(await handler({ injected: "sql" }, {} as never)).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "INVALID_INPUT" } },
    });
    expect(loader).not.toHaveBeenCalled();
    expect(await handler({}, {} as never)).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "FORBIDDEN" } },
    });
  });
});

it("retrieves every complete approved record across adaptive cursor pages with no duplicate/omission", async () => {
  const start = Date.now() - 10000;
  const all = Array.from({ length: 795 }, (_, n) => ({
    id: `00000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
    created_at: new Date(start).toISOString(),
    status: n < 768 ? "approved" : "pending_review",
    record: { explanation: { audible_evidence: "Full evidence ".repeat(100) }, n },
  }));
  const db = {
    from: () => {
      let rows = [...all],
        limit = 1000;
      const query = {
        select: () => query,
        eq: (k: string, v: unknown) => {
          rows = rows.filter((r) => r[k as keyof typeof r] === v);
          return query;
        },
        lte: (k: string, v: string) => {
          rows = rows.filter((r) => String(r[k as keyof typeof r]) <= v);
          return query;
        },
        order: () => query,
        gt: (_: string, v: string) => {
          rows = rows.filter((r) => r.id > v);
          return query;
        },
        limit: (n: number) => {
          limit = n;
          return query;
        },
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve({ data: rows.slice(0, limit), count: rows.length, error: null }).then(
            resolve,
          ),
      };
      return query;
    },
  };
  const a = { userId: owner, db, capabilities: { catalog_read: true } } as unknown as Actor;
  const seen: number[] = [];
  let cursor: string | undefined;
  do {
    const page = await listWhys(a, { status: "approved", limit: 50, cursor });
    expect(page.total_count).toBe(768);
    for (const r of page.records) {
      expect(r.explanation.audible_evidence).toHaveLength(1400);
      seen.push(r.n);
    }
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  expect(seen).toEqual(Array.from({ length: 768 }, (_, n) => n));
});
