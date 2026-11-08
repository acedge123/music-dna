import type { CurrentReadResult } from "@/musicdna/engine/read";
import { criticDisplayLine } from "@/lib/critic-display";

export function ReadMoment({
  read,
  compact = false,
}: {
  read: Pick<CurrentReadResult, "thesis" | "tier" | "direction" | "question"> & {
    revision?: CurrentReadResult["revision"];
  };
  compact?: boolean;
}) {
  const label =
    read.direction === "revising"
      ? "Revising the read"
      : read.direction === "contested"
        ? "A choice argues back"
        : read.tier === "read"
          ? "A tendency in these choices"
          : read.tier === "theory"
            ? "Working theory"
            : "Still listening";
  return (
    <section className="space-y-3 border-l-2 border-primary pl-4 break-words" aria-label={label}>
      {!compact && <p className="eyebrow">{label}</p>}
      {read.revision?.previous_claim && (
        <p className="text-sm text-muted-foreground">Earlier: {read.revision.previous_claim}</p>
      )}
      <p className="font-serif text-xl leading-snug md:text-2xl">
        {criticDisplayLine(read.thesis).replace(/^.*?\. (?=One choice |A tentative lean |The evidence for )/, "")}
      </p>
      {read.revision?.changed_by && (
        <p className="text-sm text-muted-foreground">
          Changed by {read.revision.changed_by.chosen} over {read.revision.changed_by.rejected}.
        </p>
      )}
      {read.question && (
        <p className="text-sm leading-relaxed text-muted-foreground">{read.question}</p>
      )}
    </section>
  );
}
