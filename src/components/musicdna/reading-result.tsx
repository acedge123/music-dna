import type { ReactNode } from "react";
import { readingExamples, type ReadingContent } from "@/lib/reading-content";
import { readingLead } from "@/lib/critic-display";

export function ReadingResult({
  content,
  children,
  label = "The read",
  showInsufficientHint = true,
  showFullSynthesis = false,
}: {
  content: ReadingContent;
  children?: ReactNode;
  label?: string;
  showInsufficientHint?: boolean;
  showFullSynthesis?: boolean;
}) {
  const examples = readingExamples(content);
  const tension = content.counter_reads[0];
  return (
    <section className="space-y-8 break-words" aria-label={label}>
      <header className="space-y-3">
        {showFullSynthesis ? (
          <>
            <h2 className="eyebrow">The reveal</h2>
            <p className="whitespace-pre-wrap font-serif text-2xl leading-relaxed md:text-3xl">
              {content.synthesis || "Not enough evidence to call it yet."}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">{label}</p>
            <h2 className="display text-4xl leading-tight md:text-5xl">
              {readingLead(content.synthesis) || "Not enough evidence to call it yet."}
            </h2>
          </>
        )}
        {content.result_version != null && (
          <p className="font-mono text-xs text-muted-foreground">
            Saved reading · version {content.result_version}
          </p>
        )}
      </header>
      {!showFullSynthesis && (examples.length > 0 ? (
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
      ) : null)}
      {!showFullSynthesis && tension && (
        <section className="space-y-2" aria-label="Unresolved evidence">
          <p className="eyebrow">Still unresolved</p>
          <p className="font-serif text-xl leading-snug">{tension.claim}</p>
          {tension.notes && (
            <p className="text-sm leading-relaxed text-muted-foreground">{tension.notes}</p>
          )}
        </section>
      )}
      {showFullSynthesis && content.reveal?.twist && (
        <section className="space-y-3" aria-label="The twist">
          <h3 className="eyebrow">The twist</h3>
          <p className="font-serif text-2xl leading-relaxed">{content.reveal.twist}</p>
          <p className="text-sm text-muted-foreground">The choice that complicated the reading.</p>
        </section>
      )}
      {showFullSynthesis && (
        <section className="space-y-3" aria-label="The challenge">
          <h3 className="eyebrow">The challenge</h3>
          <p className="font-serif text-2xl leading-relaxed">{content.reveal?.challenge || "What did I miss about what pulls you into a song?"}</p>
        </section>
      )}
      {children}
      <details id="full-reading" className="border-t hairline pt-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
          {showFullSynthesis ? "The receipts" : "See the full reading"}
        </summary>
        <div className="space-y-5 pt-3 text-sm leading-relaxed">
          {showFullSynthesis && content.reveal && <p>{content.reveal.answered} answered pairings. Skips are not evidence; each trait counts only its declared tests.</p>}
          {!showFullSynthesis && (
            <p className="whitespace-pre-wrap font-serif text-lg">
              {content.synthesis || "No supported interpretation has been saved yet."}
            </p>
          )}
          {content.audit_text && content.audit_text !== content.synthesis && (
            <p className="whitespace-pre-wrap text-muted-foreground">{content.audit_text}</p>
          )}
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
