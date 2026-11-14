import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { startRefine } from "@/lib/explore.functions";
import { useAuth } from "@/hooks/use-auth";
import { archetypeArt } from "./archetype-art";
import {
  relevantComparisonsLabel,
  type DnaConfidence,
  type DnaSummary,
} from "@/musicdna/engine/dna-summary";

const BAR: Record<DnaConfidence, string> = { Clear: "w-full", Leaning: "w-2/3", Early: "w-1/3" };

function laneName(lane: string) {
  return lane.replace(/[_-]/g, " ").replace(/\b(r and b|r b)\b/i, "R&B");
}

/** Identity header: a confirmed archetype only when finalize stored one. */
export function DnaIdentity({
  summary,
  signature,
}: {
  summary: DnaSummary;
  signature?: { name: string; hook: string } | null;
}) {
  return (
    <header className="space-y-2">
      <p className="eyebrow">
        Your Music DNA ·{" "}
        {summary.archetype.status === "confirmed"
          ? "Confirmed archetype"
          : summary.archetype.status === "leaning"
            ? "Leaning toward"
            : "Emerging signature"}
      </p>
      {summary.archetype.status !== "emerging" ? (
        <>
          {archetypeArt(summary.archetype.name) ? (
            <img
              src={archetypeArt(summary.archetype.name)!}
              alt={`Ink illustration for ${summary.archetype.name}`}
              className="my-3 aspect-square w-full max-w-sm rounded-sm border border-border object-cover sepia-[.15]"
            />
          ) : null}
          <h2 className="display text-4xl leading-tight md:text-5xl">{summary.archetype.name}</h2>
        </>
      ) : signature ? (
        <>
          <h2 className="display text-4xl leading-tight md:text-5xl">{signature.name}</h2>
          <p className="font-serif text-xl leading-relaxed">{signature.hook}</p>
          <p className="text-xs text-muted-foreground">
            An early signature from {summary.answered} picks, not a confirmed archetype.
          </p>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {summary.answered} picks is a first impression, not a verdict. No archetype yet — the
          evidence hasn't earned one.
        </p>
      )}
    </header>
  );
}

export function DnaEvidence({ summary }: { summary: DnaSummary }) {
  if (!summary.dimensions.length && !summary.receipts.length && !summary.undecided.length)
    return null;
  return (
    <div className="space-y-10">
      {summary.dimensions.length > 0 && (
        <section className="space-y-4" aria-label="Your dimensions">
          <div className="space-y-1">
            <h3 className="eyebrow">Your dimensions</h3>
            <p className="text-xs text-muted-foreground">
              Bars show how much evidence backs each lean: Clear, Leaning or Early.
            </p>
          </div>
          <ul className="space-y-5">
            {summary.dimensions.map((d) => (
              <li key={d.axis} className="space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-serif text-xl capitalize leading-snug">{d.label}</p>
                  <span className="shrink-0 font-mono text-xs uppercase text-muted-foreground">
                    {d.confidence}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className={`h-1.5 rounded-full bg-primary ${BAR[d.confidence]}`} />
                </div>
                <p className="text-xs text-muted-foreground">{relevantComparisonsLabel(d)}</p>
              </li>
            ))}
          </ul>
          {summary.undecided.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Still undecided: {summary.undecided.map((u) => u.label).join(" · ")}
            </p>
          )}
        </section>
      )}
      {summary.receipts.length > 0 && (
        <section className="space-y-4" aria-label="Why I think so">
          <h3 className="eyebrow">Why I think so</h3>
          <ul className="space-y-4">
            {summary.receipts.map((r) => (
              <li
                key={`${r.chosen}|${r.rejected}`}
                className={`border-l-2 pl-4 ${r.kind === "contradiction" ? "border-accent" : "border-primary"}`}
              >
                <p className="font-serif text-lg leading-snug">
                  {r.chosen} <span className="text-muted-foreground">over</span> {r.rejected}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.kind === "contradiction" ? "The pick that gives you character. " : ""}
                  {r.note}
                </p>
                {r.song_whys &&
                  (["chosen", "rejected"] as const).map((side) =>
                    r.song_whys?.[side].map((why) => (
                      <p
                        key={`${side}-${why.id}`}
                        className="mt-2 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">{r[side]}: </span>
                        {why.audible_evidence}
                      </p>
                    )),
                  )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.matchups.length > 0 && (
        <details className="border-t hairline pt-4">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
            All {summary.matchups.length} matchups
          </summary>
          <ol className="space-y-2 pt-2 text-sm">
            {summary.matchups.map((m, i) => (
              <li key={`${m.chosen}|${m.rejected}`} className="flex gap-3">
                <span className="font-mono text-xs text-primary">{i + 1}</span>
                <span>
                  <span className="font-medium">{m.chosen}</span>
                  <span className="text-muted-foreground"> ({m.chosen_artist}) over </span>
                  {m.rejected}
                  <span className="text-muted-foreground"> ({m.rejected_artist})</span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/** The invitation: honest about what's missing, user-chosen next steps. */
export function DnaInvitation({ summary, sessionId }: { summary: DnaSummary; sessionId: string }) {
  const { user } = useAuth();
  const guest = !user || user.is_anonymous;
  const hook = summary.undecided[0];
  const refineFn = useServerFn(startRefine);
  const navigate = useNavigate();
  const [askSave, setAskSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per deliberate tap, reused on retry so a double tap opens one run.
  const startKey = useRef<string | null>(null);
  const refine = async () => {
    setBusy(true);
    setError(null);
    startKey.current ??= crypto.randomUUID();
    try {
      const r = await refineFn({ data: { sessionId, startKey: startKey.current } });
      startKey.current = null;
      void navigate({ to: "/onboarding", search: { session: r.sessionId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start six more.");
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4 border-t hairline pt-8" aria-labelledby="dna-invite-heading">
      <h3 id="dna-invite-heading" className="display text-3xl leading-tight">
        That's your early signature.
      </h3>
      <p className="font-serif text-xl leading-relaxed">
        {summary.single_lane
          ? `But I've only heard you through ${laneName(summary.single_lane)}. `
          : ""}
        {hook ? `${hook.label[0].toUpperCase()}${hook.label.slice(1)}? Still a coin flip. ` : ""}
        Six more picks will test what's still open, across new genres — or hear this taste in
        another era.
      </p>
      {askSave && (
        <div
          role="dialog"
          aria-label="Save your reading"
          className="space-y-3 rounded-sm border hairline-strong p-4"
        >
          <p className="font-serif text-lg leading-snug">Save this reading first?</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Six more picks build on this reading. Your guest reading is stored, but access depends
            on this browser's guest session.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/save-reading"
              search={{ session: sessionId }}
              className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Create an account
            </Link>
            <button
              type="button"
              onClick={() => void refine()}
              disabled={busy}
              className="min-h-11 rounded-sm border hairline-strong px-5 py-3 text-sm disabled:opacity-50"
            >
              Continue as guest
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={() => (guest ? setAskSave(true) : void refine())}
          className="min-h-11 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Opening…" : "Refine My DNA — six more"}
        </button>
        <a
          href="#explore-heading"
          className="inline-flex min-h-11 items-center rounded-sm border hairline-strong px-5 py-3 text-sm"
        >
          Pick a decade
        </a>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
