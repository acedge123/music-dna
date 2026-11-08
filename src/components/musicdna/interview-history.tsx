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

export function InterviewHistory({ entries }: { entries: Entry[] }) {
  if (!entries.length) return null;
  return (
    <details className="border-y hairline py-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm">
        Your choices ({entries.length})
      </summary>
      <div className="space-y-8 py-5">
        {entries.map((entry) => (
          <InterviewExchange key={entry.pairing.id} entry={entry} />
        ))}
      </div>
    </details>
  );
}
