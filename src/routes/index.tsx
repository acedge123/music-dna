import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "MusicDNA — Why do you love the songs you love?" },
      {
        name: "description",
        content:
          "Three opening songs. Up to six answered choices. Explore the patterns your picks support.",
      },
      { property: "og:title", content: "MusicDNA — Why do you love the songs you love?" },
      {
        property: "og:description",
        content: "Choose between songs. Discover the hidden patterns in your taste.",
      },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { property: "og:url", content: "/" },
      { name: "twitter:title", content: "MusicDNA — Why do you love the songs you love?" },
      {
        name: "twitter:description",
        content: "Choose between songs. Discover the hidden patterns in your taste.",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Reveal />
      <HowItWorks />
      <Proof />
      <CTA />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="border-b hairline">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-3">
          <img src="/music-dna-logo.png" alt="MusicDNA" className="h-14 w-auto sm:h-20" />
          <span className="sr-only">MusicDNA</span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            to="/"
            hash="how-it-works"
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            to="/onboarding"
            className="inline-flex min-h-11 items-center gap-2 rounded-sm border hairline-strong px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
          >
            Start
            <ArrowRight />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-28">
        <h1 className="display max-w-3xl text-5xl text-foreground sm:text-7xl md:text-[5.5rem]">
          Why do you love the songs you love?
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          The songs you choose tell a story.
          <br />
          We're just here to read it.
        </p>
        <div className="mt-10 flex flex-col items-start gap-4">
          <Link
            to="/onboarding"
            className="group inline-flex items-center gap-3 rounded-sm bg-primary px-6 py-4 text-base font-medium text-primary-foreground transition-all hover:opacity-90"
          >
            Start your MusicDNA
            <ArrowRight />
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Free · No signup required
          </p>
        </div>
      </div>
    </section>
  );
}

function Reveal() {
  const examples = [
    {
      a: "Ceremony",
      b: "Dreaming of Me",
      insight: "transformation over nostalgia",
    },
    {
      a: "A Forest",
      b: "The Killing Moon",
      insight: "movement over grandeur",
    },
  ];
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <p className="eyebrow mb-10">What a matchup can explore</p>
        <div className="space-y-px overflow-hidden rounded-sm border hairline">
          {examples.map((ex, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 bg-surface px-6 py-8 md:grid-cols-12 md:gap-8"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:col-span-4 md:pt-1">
                {ex.a} <span className="text-muted-foreground/50">vs</span> {ex.b}
              </p>
              <p className="md:col-span-8 font-serif text-2xl leading-snug md:text-3xl text-foreground">
                A matchup like this can explore <span className="text-primary">{ex.insight}</span>.
                A single choice doesn’t establish a pattern.
              </p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
          Every matchup is designed to probe a hidden dimension of your taste. Not genres. Not
          playlists. Just choices — and what they say about who you are.
        </p>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Name three songs you love",
      body: "The songs that never leave your playlist. The songs you stop skipping. The songs that still hit years later.",
    },
    {
      n: "02",
      title: "Answer up to six song choices",
      body: "We'll put great songs head-to-head and ask you to choose. Some decisions take a second. Some will make you stare at the screen and argue with yourself. That's the point.",
    },
    {
      n: "03",
      title: "See what your choices reveal",
      body: "Discover the hidden patterns in your taste. Hidden inside your choices are patterns you probably never noticed: what moves you, what you value, and why certain songs stay with you long after others fade away. The reading follows the evidence in your picks, and says when the pattern is still unclear.",
    },
  ];
  return (
    <section id="how-it-works" className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <p className="eyebrow mb-10">How it works</p>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border hairline md:grid-cols-3">
          {steps.map((s) => (
            <article key={s.n} className="flex flex-col gap-6 bg-surface p-8 md:p-10">
              <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
              <h3 className="display text-2xl text-foreground md:text-[1.75rem]">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="eyebrow mb-6">The moment it clicks</p>
            <h2 className="display text-4xl text-foreground md:text-5xl">
              "You hear songs from the bottom up."
            </h2>
          </div>
          <div className="md:col-span-6 md:col-start-7 flex flex-col gap-6">
            <p className="text-lg leading-relaxed text-muted-foreground">
              For example, a reading might find that you consistently choose songs that transform
              rather than console. You value movement over grandeur. Atmosphere over verbal
              cleverness.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              It is an interpretation of your choices. You can question it, add context, or leave it
              unresolved.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 items-end gap-10 md:grid-cols-12">
          <div className="md:col-span-8">
            <p className="eyebrow mb-6">Your music, decoded</p>
            <h2 className="display text-4xl text-foreground md:text-5xl">
              Not a playlist generator.
              <br />
              <span className="italic text-muted-foreground">A mirror for your taste.</span>
            </h2>
          </div>
          <div className="md:col-span-4 md:text-right">
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-3 rounded-sm bg-primary px-6 py-4 text-base font-medium text-primary-foreground transition-all hover:opacity-90"
            >
              Start
              <ArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-8">
        <div className="flex items-center gap-3">
          <Mark small />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            MusicDNA · v0 · 2026
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            to="/privacy"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}

function Mark({ small = false }: { small?: boolean }) {
  const size = small ? 14 : 18;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="6" cy="10" r="2" fill="currentColor" />
      <circle cx="14" cy="10" r="2" fill="currentColor" />
      <path d="M6 10c4-6 4 12 8 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 7h10m0 0L7.5 2.5M12 7l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
