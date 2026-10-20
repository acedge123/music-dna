import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicSession } from "@/lib/share.functions";
import { ReadingResult } from "@/components/musicdna/reading-result";
import { parseReadingContent } from "@/lib/reading-content";

export const Route = createFileRoute("/s/$sessionId")({
  loader: async ({ params }) => {
    try {
      // The route param is historical; the shared service enforces explicit
      // publication and the frozen version before returning public content.
      return await getPublicSession({ data: { token: params.sessionId } });
    } catch (e) {
      throw notFound({ data: { message: (e as Error).message } });
    }
  },
  head: ({ loaderData }) => {
    const arche = loaderData?.session?.archetype;
    const name = arche?.name ?? "A MusicDNA reading";
    const tagline = arche?.tagline ?? "Music as a mirror.";
    const interp = loaderData?.session?.interpretation ?? "";
    const desc = (interp || tagline).slice(0, 220);
    const title = `${name} — MusicDNA`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="display text-4xl mb-4">No reading here.</h1>
      <p className="text-muted-foreground mb-8">
        This reading is unavailable. Its owner may have stopped sharing it.
      </p>
      <Link to="/" className="underline">
        Back to MusicDNA
      </Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <p className="text-muted-foreground">
        Couldn't load: {error instanceof Error ? error.message : String(error)}
      </p>
    </main>
  ),
  component: SharePage,
});

function SharePage() {
  const { session, definingChoices } = Route.useLoaderData();
  const saved = "content" in session ? parseReadingContent(session.content) : null;
  const content = saved ?? {
    synthesis: session.interpretation ?? "Not enough evidence to call it yet.",
    kept_choosing: [],
    counter_reads: [],
  };
  const version = "result_version" in session ? session.result_version : undefined;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-mono text-xs tracking-[0.22em] uppercase">
            MusicDNA
          </Link>
          <Link
            to="/onboarding"
            className="inline-flex min-h-11 items-center text-xs font-mono uppercase tracking-[0.18em] border hairline-strong rounded-sm px-3 py-1.5 hover:bg-surface"
          >
            Start a reading
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="sr-only">A shared MusicDNA reading</h1>
        <ReadingResult
          content={{ ...content, result_version: version }}
          label="A shared MusicDNA reading"
          showInsufficientHint={saved !== null}
        />
        {!saved && definingChoices.length > 0 && (
          <section className="mt-8 space-y-3">
            <p className="eyebrow">Choices behind this reading</p>
            <ul className="space-y-3">
              {definingChoices.slice(0, 2).map((choice, index) => (
                <li key={index} className="border-l-2 border-primary pl-4 font-serif text-xl">
                  {choice.chosen} over {choice.rejected}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="mt-16 border-t hairline pt-10">
          <p className="eyebrow mb-3">Your choices can tell a different story.</p>
          <h2 className="font-serif text-3xl leading-tight mb-6 max-w-xl">
            Three songs. Up to six answered choices. A reading of your own.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/onboarding"
              className="inline-flex min-h-11 items-center justify-center rounded-sm bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              Get your own reading
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center rounded-sm border hairline-strong px-5 py-2.5 text-sm font-medium hover:bg-surface"
            >
              What is MusicDNA?
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
