import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listWhyProposals, decideWhyProposal, type Proposal } from "@/lib/mcp/admin.functions";
import { Button } from "@/components/ui/button";
export function SongWhyProposals() {
  const list = useServerFn(listWhyProposals),
    decide = useServerFn(decideWhyProposal),
    qc = useQueryClient();
  const [after, setAfter] = useState<string>(),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const decisions = useRef(new Map<string, string>());
  const q = useQuery({
    queryKey: ["admin", "whys", "proposals", after],
    queryFn: () => list({ data: { after } }),
    enabled: loaded,
  });
  async function act(p: Proposal, decision: "approved" | "rejected") {
    if (
      !window.confirm(
        `${decision === "approved" ? "Approve this correction and update the canonical explanation" : "Reject this draft"}? Review the before/after text and evidence first.`,
      )
    )
      return;
    const key = `${p.id}:${p.version}:${decision}`;
    if (!decisions.current.has(key)) decisions.current.set(key, crypto.randomUUID());
    setBusy(true);
    setError("");
    try {
      await decide({
        data: { id: p.id, version: p.version, decision, mutation_id: decisions.current.get(key)! },
      });
      await qc.invalidateQueries({ queryKey: ["admin", "whys"] });
    } catch {
      setError(
        "Decision not confirmed. The explanation, song score, permissions or proposal version may have changed. Reload before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border hairline rounded-sm p-4">
      <h2 className="font-medium">Proposed Song Why corrections</h2>
      <p className="text-sm text-muted-foreground">
        Assistant suggestions are drafts. Review the evidence and listen to recording claims before
        approving one.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setLoaded(true);
          void q.refetch();
        }}
      >
        Load draft corrections
      </Button>
      {(q.isError || error) && (
        <p role="alert">
          {error ||
            "Draft corrections unavailable. The MCP migration and reviewer permission are required."}
        </p>
      )}
      {q.data?.rows.length === 0 && <p>No pending corrections.</p>}
      {q.data?.rows.map((p) => (
        <article key={p.id} className="border hairline rounded-sm p-3 space-y-2">
          <p className="text-xs">
            Explanation {p.explanation_id} · proposal v{p.version}
          </p>
          <p>
            <strong>Before — Hear:</strong> {p.base_snapshot.audible_evidence}
          </p>
          <p>
            <strong>Before — Means:</strong> {p.base_snapshot.interpretation}
          </p>
          <p>
            <strong>Proposed — Hear:</strong> {p.audible_evidence}
          </p>
          <p>
            <strong>Proposed — Means:</strong> {p.interpretation}
          </p>
          <p>
            <strong>Reason:</strong> {p.reason}
          </p>
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(p.supporting_evidence, null, 2)}
          </pre>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void act(p, "approved")}>
              Approve correction
            </Button>
            <Button
              size="sm"
              disabled={busy}
              variant="outline"
              onClick={() => void act(p, "rejected")}
            >
              Reject draft
            </Button>
          </div>
        </article>
      ))}
      {q.data?.next_after && (
        <Button size="sm" onClick={() => setAfter(q.data!.next_after!)}>
          Next drafts
        </Button>
      )}
      {after && (
        <Button size="sm" variant="outline" onClick={() => setAfter(undefined)}>
          First page
        </Button>
      )}
    </section>
  );
}
