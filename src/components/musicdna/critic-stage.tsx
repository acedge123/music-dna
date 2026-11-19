import { useQaQuipObservation } from "@/hooks/use-qa-quip-observation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { Hunch } from "@/musicdna/engine/critic-fillers";
import { QUIP_INTERVAL_MS, quipBudget, waitQuips } from "@/lib/critic-wait";
import { advanceQuip } from "@/lib/quip-clock";
import { PERSON_QUIP_GROUPS } from "@/lib/quip-sequences";

export function CriticStage({
  wait,
  sessionId,
  qaTelemetry = false,
  decade,
  hunch,
  skip,
  chosenTitle,
  flow,
  finalReading,
  used,
  onPairDeadline,
}: {
  wait: number;
  sessionId?: string | null;
  qaTelemetry?: boolean;
  decade: string | null;
  hunch: Hunch | null;
  skip: string | null;
  chosenTitle: string;
  flow: "per_pick" | "checkpoints";
  finalReading: boolean;
  used: Set<string>;
  onPairDeadline?: (until: number) => void;
}) {
  // Capture one wait identity and its opener. Saving a vote must not restart it.
  const [context] = useState(() => ({ wait, decade, skip, chosenTitle, used: new Set(used) }));
  const [clock, setClock] = useState(() => ({ index: 0, shownAt: Date.now() }));
  const { index } = clock;
  const [title, setTitle] = useState(chosenTitle);
  const budget = finalReading ? Infinity : quipBudget(flow, context.wait);
  const candidates = useMemo(
    () =>
      context.skip && !finalReading
        ? [context.skip]
        : waitQuips(context.wait, hunch, context.decade, budget, context.used, finalReading),
    [context, hunch, budget, finalReading],
  );
  const [queue, setQueue] = useState<string[]>(candidates);
  // Only unseen tail lines may change as the fast hunch arrives; the displayed opener never does.
  const activeHunch = useRef(hunch);
  const activeBudget = useRef(budget);
  const activeFinal = useRef(finalReading);
  useEffect(() => {
    if (
      activeHunch.current !== hunch ||
      activeBudget.current !== budget ||
      activeFinal.current !== finalReading
    ) {
      activeHunch.current = hunch;
      activeBudget.current = budget;
      activeFinal.current = finalReading;
      setQueue((current) => {
        const shown = current.slice(0, index + 1);
        // A reaction-first stage stays empty until the saved hunch arrives.
        if (current.length === 0) setClock({ index: 0, shownAt: Date.now() });
        // Replace an unseen reaction, never append a second one after an exposed reaction.
        const tailStart = shown.length && !candidates.includes(shown[0]) ? 1 : shown.length;
        return [...shown, ...candidates.slice(tailStart).filter((line) => !shown.includes(line))];
      });
    }
  }, [hunch, index, candidates, budget, finalReading]);
  useEffect(() => {
    if (chosenTitle) setTitle(chosenTitle);
  }, [chosenTitle]);
  const line = queue[index];
  useQaQuipObservation(sessionId, line, index, context.wait, finalReading, qaTelemetry);
  useEffect(() => {
    if (line) used.add(line);
    const pair = PERSON_QUIP_GROUPS.find(
      (group) => group.lines.length === 2 && group.lines[0] === line,
    );
    if (pair && queue[index + 1] === pair.lines[1])
      onPairDeadline?.(clock.shownAt + 2 * QUIP_INTERVAL_MS);
    if (PERSON_QUIP_GROUPS.some((group) => group.lines.length === 2 && group.lines[1] === line))
      onPairDeadline?.(clock.shownAt + QUIP_INTERVAL_MS);
  }, [line, used, queue, index, clock.shownAt, onPairDeadline]);
  useEffect(() => {
    if (!line) return;
    const timer = setTimeout(
      () => {
        setClock((current) => advanceQuip(current, index, Date.now(), queue.length));
      },
      Math.max(0, QUIP_INTERVAL_MS - (Date.now() - clock.shownAt)),
    );
    return () => clearTimeout(timer);
  }, [clock, index, queue.length, line]);

  return (
    <section aria-label="The Critic" className="max-w-2xl space-y-6 py-6">
      {!context.skip && title && (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          You picked · {title}
        </p>
      )}
      <div className="min-h-[7.5rem]">
        <p
          role="status"
          key={index}
          className={`font-serif text-3xl italic leading-snug ${index > 0 ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-700" : ""}`}
        >
          {line ?? (
            <LoaderCircle
              aria-label="Saving your choice"
              className="size-5 motion-safe:animate-spin"
            />
          )}
        </p>
      </div>
      {finalReading && (
        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-3 motion-safe:animate-spin" /> Writing
          your full reading…
        </p>
      )}
    </section>
  );
}
