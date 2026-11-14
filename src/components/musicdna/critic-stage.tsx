import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { Hunch } from "@/musicdna/engine/critic-fillers";
import { QUIP_INTERVAL_MS, quipBudget, waitQuips } from "@/lib/critic-wait";
import { advanceQuip } from "@/lib/quip-clock";

export function CriticStage({
  wait,
  decade,
  hunch,
  skip,
  chosenTitle,
  flow,
  finalReading,
  used,
}: {
  wait: number;
  decade: string | null;
  hunch: Hunch | null;
  skip: string | null;
  chosenTitle: string;
  flow: "per_pick" | "checkpoints";
  finalReading: boolean;
  used: Set<string>;
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
        : waitQuips(context.wait, hunch, context.decade, budget, context.used),
    [context, hunch, budget, finalReading],
  );
  const queue = useRef<string[]>(candidates);
  // Only unseen tail lines may change as the fast hunch arrives; the displayed opener never does.
  const activeHunch = useRef(hunch);
  const activeBudget = useRef(budget);
  useEffect(() => {
    if ((index === 0 && activeHunch.current !== hunch) || activeBudget.current !== budget) {
      activeHunch.current = hunch;
      activeBudget.current = budget;
      const shown = queue.current.slice(0, index + 1);
      queue.current = [...shown, ...candidates.filter((line) => !shown.includes(line))];
    }
  }, [hunch, index, candidates, budget]);
  useEffect(() => {
    if (chosenTitle) setTitle(chosenTitle);
  }, [chosenTitle]);
  const line = queue.current[index];
  useEffect(() => {
    if (line) used.add(line);
  }, [line, used]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setClock((current) => advanceQuip(current, index, Date.now(), queue.current.length));
    }, Math.max(0, QUIP_INTERVAL_MS - (Date.now() - clock.shownAt)));
    return () => clearTimeout(timer);
  }, [clock, index, candidates]);

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
          {line ?? "One beat…"}
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
