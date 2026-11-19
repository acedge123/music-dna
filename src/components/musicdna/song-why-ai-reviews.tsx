import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { listSavedWhyAiReviews } from "@/lib/mcp/admin.functions";
import type { WhyAiReview } from "@/lib/mcp/why-ai-review";

export function WhyAiReviewCard({ review: r }: { review: WhyAiReview }) {
  const s = r.snapshot,
    finding = r.result;
  return (
    <article className="space-y-2 border hairline rounded-sm p-4">
      <p className="font-medium">
        {s.song.title} — {s.song.artist} · {s.song.year ?? "year unavailable"} · {s.song.genre}
      </p>
      <p className="text-sm">
        {s.explanation.axis} · original score {s.explanation.score_at_write}/100 · current score at
        request {s.attribute.current_score ?? "unavailable"}/100
      </p>
      <p className="text-sm">
        Axis: {String(s.attribute.definition ?? "unavailable")} · {String(s.attribute.low_pole)} (0)
        → {String(s.attribute.high_pole)} (100)
      </p>
      <p className="text-sm">Original Hear: {s.explanation.audible_evidence}</p>
      <p className="text-sm">Original Means: {s.explanation.interpretation}</p>
      <p className="text-xs text-muted-foreground">
        Historical reviewer: {s.explanation.review_note ?? "not recorded"} · original status{" "}
        {s.explanation.status}
      </p>
      {r.stale_explanation && (
        <p className="text-sm font-medium">
          Stale explanation: its written score already differed at request time.
        </p>
      )}
      {r.stale_result && (
        <p className="text-sm font-medium">
          Stale result: source version or context changed. This review belongs only to the snapshot
          below.
        </p>
      )}
      <p className="text-sm">
        New AI review: {r.display_state} · {r.created_at}
      </p>
      {finding ? (
        <div className="border-l-2 pl-3 space-y-1">
          <p className="font-medium">
            {finding.verdict} · {finding.score_disputed ? "score disputed" : "score not disputed"}
          </p>
          <p className="text-sm">{finding.note}</p>
          <p className="text-sm">
            Suggested score:{" "}
            {finding.suggested_score === null
              ? "unavailable / no justified replacement"
              : `${finding.suggested_score}/100`}
          </p>
          <p className="text-sm">Reason: {finding.reason}</p>
        </div>
      ) : (
        <p className="text-sm">
          No completed findings.{" "}
          {r.error_code ?? "Use this request ID to read its status; do not automatically resubmit."}
        </p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary>Identity and audit provenance</summary>
        <p>
          Request {r.id} · explanation {s.explanation.id}
        </p>
        <p>Explanation version {r.explanation_version}</p>
        <p>Context version {r.context_version}</p>
        <p>
          Policy {r.policy_version} · configured reviewer{" "}
          {String(r.configured_routing?.critic_reviewer ?? "unavailable")}
        </p>
        <p>
          Measured model {String(r.measurement?.model ?? "unavailable")} · input tokens{" "}
          {String(r.measurement?.input_tokens ?? "unavailable")} · output tokens{" "}
          {String(r.measurement?.output_tokens ?? "unavailable")}
        </p>
        <p>{String(s.recording_identity.verification)} No listening verification is implied.</p>
      </details>
      <p className="text-xs text-muted-foreground">
        Advisory audit recorded now, not the original approval. Approved explanations remain usable.
        Score correction requires a separate explicit human action.
      </p>
    </article>
  );
}
export function SongWhyAiReviews() {
  const [loaded, setLoaded] = useState(false),
    [cursor, setCursor] = useState<string>();
  const list = useServerFn(listSavedWhyAiReviews);
  const q = useQuery({
    queryKey: ["admin", "whys", "ai-reviews", cursor],
    queryFn: () => list({ data: { cursor } }),
    enabled: loaded,
    retry: false,
  });
  return (
    <section className="space-y-3">
      <h3 className="text-base font-medium">Saved AI re-reviews</h3>
      <p className="text-sm text-muted-foreground">
        Separate from the rule-based audit and historical reviewer. Loading results makes no AI
        call.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={q.isFetching}
        onClick={() => {
          setLoaded(true);
          if (loaded) void q.refetch();
        }}
      >
        Load saved reviews
      </Button>
      {q.isFetching && <p className="text-sm">Loading…</p>}
      {q.isError && (
        <p className="text-sm">Saved reviews are unavailable. No successful check is implied.</p>
      )}
      {q.data && (
        <>
          {q.data.reviews.length === 0 && (
            <p className="text-sm">No saved AI reviews on this page.</p>
          )}
          {q.data.reviews.map((r) => (
            <WhyAiReviewCard key={r.id} review={r} />
          ))}
          <div className="flex gap-2">
            {cursor && (
              <Button size="sm" variant="outline" onClick={() => setCursor(undefined)}>
                First page
              </Button>
            )}
            {q.data.next_cursor && (
              <Button size="sm" variant="outline" onClick={() => setCursor(q.data.next_cursor!)}>
                Next page
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
