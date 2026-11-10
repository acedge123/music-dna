import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listSongFacts, reviewSongFact } from "@/lib/song-facts.functions";

const FILTERS = ["draft", "needs_human", "approved", "rejected", "all"] as const;
const LABEL: Record<string, string> = {
  draft: "Ready to review",
  needs_human: "Needs a closer look",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
};
const KIND: Record<string, string> = {
  sound: "Sound",
  arrangement_production: "Arrangement & production",
  influences: "Influences",
  cultural_context: "Cultural context",
  distinctive_moment: "Distinctive moment",
};

export function SongFactsPanel() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("draft");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const list = useServerFn(listSongFacts);
  const review = useServerFn(reviewSongFact);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["song-facts", status, page],
    queryFn: () => list({ data: { status, page } }),
  });
  const act = async (id: string, next: "approved" | "rejected", text?: string) => {
    try {
      await review({ data: { id, status: next, text } });
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["song-facts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };
  const t = q.data?.totals ?? {};
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Checked facts the critic may use about each song. Every fact comes from the cited source and was
        cross-checked against it. Only approved facts can ever reach the critic. Songs with approved facts:{" "}
        {q.data?.songs ?? 0}.
      </p>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={status === f ? "default" : "outline"}
            onClick={() => {
              setStatus(f);
              setPage(0);
            }}
          >
            {LABEL[f]}
            {f !== "all" ? ` (${t[f] ?? 0})` : ""}
          </Button>
        ))}
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (
        <div className="divide-y hairline border hairline rounded-sm">
          {(q.data?.rows ?? []).map((r) => (
            <div key={r.id} className="p-3 space-y-1">
              <div className="flex justify-between gap-3 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                <span>
                  {r.song} · {KIND[r.kind] ?? r.kind}
                </span>
                <span>{LABEL[r.status]}</span>
              </div>
              {editing?.id === r.id ? (
                <textarea
                  className="w-full rounded-sm border hairline bg-background p-2 text-sm"
                  value={editing.text}
                  onChange={(e) => setEditing({ id: r.id, text: e.target.value })}
                />
              ) : (
                <p className="text-sm">{r.text}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {r.source_url ? (
                  <a href={r.source_url} target="_blank" rel="noreferrer" className="underline">
                    {r.source_title ?? "Source"}
                  </a>
                ) : (
                  "No source"
                )}
                {r.check_note ? ` · Check: ${r.check_note}` : ""}
              </p>
              <div className="flex gap-2 pt-1">
                {editing?.id === r.id ? (
                  <>
                    <Button size="sm" onClick={() => act(r.id, "approved", editing.text)}>
                      Save & approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    {r.status !== "approved" && (
                      <Button size="sm" onClick={() => act(r.id, "approved")}>
                        Approve
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEditing({ id: r.id, text: r.text })}>
                      Edit
                    </Button>
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="ghost" onClick={() => act(r.id, "rejected")}>
                        Reject
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {!q.data?.rows.length && <p className="p-3 text-sm text-muted-foreground">Nothing here.</p>}
        </div>
      )}
      <div className="flex gap-2 items-center text-sm">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Prev
        </Button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil((q.data?.count ?? 0) / 100))}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={(page + 1) * 100 >= (q.data?.count ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
