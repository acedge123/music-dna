import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listSongIntake, reviewSongIntake, scoreSongIntake } from "@/lib/song-intake.functions";
import { canPromoteIntake, type IntakeDraft } from "@/musicdna/adapters/song-intake";
import { DIMS, poleScoreLabel } from "@/musicdna/engine/axes";

export function SongIntakePanel() {
  const [status, setStatus] = useState<
    | "all"
    | "unmatched"
    | "matched"
    | "pending_review"
    | "scoring"
    | "scoring_failed"
    | "rejected"
    | "promoted"
  >("unmatched");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const list = useServerFn(listSongIntake),
    score = useServerFn(scoreSongIntake),
    review = useServerFn(reviewSongIntake);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "intake", status, page, search],
    queryFn: () => list({ data: { status, page, search } }),
  });
  async function act(
    id: string,
    action: "score" | "promote" | "reject",
    draft: IntakeDraft | null,
  ) {
    if (
      action === "promote" &&
      !window.confirm(
        "Approve this recording, year, lane and all ten AI scores? New songs will remain inactive until pairing review.",
      )
    )
      return;
    if (
      action === "score" &&
      !window.confirm("Generate one AI scoring proposal for this song? This uses AI credits.")
    )
      return;
    setBusy(id);
    try {
      if (action === "score") await score({ data: { id } });
      else if (draft) await review({ data: { id, action, draft } });
      else return;
      toast.success(
        action === "score"
          ? "AI draft ready for review."
          : action === "promote"
            ? "Catalog song approved. New songs remain inactive."
            : "Draft rejected.",
      );
      await qc.invalidateQueries({ queryKey: ["admin", "intake"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update intake.");
      await qc.invalidateQueries({ queryKey: ["admin", "intake"] });
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-2xl mr-auto">Song Intake</h2>
        <input
          aria-label="Search song intake"
          placeholder="Search song titles"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="border hairline rounded-sm bg-background px-3 py-2 text-sm"
        />
        <select
          aria-label="Intake status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(0);
          }}
          className="border hairline rounded-sm bg-background px-3 py-2 text-sm"
        >
          <option value="unmatched">Unmatched</option>
          <option value="pending_review">Ready to review</option>
          <option value="matched">Already in catalog</option>
          <option value="promoted">Approved</option>
          <option value="scoring_failed">Scoring failed</option>
          <option value="scoring">Scoring</option>
          <option value="rejected">Rejected</option>
          <option value="all">All songs</option>
        </select>
      </div>
      <p className="text-sm text-muted-foreground">
        {q.data?.count ?? "…"} songs · Most requested first
      </p>
      {q.isError ? (
        <div role="alert" className="text-sm text-destructive">
          Could not load intake.{" "}
          <Button variant="outline" onClick={() => void q.refetch()}>
            Retry
          </Button>
        </div>
      ) : q.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading intake…
        </p>
      ) : !q.data.rows.length ? (
        <p className="text-sm text-muted-foreground">No songs in this queue yet.</p>
      ) : (
        <ul className="space-y-3">
          {q.data.rows.map((r) => (
            <li key={r.id} className="border hairline rounded-sm p-4 space-y-3">
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <h3 className="font-medium">{r.cleaned_title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {r.cleaned_artist || "Artist not supplied"}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {r.submission_count} requests · {r.status.replaceAll("_", " ")}
                </span>
              </div>
              {r.ai_draft && (
                <>
                  <p className="text-sm font-medium">
                    {r.ai_draft.title} — {r.ai_draft.artist} ·{" "}
                    {r.ai_draft.year ?? "Year unverified"} · {r.ai_draft.lane.replaceAll("_", " ")}
                  </p>
                  <p className="text-sm">{r.ai_draft.rationale}</p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {DIMS.map((axis) => (
                      <div
                        key={axis}
                        className="flex justify-between text-xs border-b hairline py-1 gap-2"
                      >
                        <dt className="capitalize">{axis}</dt>
                        <dd>{poleScoreLabel(axis, r.ai_draft?.scores[axis] ?? 50)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {r.scoring_model} · AI proposal
                    {!canPromoteIntake(r.ai_draft)
                      ? " · Recording or year needs verification; reject and retry with a precise submission."
                      : ""}
                  </p>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                {["unmatched", "scoring_failed", "rejected"].includes(r.status) && (
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void act(r.id, "score", null)}
                  >
                    <Sparkles />
                    {busy === r.id ? "Scoring…" : "AI score"}
                  </Button>
                )}
                {r.status === "pending_review" && r.ai_draft && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy !== null || !canPromoteIntake(r.ai_draft)}
                      onClick={() => void act(r.id, "promote", r.ai_draft)}
                    >
                      <Check />
                      Approve to catalog
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void act(r.id, "reject", r.ai_draft)}
                    >
                      <X />
                      Reject
                    </Button>
                  </>
                )}
                {r.status === "scoring" && (
                  <span role="status" className="text-sm text-muted-foreground">
                    Scoring in progress. Refresh to check the saved draft.
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="outline"
          aria-label="Previous intake page"
          title="Previous page"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm">
          Page {page + 1} of {Math.max(1, Math.ceil((q.data?.count ?? 0) / 50))}
        </span>
        <Button
          size="icon"
          variant="outline"
          aria-label="Next intake page"
          title="Next page"
          disabled={(page + 1) * 50 >= (q.data?.count ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void q.refetch()}>
          Refresh
        </Button>
      </div>
    </section>
  );
}
