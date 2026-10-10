import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicSession } from "@/lib/share.functions";

export const Route = createFileRoute("/s/$sessionId")({
  loader: async ({ params }) => {
    try {
      // The route param is named sessionId for back-compat but is interpreted
      // as a share_token first (UUIDs are only accepted for explicitly public sessions).
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
        This card was deleted, never finished, or never existed.
      </p>
      <Link to="/" className="underline">Back to MusicDNA</Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <p className="text-muted-foreground">Couldn't load: {error instanceof Error ? error.message : String(error)}</p>
    </main>
  ),
  component: SharePage,
});

function SharePage() {
  const { session, definingChoices } = Route.useLoaderData();
  const arche = session.archetype;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-mono text-xs tracking-[0.22em] uppercase">MusicDNA</Link>
          <Link
            to="/auth"
            className="text-xs font-mono uppercase tracking-[0.18em] border hairline-strong rounded-sm px-3 py-1.5 hover:bg-surface"
          >
            Take the test
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="eyebrow mb-6">A MusicDNA reading</p>

        {arche ? (
          <>
            <h1 className="display text-5xl md:text-6xl leading-[0.95] mb-3">
              {arche.name}
            </h1>
            {arche.tagline && (
              <p className="text-lg italic text-muted-foreground mb-2">{arche.tagline}</p>
            )}
            {session.lane && (
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Lane · {String(session.lane).replace(/_/g, " ")}
              </p>
            )}
          </>
        ) : (
          <h1 className="display text-4xl mb-3">Unassigned</h1>
        )}

        {session.interpretation && (
          <blockquote className="border-l-2 border-primary pl-6 mt-10 max-w-2xl">
            <p className="font-serif text-2xl leading-snug">{session.interpretation}</p>
          </blockquote>
        )}

        {definingChoices.length > 0 && (
          <section className="mt-14">
            <p className="eyebrow mb-5">The choices that gave it away</p>
            <ul className="divide-y divide-border border hairline-strong rounded-sm bg-surface">
              {(definingChoices as Array<{ chosen: string; chosenArtist: string; rejected: string; rejectedArtist: string }>).map((c, i) => (
                <li key={i} className="px-5 py-4 flex items-baseline gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-lg leading-snug">
                      <span>{c.chosen}</span>
                      <span className="text-muted-foreground"> over </span>
                      <span className="text-muted-foreground line-through decoration-1">{c.rejected}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.chosenArtist} vs {c.rejectedArtist}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-16 border-t hairline pt-10">
          <p className="eyebrow mb-3">Think you can be read this cleanly?</p>
          <h2 className="font-serif text-3xl leading-tight mb-6 max-w-xl">
            Challenge a friend. Six matchups. No genre labels. No flattery.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-sm bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              Get your own reading
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-sm border hairline-strong px-5 py-2.5 text-sm font-medium hover:bg-surface"
            >
              What is MusicDNA?
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
