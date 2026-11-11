import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { getExploreComparison, getExploreOptions, startExplore } from "@/lib/explore.functions";
import { DECADE_LABEL, type Decade } from "@/musicdna/engine/decades";
import { AXES_LABEL } from "@/musicdna/engine/decade-labels";

export function ExploreDecades({ sessionId }: { sessionId: string }) {
  const optionsFn = useServerFn(getExploreOptions);
  const startFn = useServerFn(startExplore);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["explore-options", sessionId],
    queryFn: () => optionsFn({ data: { sessionId } }),
  });
  // One key per deliberate tap; reused if the same tap is retried after an error.
  const pendingKey = useRef<{ decade: number; key: string } | null>(null);
  if (q.isPending) {
    return (
      <p className="border-t hairline pt-8 text-sm text-muted-foreground">Loading decade runs…</p>
    );
  }
  if (q.isError || !q.data) {
    return (
      <section className="space-y-2 border-t hairline pt-8">
        <p role="alert" className="text-sm text-destructive">
          Couldn't load your decade runs.
        </p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="min-h-11 text-sm underline underline-offset-4"
        >
          Try again
        </button>
      </section>
    );
  }
  const ready = q.data.decades.filter((d) => d.ready);
  const runs = q.data.runs;
  if (ready.length === 0 && runs.length === 0) return null;
  const go = async (decade: number) => {
    setBusy(decade);
    setError(null);
    if (pendingKey.current?.decade !== decade)
      pendingKey.current = { decade, key: crypto.randomUUID() };
    try {
      const r = await startFn({ data: { sessionId, decade, startKey: pendingKey.current.key } });
      pendingKey.current = null;
      void navigate({ to: "/onboarding", search: { session: r.sessionId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that decade.");
      setBusy(null);
    }
  };
  return (
    <section className="space-y-4 border-t hairline pt-8" aria-labelledby="explore-heading">
      <p className="eyebrow">Explore your DNA</p>
      <h2 id="explore-heading" className="display text-2xl leading-tight">
        Same instincts. Different decade.
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Pick an era. Six new matchups from that decade, and the critic shows what your taste looks
        like there. Your original reading doesn't change.
      </p>
      {ready.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No decade has enough matchups right now. Your saved runs are below.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {ready.map((d) => (
          <button
            key={d.decade}
            type="button"
            disabled={busy !== null}
            onClick={() => void go(d.decade)}
            className="min-h-11 rounded-sm border hairline-strong px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {busy === d.decade ? "Opening…" : DECADE_LABEL[d.decade as Decade]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {runs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Your decade runs
          </p>
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/onboarding", search: { session: r.id } })}
                  className="min-h-11 text-sm underline underline-offset-4"
                >
                  {DECADE_LABEL[r.decade as Decade]} · {r.completed ? "read" : "in progress"} ·{" "}
                  {new Date(r.startedAt).toLocaleDateString()}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const KIND_LINE = {
  held: (a: string, era: string) => `${a} held up in the ${era}.`,
  flipped: (a: string, era: string, from?: string) => `Flipped in the ${era}: ${from} → ${a}.`,
  new: (a: string, era: string) => `The ${era} surfaced a new lean: ${a}.`,
  quiet: (a: string, era: string) =>
    `${a} went quiet in the ${era} — not enough evidence either way.`,
} as const;

export function DecadeComparison({ sessionId }: { sessionId: string }) {
  const fn = useServerFn(getExploreComparison);
  const q = useQuery({
    queryKey: ["explore-compare", sessionId],
    queryFn: () => fn({ data: { sessionId } }),
  });
  if (q.isPending)
    return <p className="text-sm text-muted-foreground">Comparing with your original reading…</p>;
  if (q.isError || !q.data)
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn't load the comparison.
      </p>
    );
  const era = DECADE_LABEL[q.data.decade as Decade];
  return (
    <section
      className="space-y-3 border-t hairline pt-6"
      aria-label="Compared with your original reading"
    >
      <p className="eyebrow">Your DNA in the {era}</p>
      {q.data.shifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Not enough repeated evidence yet to compare this run with your original reading.
        </p>
      ) : (
        <ul className="space-y-1 text-sm leading-relaxed">
          {q.data.shifts.map((s) => {
            const dir = s.decade ?? s.original;
            const label = AXES_LABEL(s.axis, dir);
            const from = s.original ? AXES_LABEL(s.axis, s.original) : undefined;
            return <li key={s.axis}>{KIND_LINE[s.kind](label, era, from)}</li>;
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Compared only against your original reading's saved song choices; that reading stays as it
        was.
      </p>
    </section>
  );
}
