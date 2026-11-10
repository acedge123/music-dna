import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  criticQualityQueue,
  saveCriticQualityReview,
  criticExposureReport,
} from "@/lib/critic-quality.functions";
import { QUALITY_AXES, QUALITY_ANCHORS } from "@/musicdna/engine/critic-quality";
import { toast } from "sonner";

export function CriticQualityPanel() {
  const [page, setPage] = useState(0);
  const queue = useServerFn(criticQualityQueue);
  const q = useQuery({
    queryKey: ["critic-quality", page],
    queryFn: () => queue({ data: { page } }),
  });
  const [session, setSession] = useState<string | null>(null);
  const report = useServerFn(criticExposureReport);
  const exposure = useQuery({
    queryKey: ["critic-exposure", session],
    enabled: !!session,
    queryFn: () => {
      if (!session) throw new Error("No session selected");
      return report({ data: { sessionId: session } });
    },
  });
  return (
    <section className="space-y-6">
      <h2 className="display text-3xl">Critic QA</h2>
      <p className="text-sm text-muted-foreground">
        Independent human assessment · rubric v1 · unassessed is not zero
      </p>
      {q.isPending ? (
        <p role="status">Loading reviews…</p>
      ) : q.isError ? (
        <p role="alert">Quality queue unavailable.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-sm">
              {q.data.total} attempts · page {page + 1}
            </span>
            <Button
              variant="outline"
              disabled={(page + 1) * 25 >= q.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
          {q.data.rows.map((row) => (
            <article key={row.id} className="border-t hairline py-6 space-y-4">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {row.stage} · {new Date(row.created_at).toLocaleString()} · result{" "}
                  {row.result_version ?? "unbound"}
                </span>
                <Button variant="outline" size="sm" onClick={() => setSession(row.session_id)}>
                  Exposure
                </Button>
              </div>
              <p className="font-serif text-xl whitespace-pre-wrap">{row.output_text}</p>
              <details>
                <summary className="cursor-pointer text-sm">Frozen evidence supplied</summary>
                <pre className="mt-3 overflow-auto text-xs max-h-80">
                  {JSON.stringify(row.evidence_context, null, 2)}
                </pre>
              </details>
              <QualityForm
                id={row.id}
                reviewed={q.data.reviews.some((r) => r.attempt_id === row.id)}
              />
            </article>
          ))}
          {!q.data.rows.length && (
            <p className="text-muted-foreground">No recorded critic attempts yet.</p>
          )}
        </>
      )}
      {session && (
        <div className="border-t hairline pt-5">
          <h3 className="display text-2xl">Exposure inspection</h3>
          {exposure.isPending ? (
            <p>Loading measurements…</p>
          ) : exposure.isError ? (
            <p role="alert">Exposure measurements unavailable.</p>
          ) : (
            <pre className="overflow-auto text-xs max-h-96 mt-4">
              {JSON.stringify(exposure.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

function QualityForm({ id, reviewed }: { id: string; reviewed: boolean }) {
  const [scores, setScores] = useState<Record<(typeof QUALITY_AXES)[number], number | null>>({
    inference_accuracy: null,
    musical_specificity: null,
    prose_originality: null,
    conversational_relevance: null,
  });
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveCriticQualityReview);
  const cache = useQueryClient();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await save({ data: { attemptId: id, scores } });
          await cache.invalidateQueries({ queryKey: ["critic-quality"] });
          toast.success("Review saved.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Review unavailable");
        } finally {
          setBusy(false);
        }
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {QUALITY_AXES.map((axis) => (
        <label key={axis} className="text-sm space-y-2">
          <span className="block capitalize">{axis.replaceAll("_", " ")}</span>
          <select
            disabled={reviewed || busy}
            value={scores[axis] ?? ""}
            onChange={(e) =>
              setScores({ ...scores, [axis]: e.target.value ? Number(e.target.value) : null })
            }
            className="w-full bg-surface text-foreground border hairline rounded-sm p-2"
          >
            <option value="">Not assessed</option>
            {QUALITY_ANCHORS[axis].map((anchor, i) => (
              <option key={anchor} value={i + 1}>
                {i + 1} — {anchor}
              </option>
            ))}
          </select>
        </label>
      ))}
      <Button type="submit" disabled={reviewed || busy}>
        {reviewed ? "Review recorded" : busy ? "Saving…" : "Save independent review"}
      </Button>
    </form>
  );
}
