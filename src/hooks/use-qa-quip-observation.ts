import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { qaQuipTelemetryAllowed, recordQaQuip } from "@/lib/mcp/quip.functions";
/** Prospective owner-QA only. Never changes pacing, awaits telemetry, or retries a model call. */
export function useQaQuipObservation(
  sessionId: string | null | undefined,
  line: string | undefined,
  sequence: number,
  answered: number,
  finalReading: boolean,
  enabled = false,
) {
  const { user } = useAuth(),
    allowedFn = useServerFn(qaQuipTelemetryAllowed),
    record = useServerFn(recordQaQuip);
  const report = useRef(record);
  report.current = record;
  const [wait] = useState(() => ({ id: crypto.randomUUID(), started: performance.now() }));
  const q = useQuery({
    queryKey: ["qa-quip-telemetry", sessionId, user?.id],
    queryFn: () => allowedFn({ data: { session_id: sessionId! } }),
    enabled: enabled && !!sessionId && !!user && !user.is_anonymous,
    retry: false,
    staleTime: 60000,
  });
  useEffect(() => {
    if (
      !enabled ||
      !q.data?.allowed ||
      !sessionId ||
      !line ||
      document.visibilityState !== "visible"
    )
      return;
    let shown: number | undefined,
      shownAt = "",
      delay = 0,
      finished = false;
    const frame = requestAnimationFrame(() => {
      if (document.visibilityState !== "visible") return;
      shown = performance.now();
      shownAt = new Date().toISOString();
      delay = Math.round(shown - wait.started);
    });
    const finish = (reason: "changed_or_unmounted" | "document_hidden") => {
      if (finished || shown === undefined) return;
      finished = true;
      void report
        .current({
          data: {
            id: crypto.randomUUID(),
            session_id: sessionId,
            wait_id: wait.id,
            line,
            sequence,
            answered,
            phase: finalReading ? "final_writing" : "post_pick_wait",
            shown_at: shownAt,
            duration_ms: Math.min(3600000, Math.max(0, Math.round(performance.now() - shown))),
            since_wait_ms: Math.min(3600000, Math.max(0, delay)),
            ended_reason: reason,
          },
        })
        .catch(() => undefined);
    };
    const hidden = () => {
      if (document.visibilityState !== "visible") finish("document_hidden");
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", hidden);
      finish("changed_or_unmounted");
    };
  }, [enabled, q.data?.allowed, sessionId, line, sequence, answered, finalReading, wait]);
}
