import type { Entry } from "@/lib/interview-model";
import { ReadMoment } from "./read-moment";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { History, ThumbsUp, MessageCircle, Zap } from "lucide-react";

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
  reactionReply,
  openerSongs = [],
}: {
  entries: Entry[];
  allowReactions: boolean;
  reactedRounds: number[];
  busy: boolean;
  onReact: (kind: "thats_me" | "not_quite" | "harder") => void;
  reactionReply?: { round: number; message: string } | null;
  openerSongs?: string[];
}) {
  const latest = entries.at(-1);
  if (!latest) return null;
  return (
    <section className="space-y-7" aria-label="Your choices and the developing read">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" className="min-h-11 px-0 text-muted-foreground">
            <History /> Your interview · {entries.length} choices
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg" aria-describedby={undefined}>
          <SheetTitle className="font-serif text-3xl">The interview so far</SheetTitle>
          {openerSongs.length > 0 && (
            <ol className="mt-6 space-y-2 border-b pb-6">
              {openerSongs.map((song, i) => (
                <li key={`${i}:${song}`} className="text-sm">
                  #{i + 1} · {song}
                </li>
              ))}
            </ol>
          )}
          <div className="space-y-8 py-6">
            {entries.map((entry) => (
              <InterviewExchange key={entry.pairing.id} entry={entry} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <div aria-live="polite">
        <div className="space-y-4">
          <p className="eyebrow">The critic · after choice {latest.round}</p>
          {reactionReply?.round === latest.round ? (
            <p
              role="status"
              className="border-l-2 border-teal pl-4 font-serif text-xl leading-snug"
            >
              {reactionReply.message}
            </p>
          ) : latest.thesis ? (
            <ReadMoment compact read={{ ...latest, question: "" }} />
          ) : (
            <p className="font-serif text-xl">{latest.reaction}</p>
          )}
          {allowReactions && latest.round >= 2 && !reactedRounds.includes(latest.round) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {(
                [
                  ["thats_me", "That's me"],
                  ["not_quite", "Not quite"],
                  ["harder", "Prove it"],
                ] as const
              ).map(([kind, label]) => (
                <Button
                  key={kind}
                  type="button"
                  disabled={busy}
                  onClick={() => onReact(kind)}
                  variant="outline"
                  className="min-h-11 rounded-sm border hairline-strong px-3 py-2 text-sm disabled:opacity-50"
                >
                  {kind === "thats_me" ? (
                    <ThumbsUp />
                  ) : kind === "not_quite" ? (
                    <MessageCircle />
                  ) : (
                    <Zap />
                  )}
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
