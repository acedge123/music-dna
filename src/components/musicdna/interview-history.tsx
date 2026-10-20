import type { Entry } from "@/lib/interview-model";
import { ReadMoment } from "./read-moment";

export function InterviewExchange({
  entry,
  children,
}: {
  entry: Entry;
  children?: React.ReactNode;
}) {
  return (
    <article className="space-y-4 break-words" aria-label={`Choice ${entry.round}`}>
      <p className="eyebrow">Choice {entry.round}</p>
      <div className="space-y-2">
        {entry.reaction
          .split("\n")
          .filter(Boolean)
          .map((line, index) => (
            <p
              key={index}
              className={
                index === 0
                  ? "display text-2xl leading-tight md:text-3xl"
                  : "font-serif text-lg leading-snug text-muted-foreground"
              }
            >
              {line}
            </p>
          ))}
      </div>
      {entry.thesis && (
        <ReadMoment
          read={{
            thesis: entry.thesis,
            tier: entry.tier,
            direction: entry.direction,
            question: entry.question,
            revision: entry.revision,
          }}
        />
      )}
      {children}
    </article>
  );
}

export function InterviewHistory({
  entries,
  allowReactions,
  reactedRounds,
  busy,
  onReact,
}: {
  entries: Entry[];
  allowReactions: boolean;
  reactedRounds: number[];
  busy: boolean;
  onReact: (kind: "thats_me" | "not_quite" | "harder") => void;
}) {
  const latest = entries.at(-1);
  if (!latest) return null;
  return (
    <section className="space-y-7" aria-label="Your choices and the developing read">
      {entries.length > 1 && (
        <details className="border-y hairline py-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm">
            Earlier choices ({entries.length - 1})
          </summary>
          <div className="space-y-8 py-5">
            {entries.slice(0, -1).map((entry) => (
              <InterviewExchange key={entry.pairing.id} entry={entry} />
            ))}
          </div>
        </details>
      )}
      <div aria-live="polite">
        <InterviewExchange entry={latest}>
          {allowReactions && latest.round >= 2 && !reactedRounds.includes(latest.round) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {(
                [
                  ["thats_me", "That's me"],
                  ["not_quite", "Not quite"],
                  ["harder", "Give me a harder one"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  disabled={busy}
                  onClick={() => onReact(kind)}
                  className="min-h-11 rounded-sm border hairline-strong px-3 py-2 text-sm disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </InterviewExchange>
      </div>
    </section>
  );
}
