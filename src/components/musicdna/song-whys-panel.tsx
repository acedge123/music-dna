import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { poleScoreLabel } from "@/musicdna/engine/axes";
import { draftSongWhys, listSongWhys, reviewSongWhy, songWhysOverview } from "@/lib/song-whys.functions";

const FILTERS = [
  ["pending_review", "Ready to review"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
] as const;

export function SongWhysPanel() {
  const [status, setStatus] = useState<(typeof FILTERS)[number][0]>("pending_review");
  const [lane, setLane] = useState("all");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ id: string; ev: string; it: string } | null>(null);
  const overview = useServerFn(songWhysOverview), draft = useServerFn(draftSongWhys);
  const list = useServerFn(listSongWhys), review = useServerFn(reviewSongWhy);
  const qc = useQueryClient();
  const ov = useQuery({ queryKey: ["admin", "whys", "overview"], queryFn: () => overview() });
  const q = useQuery({ queryKey: ["admin", "whys", status], queryFn: () => list({ data: { status, page: 0 } }) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "whys"] });

  async function runBatch() {
    setBusy(true);
    try {
      const r = await draft();
      toast.success(`${r.drafted} drafted, ${r.rejected} failed review, ${r.failed} errors (${r.songs} songs)`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Drafting failed");
    } finally {
      setBusy(false);
    }
  }
  async function act(id: string, s: "approved" | "rejected", text?: { ev: string; it: string }) {
    try {
      await review({ data: { id, status: s, ...(text ? { audible_evidence: text.ev, interpretation: text.it } : {}) } });
      setEdit(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }
  const rows = (q.data?.rows ?? []).filter((r) => lane === "all" || r.lane === lane);
  const lanes = [...new Set((q.data?.rows ?? []).map((r) => r.lane))].sort();

  return (
    <div className="space-y-6">
      <section className="space-y-3 border hairline rounded-sm p-4">
        <p className="text-sm">
          Why-this-score explanations: {ov.data?.totals.approved ?? 0} approved,{" "}
          {ov.data?.totals.pending_review ?? 0} waiting, {ov.data?.totals.rejected ?? 0} rejected.{" "}
          {ov.data?.songs_remaining ?? "…"} songs still need drafts (most-picked first).
        </p>
        {ov.data && ov.data.next_batch.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Next batch ({ov.data.next_batch_calls} AI calls): {ov.data.next_batch.join(" · ")}
          </p>
        )}
        <Button size="sm" disabled={busy || !ov.data?.songs_remaining} onClick={() => void runBatch()}>
          {busy ? "Drafting…" : "Draft next batch"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Sol drafts, an independent reviewer checks musical accuracy; only passes land here. Only
          approved explanations are ever used.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <Button key={k} size="sm" variant={status === k ? "default" : "outline"} onClick={() => setStatus(k)}>
            {label}
          </Button>
        ))}
        <select
          aria-label="Filter by lane"
          className="rounded-sm border hairline bg-background px-2 text-sm"
          value={lane}
          onChange={(e) => setLane(e.target.value)}
        >
          <option value="all">All lanes</option>
          {lanes.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {q.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            return (
              <li key={r.id} className="space-y-2 border hairline rounded-sm p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{r.song}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {r.lane}{r.year ? ` · ${r.year}` : ""} · {poleScoreLabel(r.axis, r.score)} <span className="opacity-60">({r.axis} {r.score})</span>
                    {r.stale ? " · stale: song rescored" : ""}
                  </p>
                </div>
                {edit?.id === r.id ? (
                  <div className="space-y-2">
                    <textarea aria-label="What you can hear" className="w-full rounded-sm border hairline bg-background p-2 text-sm" value={edit.ev} onChange={(e) => setEdit({ ...edit, ev: e.target.value })} />
                    <textarea aria-label="What it means" className="w-full rounded-sm border hairline bg-background p-2 text-sm" value={edit.it} onChange={(e) => setEdit({ ...edit, it: e.target.value })} />
                  </div>
                ) : (
                  <>
                    <p className="text-sm"><span className="text-muted-foreground">Hear: </span>{r.audible_evidence}</p>
                    <p className="text-sm"><span className="text-muted-foreground">Means: </span>{r.interpretation}</p>
                  </>
                )}
                {r.review_note && <p className="text-xs text-muted-foreground">Reviewer: {r.review_note}</p>}
                {status !== "approved" || edit?.id === r.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void act(r.id, "approved", edit?.id === r.id ? edit : undefined)}>
                      {edit?.id === r.id ? "Save & approve" : "Approve"}
                    </Button>
                    {edit?.id !== r.id && (
                      <Button size="sm" variant="outline" onClick={() => setEdit({ id: r.id, ev: r.audible_evidence, it: r.interpretation })}>
                        Edit
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => void act(r.id, "rejected")}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEdit({ id: r.id, ev: r.audible_evidence, it: r.interpretation })}>
                    Edit
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
