import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useReadingConversation } from "@/hooks/use-reading-conversation";
import { ReadingConversation } from "@/components/musicdna/reading-conversation";
import { ReadingResult } from "@/components/musicdna/reading-result";

const Search = z.object({
  session: z.string().uuid().optional(),
  version: z.coerce.number().int().positive().optional(),
});
export const Route = createFileRoute("/me")({
  ssr: false,
  validateSearch: (search) => Search.parse(search),
  head: () => ({
    meta: [
      { title: "MusicDNA — Continue your reading" },
      {
        name: "description",
        content: "Continue the conversation around your saved MusicDNA reading.",
      },
    ],
  }),
  component: Me,
});

function Me() {
  const { session, version } = Route.useSearch();
  const conversation = useReadingConversation(session, version);
  const { reading, loading, error } = conversation;
  const latestRevision = reading?.versions
    .filter((row) => row.source === "chat_self_report")
    .at(-1);
  return (
    <main className="mx-auto min-h-dvh max-w-2xl space-y-10 px-5 pb-16 pt-6 sm:px-6">
      <h1 className="sr-only">Continue your MusicDNA reading</h1>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b hairline pb-4">
        <Link to="/" aria-label="MusicDNA home">
          <img src="/music-dna-logo.png" alt="MusicDNA" className="h-12 w-auto" />
        </Link>
        <Link
          to="/onboarding"
          search={{ session: reading?.sessionId ?? session }}
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          ← Back to the original read
        </Link>
      </header>
      {loading ? (
        <p role="status" className="font-serif text-xl text-muted-foreground">
          Opening the saved conversation…
        </p>
      ) : reading ? (
        <>
          <ReadingResult content={reading.selected.content} label="The reading you opened" />
          <ReadingConversation
            messages={conversation.messages}
            draft={conversation.draft}
            onDraft={conversation.setDraft}
            onSend={() => void conversation.send()}
            busy={conversation.busy}
            pending={conversation.pending}
            error={error}
            hasOlder={conversation.hasOlder}
            onOlder={() => void conversation.loadOlder()}
          />
          {latestRevision && latestRevision.version !== reading.selected.version && (
            <details className="border-t hairline pt-4">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
                Updated interpretation · version {latestRevision.version}
              </summary>
              <div className="space-y-4 pt-5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Based on what you told the critic. Your original reading and its song-choice
                  evidence remain saved separately.
                </p>
                <ReadingResult content={latestRevision.content} label="From your own account" />
              </div>
            </details>
          )}
        </>
      ) : (
        <section className="space-y-4">
          <h1 className="display text-3xl">We couldn't open this reading.</h1>
          <p role="alert" className="text-sm leading-relaxed text-muted-foreground">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void conversation.reload()}
            className="min-h-11 rounded-sm border hairline-strong px-5 py-3 text-sm"
          >
            Try again
          </button>
          <Link
            to="/onboarding"
            className="ml-4 inline-flex min-h-11 items-center text-sm underline"
          >
            Start with three songs
          </Link>
        </section>
      )}
    </main>
  );
}
