import type { ReactNode } from "react";
import { readingExamples, type ReadingContent } from "@/lib/reading-content";

export function ReadingResult({
  content,
  children,
  label = "The read",
  showInsufficientHint = true,
}: {
  content: ReadingContent;
  children?: ReactNode;
  label?: string;
  showInsufficientHint?: boolean;
}) {
  const examples = readingExamples(content);
  const tension = content.counter_reads[0];
  return (
    <section className="space-y-8 break-words" aria-label={label}>
      <header className="space-y-3">
        <p className="eyebrow">{label}</p>
        <h2 className="display text-3xl leading-tight md:text-4xl">
          {content.synthesis || "Not enough evidence to call it yet."}
        </h2>
        {content.result_version != null && (
          <p className="font-mono text-xs text-muted-foreground">
            Saved reading · version {content.result_version}
          </p>
        )}
      </header>
      {examples.length > 0 ? (
        <section className="space-y-3" aria-label="Supporting choices">
          <p className="eyebrow">The choices behind it</p>
          <ul className="space-y-3">
            {examples.map((example) => (
              <li
                key={example}
                className="border-l-2 border-primary pl-4 font-serif text-xl leading-snug"
              >
                {example}
              </li>
            ))}
          </ul>
        </section>
      ) : showInsufficientHint ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          These choices don't yet support a clear tendency. The reading can stay open.
        </p>
      ) : null}
      {tension && (
        <section className="space-y-2" aria-label="Unresolved evidence">
          <p className="eyebrow">Still unresolved</p>
          <p className="font-serif text-xl leading-snug">{tension.claim}</p>
          {tension.notes && (
            <p className="text-sm leading-relaxed text-muted-foreground">{tension.notes}</p>
          )}
        </section>
      )}
      {children}
      <details className="border-t hairline pt-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
          See the full reading
        </summary>
        <div className="space-y-5 pt-3 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap font-serif text-lg">
            {content.synthesis || "No supported interpretation has been saved yet."}
          </p>
          {content.kept_choosing.map((claim) => (
            <section key={claim.tradeoff} className="space-y-2">
              <h3 className="font-medium">{claim.tradeoff}</h3>
              <p className="text-muted-foreground">
                {claim.supporting} supporting choices across {claim.tested} tests.
              </p>
              <ul className="space-y-1">
                {claim.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </section>
          ))}
          {content.counter_reads.map((counter) => (
            <p key={counter.claim}>
              <strong>{counter.claim}</strong> {counter.notes}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
