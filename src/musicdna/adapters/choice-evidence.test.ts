import { describe, expect, it, vi } from "vitest";
import { loadChoiceEvidence } from "./choice-evidence";
import { loadPublicDefiningChoices } from "./public-evidence";
import { expectedCatalog } from "../engine/evidence-snapshot";

function client(error: { message: string } | null = null) {
  const data = [1, 2, 3, 4].map((id) => ({
    id: String(id),
    session_id: "s",
    pairing_id: String(id),
    chosen_song_id: "a",
    rejected_song_id: "b",
    created_at: String(id),
    evidence_snapshot: {
      version: "choice-evidence-v1",
      source: "pairing",
      choice_id: String(id),
      session_id: "s",
      pairing_id: String(id),
      created_at: String(id),
      ms_to_decide: 100,
      mutation_id: null,
      catalog_revision: "revision",
      catalog: expectedCatalog(
        { tests: ["scale"], diagnostic_weight: 100 },
        { id: "a", title: "Frozen A", artist: "X", scale: id < 4 ? 90 : 10 },
        { id: "b", title: "Frozen B", artist: "Y", scale: id < 4 ? 10 : 90 },
      ),
      contrasts: {},
    },
  }));
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.order.mockReturnValue(q);
  const from = vi.fn().mockReturnValue(q);
  return { api: { from }, q };
}

describe("shared persisted evidence adapter", () => {
  it("reads only snapshots, scopes session and stabilizes ordering", async () => {
    const { api, q } = client();
    const { ledger } = await loadChoiceEvidence(api as never, "s");
    expect(api.from).toHaveBeenCalledWith("choices");
    expect(q.select.mock.calls[0][0]).not.toMatch(/pairing:|chosen:|rejected:/);
    expect(q.eq).toHaveBeenCalledWith("session_id", "s");
    expect(q.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(ledger.axes[0]).toMatchObject({ supporting: 3, contradicting: 1, status: "qualified" });
  });
  it("public evidence uses the same qualified direction, not fastest decisions", async () => {
    const { api } = client();
    const evidence = await loadPublicDefiningChoices(api as never, "s");
    expect(evidence).toEqual([
      {
        chosen_title: "Frozen A",
        chosen_artist: "X",
        rejected_title: "Frozen B",
        rejected_artist: "Y",
      },
    ]);
  });
  it("does not disguise database errors as no-pattern evidence", async () => {
    const { api } = client({ message: "unavailable" });
    await expect(loadChoiceEvidence(api as never, "s")).rejects.toThrow(
      "choice_evidence_unavailable",
    );
  });
});
