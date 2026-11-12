import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
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
export function DnaIdentity({ summary }: { summary: DnaSummary }) {
  return (
    <header className="space-y-2">
      <p className="eyebrow">
        Your Music DNA ·{" "}
        {summary.archetype.status === "confirmed" ? "Confirmed archetype" : "Emerging signature"}
      </p>
      {summary.archetype.status === "confirmed" ? (
        <h2 className="display text-4xl leading-tight md:text-5xl">{summary.archetype.name}</h2>
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
          <h3 className="eyebrow">Your dimensions</h3>
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The invitation: honest about what's missing, user-chosen next steps. */
export function DnaInvitation({ summary }: { summary: DnaSummary }) {
  const { user } = useAuth();
  const guest = !user || user.is_anonymous;
  const hook = summary.undecided[0];
  return (
    <section className="space-y-4 border-t hairline pt-8" aria-labelledby="dna-invite-heading">
      <h3 id="dna-invite-heading" className="display text-3xl leading-tight">
        That's your early signature.
      </h3>
      <p className="font-serif text-xl leading-relaxed">
        {summary.single_lane
          ? `But I've only heard you through ${laneName(summary.single_lane)}. `
          : ""}
        {hook
          ? `${hook.label[0].toUpperCase()}${hook.label.slice(1)}? Still a coin flip. `
          : ""}
        Want to find out what this taste sounds like in another era?
      </p>
      {guest && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Save your readings first:{" "}
          <Link to="/auth" className="underline underline-offset-4">
            create an account
          </Link>{" "}
          so your next runs build one profile.
        </p>
      )}
      <a
        href="#explore-heading"
        className="inline-flex min-h-11 items-center rounded-sm border hairline-strong px-5 py-3 text-sm"
      >
        Pick a decade
      </a>
    </section>
  );
}
