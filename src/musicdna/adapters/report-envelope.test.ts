import { describe, expect, it, vi } from "vitest";
import { buildLedger, type LedgerChoice } from "@/musicdna/engine/evidence";
import { DIMS } from "@/musicdna/engine/axes";
import { buildReportEnvelope, loadReportEnvelope } from "./report-envelope";
import { buildDnaSummary } from "@/musicdna/engine/dna-summary";

vi.mock("./llm-gateway", () => ({ callLLM: vi.fn(() => { throw new Error("model called"); }) }));

function pick(i: number, a: number, b: number): LedgerChoice {
  return {
    pairing_id: `p${i}`,
    tests: ["texture"],
    chosen: { id: `c${i}`, title: `Chosen ${i}`, artist: `A${i}`, texture: a, lane: "Pop" },
    rejected: { id: `r${i}`, title: `Rejected ${i}`, artist: `B${i}`, texture: b, lane: "Pop" },
  };
}
const ledger = buildLedger([pick(1, 80, 30), pick(2, 75, 20), pick(3, 70, 25), pick(4, 20, 80)], DIMS);
const session = { id: "s1", mode: "discover", decade: null, parent_session_id: null, completed_at: "2026-11-11T00:00:00Z" };

describe("buildReportEnvelope", () => {
  it("replays frozen text and signature verbatim", () => {
    const e = buildReportEnvelope(session, { version: 1, source: "pairings", content: { synthesis: "Polish doesn't mean polite.", signature: { name: "The Varnisher", hook: "h" } } }, ledger);
    expect(e.frozen.text).toBe("Polish doesn't mean polite.");
    expect(e.frozen.signature_status).toBe("present");
    expect(e.frozen.result_version).toBe(1);
  });

  it("marks a historical reading without signature as absent, never generated", () => {
    const e = buildReportEnvelope(session, { version: 1, source: "pairings", content: { synthesis: "x" } }, ledger);
    expect(e.frozen.signature).toBeNull();
    expect(e.frozen.signature_status).toBe("absent");
  });

  it("does not imply an archetype was saved when none was frozen", () => {
    const e = buildReportEnvelope(session, { version: 1, source: "pairings", content: { synthesis: "x" } }, ledger);
    expect(e.frozen.archetype).toEqual({ saved_at_finalize: false, status: "not_saved" });
    expect(e.annotations.dna_summary?.archetype).toEqual({ status: "emerging", name: null });
  });

  it("carries a frozen leaning archetype into the panel", () => {
    const e = buildReportEnvelope(session, { version: 1, source: "pairings", content: { synthesis: "x", archetype_v2: { status: "leaning", name: "The Romantic" } } }, ledger);
    expect(e.annotations.dna_summary?.archetype).toEqual({ status: "leaning", name: "The Romantic" });
  });

  it("matches the fresh reveal panel for the same frozen evidence", () => {
    const e = buildReportEnvelope(session, { version: 1, source: "pairings", content: { synthesis: "x" } }, ledger);
    expect(e.annotations.dna_summary).toEqual(buildDnaSummary(ledger, null));
    expect(e.annotations.dna_summary?.matchups).toHaveLength(4);
  });

  it("reports unavailable annotations distinctly from an empty healthy report", () => {
    const e = buildReportEnvelope(session, { version: 1, source: "pairings", content: { synthesis: "x" } }, null);
    expect(e.annotations.status).toBe("unavailable");
    expect(e.frozen.text).toBe("x");
  });
});

function fakeClient(sessionRow: unknown, resultRow: unknown) {
  const writes: string[] = [];
  const chain = (data: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
    c.maybeSingle = async () => ({ data, error: null });
    for (const m of ["insert", "update", "upsert", "delete"]) c[m] = () => { writes.push(m); return c; };
    c.then = (r: (v: unknown) => unknown) => r({ data: [], error: null });
    return c;
  };
  return {
    writes,
    client: { from: (t: string) => chain(t === "sessions" ? sessionRow : t === "session_results" ? resultRow : null) } as never,
  };
}

describe("loadReportEnvelope", () => {
  it("returns not_found for another owner's session (RLS hides it)", async () => {
    const { client } = fakeClient(null, null);
    expect((await loadReportEnvelope(client, "s1", null)).kind).toBe("not_found");
  });
  it("distinguishes an absent result version", async () => {
    const { client } = fakeClient(session, null);
    expect((await loadReportEnvelope(client, "s1", 7)).kind).toBe("version_not_found");
    expect((await loadReportEnvelope(client, "s1", null)).kind).toBe("no_result");
  });
  it("reads without writes or model calls", async () => {
    const { client, writes } = fakeClient(session, { version: 1, source: "pairings", content: { synthesis: "x" } });
    const r = await loadReportEnvelope(client, "s1", 1);
    expect(r.kind).toBe("ok");
    expect(writes).toEqual([]);
  });
});
