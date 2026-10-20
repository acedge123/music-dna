import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Privacy Policy — MusicDNA" },
      {
        name: "description",
        content: "How MusicDNA collects, uses, and protects your data.",
      },
      { property: "og:title", content: "Privacy Policy — MusicDNA" },
      {
        property: "og:description",
        content: "How MusicDNA collects, uses, and protects your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <Mark />
            <span className="sr-only">MusicDNA</span>
          </Link>
          <Link
            to="/"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="eyebrow mb-4">App-maintained policy</p>
        <h1 className="display text-4xl md:text-5xl mb-8">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-12">
          Last updated: July 1, 2026. This page is maintained by MusicDNA to answer common questions
          about what data we collect and how we handle it.
        </p>

        <div className="space-y-12">
          <section>
            <h2 className="display text-2xl mb-3">What we collect</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We collect the information you give us: the songs you name during onboarding, the
              choices you make in side-by-sides, and any messages you send to the critic. If you
              create an account, we also store your email address through our authentication
              provider.
            </p>
          </section>

          <section>
            <h2 className="display text-2xl mb-3">How we use it</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your song choices and reactions power the analysis that produces your read. We do not
              sell your data. We do not use it to target ads. We may use aggregated, anonymized
              patterns to improve the quality of pairings and interpretations.
            </p>
          </section>

          <section>
            <h2 className="display text-2xl mb-3">What we share</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When you generate a share link, we create a public, anonymized snapshot of your
              session that anyone with the link can view. You control when that link is created and
              who sees it. We do not otherwise share your individual data with third parties.
            </p>
          </section>

          <section>
            <h2 className="display text-2xl mb-3">Cookies and analytics</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We use minimal first-party cookies to keep you signed in and to remember anonymous
              sessions. We may use privacy-preserving analytics to understand how the app is used in
              aggregate — never to track you individually across sites.
            </p>
          </section>

          <section>
            <h2 className="display text-2xl mb-3">Retention and deletion</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We keep your session data and profile for as long as your account exists, or until you
              delete it. Anonymous sessions may be purged after extended inactivity. You can request
              deletion of your data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="display text-2xl mb-3">Your rights</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You can access, export, or delete your data by contacting us. If you have an account,
              you can also delete your profile through the app. We aim to honor requests within 30
              days.
            </p>
          </section>

          <section>
            <h2 className="display text-2xl mb-3">Security</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We use industry-standard practices to protect your data: encrypted connections, access
              controls, and regular security reviews. No system is perfectly secure, and we
              encourage responsible disclosure of any vulnerabilities you discover.
            </p>
          </section>

          <section>
            <h2 className="display text-2xl mb-3">Contact</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Questions about this policy? Reach out at privacy@musicdna.app.
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-3">
            <Mark />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              MusicDNA · 2026
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/terms"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Mark() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="6" cy="10" r="2" fill="currentColor" />
      <circle cx="14" cy="10" r="2" fill="currentColor" />
      <path d="M6 10c4-6 4 12 8 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
