import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitFeedback } from "@/lib/musicdna.functions";
import { getReadingFeedback } from "@/lib/reading-feedback.functions";
import {
  saveAndConfirmAccuracy,
  readingAccuracyMutationId,
  type Accuracy,
  type AccuracyAttempt,
} from "@/lib/reading-feedback";
import { withRequestDeadline } from "@/lib/request-deadline";
import { ReadingFeedbackForm } from "./reading-feedback-form";

export function ReadingFeedback({
  sessionId,
  resultVersion,
}: {
  sessionId: string;
  resultVersion: number;
}) {
  const send = useServerFn(submitFeedback),
    read = useServerFn(getReadingFeedback);
  const transport = useMemo(
    () => ({
      save: (a: AccuracyAttempt) =>
        withRequestDeadline(
          send({
            data: {
              session_id: a.sessionId,
              result_version: a.resultVersion,
              accuracy: a.accuracy,
              mutation_id: a.mutationId,
            },
          }),
          "Your rating may be saved. Retry this same rating.",
          15000,
        ),
      read: (sessionId: string, resultVersion: number) =>
        withRequestDeadline(
          read({ data: { sessionId, resultVersion } }),
          "Couldn't check your saved rating. Please retry.",
          15000,
        ),
    }),
    [send, read],
  );
  const [selection, setSelection] = useState<Accuracy | null>(null),
    [status, setStatus] = useState<
      "loading" | "ready" | "saving" | "saved" | "uncertain" | "unavailable"
    >("loading"),
    [error, setError] = useState<string | null>(null);
  const attempt = useRef<AccuracyAttempt | null>(null),
    busy = useRef(false),
    generation = useRef(0);
  const load = useCallback(async () => {
    const g = ++generation.current;
    setStatus("loading");
    setError(null);
    setSelection(null);
    attempt.current = null;
    try {
      const r = await transport.read(sessionId, resultVersion);
      if (g !== generation.current) return;
      if (
        r.sessionId !== sessionId ||
        r.resultVersion !== resultVersion ||
        (r.feedback && r.feedback.resultVersion !== resultVersion)
      )
        throw Error("Couldn't check this reading's rating.");
      setSelection(r.feedback?.accuracy ?? null);
      setStatus(r.feedback ? "saved" : "ready");
    } catch {
      if (g === generation.current) {
        setError("Couldn't load your saved rating. Please retry.");
        setStatus("unavailable");
      }
    }
  }, [sessionId, resultVersion, transport]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    void load();
    return invalidate;
  }, [load, invalidate]);
  async function save() {
    if (!selection || busy.current || !["ready", "uncertain"].includes(status)) return;
    busy.current = true;
    const g = generation.current;
    setError(null);
    setStatus("saving");
    // Keep the original operation and choice after an uncertain write; never invent another vote.
    const a = attempt.current ?? {
      sessionId,
      resultVersion,
      accuracy: selection,
      mutationId: readingAccuracyMutationId(sessionId, resultVersion),
    };
    attempt.current = a;
    try {
      const saved = await saveAndConfirmAccuracy(transport, a);
      if (g !== generation.current) return;
      setSelection(saved.accuracy);
      setStatus("saved");
    } catch {
      if (g === generation.current) {
        setError("Your rating may be saved, but we couldn't confirm it. Retry this same rating.");
        setStatus("uncertain");
      }
    } finally {
      busy.current = false;
    }
  }
  return (
    <ReadingFeedbackForm
      version={resultVersion}
      selection={selection}
      status={status}
      error={error}
      onSelect={setSelection}
      onSubmit={() => void save()}
      onReload={() => void load()}
    />
  );
}
