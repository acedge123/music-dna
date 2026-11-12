import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitFeedback } from "@/lib/musicdna.functions";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  ["accurate", "Yes"],
  ["mixed", "Somewhat"],
  ["not_accurate", "No"],
] as const;

/** "Does this archetype fit you?" — saved as reading feedback targeted at the
 *  frozen archetype, bound to the result version; it validates profiles. */
export function ArchetypeFit({
  sessionId,
  resultVersion,
  archetype,
}: {
  sessionId: string;
  resultVersion: number;
  archetype: string;
}) {
  const send = useServerFn(submitFeedback);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function pick(accuracy: (typeof OPTIONS)[number][0]) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await send({
        data: {
          session_id: sessionId,
          result_version: resultVersion,
          accuracy,
          target: `archetype:${archetype}`,
          mutation_id: `archfit:${sessionId}:${resultVersion}:${accuracy}`,
        },
      });
      setSaved(accuracy);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t hairline pt-6" aria-label="Archetype fit">
      <p className="text-sm font-medium">Does {archetype} fit you?</p>
      <div className="flex gap-2">
        {OPTIONS.map(([k, label]) => (
          <Button
            key={k}
            size="sm"
            variant={saved === k ? "default" : "outline"}
            disabled={busy || saved !== null}
            onClick={() => void pick(k)}
          >
            {label}
          </Button>
        ))}
      </div>
      {saved && <p className="text-xs text-muted-foreground">Saved. Thanks — this helps us test the archetype.</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          Couldn't save that. Please try again.
        </p>
      )}
    </section>
  );
}
