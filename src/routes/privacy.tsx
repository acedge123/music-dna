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

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  { id: "what-we-collect", title: "What we collect", body: ["We collect the information you give us: the songs you name during onboarding, the choices you make in side-by-sides, and any messages you send to the critic. If you create an account, we also store your email address through our authentication provider."] },
  { id: "how-we-use-it", title: "How we use it", body: ["Your song choices and reactions power the analysis that produces your read. We do not sell your data. We do not use it to target ads. We may use aggregated, anonymized patterns to improve the quality of pairings and interpretations.", "If you separately authorize a testing or learning program, limited feedback and choice evidence can also be processed by our quality-review tools and AI providers to evaluate the service. Creating an account or publishing a share link does not by itself enroll you in that program."] },
  { id: "what-we-share", title: "What we share", body: ["We use service providers to operate MusicDNA, including Supabase for authentication and data storage, Vercel for production hosting, and OpenAI for AI-generated Critic responses. Preview environments may instead use Lovable's AI gateway and its configured model providers.", "To generate and check a response, our AI providers can receive the relevant song names, choice evidence, reactions, reading context, and chat messages. This processing is part of providing the Critic, even when you have not published a share link. Your messages and the context sent for a response may contain personal information.", "When you choose to publish a share link, we create a public snapshot of the selected reading that anyone with the link can view. Your account email is not displayed on that page, but the reading's text may contain details you chose to discuss. You control publication and can revoke the link. Publishing a reading and service-provider processing are separate actions."] },
  { id: "cookies-and-analytics", title: "Cookies and analytics", body: ["We use minimal first-party cookies to keep you signed in and to remember anonymous sessions. We may use privacy-preserving analytics to understand how the app is used in aggregate — never to track you individually across sites."] },
  { id: "retention-and-deletion", title: "Retention and deletion", body: ["We keep your session data and profile for as long as your account exists, or until you delete it. Anonymous sessions may be purged after extended inactivity. You can request deletion of your data at any time by contacting us."] },
  { id: "your-rights", title: "Your rights", body: ["You can access, export, or delete your data by contacting us. If you have an account, you can also delete your profile through the app. We aim to honor requests within 30 days."] },
  { id: "security", title: "Security", body: ["We use industry-standard practices to protect your data: encrypted connections, access controls, and regular security reviews. No system is perfectly secure, and we encourage responsible disclosure of any vulnerabilities you discover."] },
  { id: "contact", title: "Contact", body: ["Questions about this policy? Reach out at privacy@musicdna.app."] },
];

// Plain restatements of commitments made in the sections below.
const SHORT_VERSION = [
  "We do not sell your data.",
  "We do not use it to target ads.",
  "You control publication and can revoke the link.",
];

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2 text-foreground">
            <Mark />
            <span className="font-serif text-xl leading-none">MusicDNA</span>
          </Link>
          <Link
            to="/"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back
          </Link>
        </div>
      </header>

      <section className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 pb-14 pt-20 md:pt-28">
          <p className="eyebrow mb-6 tracking-[0.22em] text-primary">The fine print · Privacy</p>
          <h1 className="display text-6xl md:text-8xl">
            Your taste.
            <br />
            <span className="italic text-primary">Your data.</span>
          </h1>
          <div className="mt-10 h-1 w-24 bg-primary" aria-hidden="true" />
          <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-muted-foreground md:text-2xl">
            Last updated: November 11, 2026. This page is maintained by MusicDNA to answer common
            questions about what data we collect and how we handle it.
          </p>
        </div>
      </section>

      <section className="border-b hairline bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 md:grid-cols-[12rem_1fr]">
          <p className="eyebrow tracking-[0.22em]">The short version</p>
          <ul className="grid gap-4 md:grid-cols-3">
            {SHORT_VERSION.map((line) => (
              <li key={line} className="border-l-2 border-primary pl-4 font-serif text-2xl leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[12rem_1fr]">
        <nav aria-label="On this page" className="hidden md:block">
          <ol className="sticky top-8 space-y-2">
            {SECTIONS.map((sec, i) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  className="flex gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary"
                >
                  <span className="text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {sec.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="divide-y hairline">
          {SECTIONS.map((sec, i) => (
            <section key={sec.id} id={sec.id} className="scroll-mt-8 py-10 first:pt-0">
              <div className="flex items-baseline gap-5">
                <span className="font-mono text-sm text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="display text-4xl md:text-5xl">{sec.title}</h2>
              </div>
              <div className="mt-6 max-w-2xl space-y-4 md:pl-11">
                {sec.body.map((para) => (
                  <p key={para.slice(0, 40)} className="text-base leading-relaxed text-muted-foreground">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-3">
            <Mark />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              MusicDNA · 2026
            </span>
          </div>
          <Link
            to="/terms"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Terms
          </Link>
        </div>
      </footer>
    </main>
  );
}

function Mark() {
  return (
    <svg width={18} height={18} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-primary">
      <circle cx="6" cy="10" r="2" fill="currentColor" />
      <circle cx="14" cy="10" r="2" fill="currentColor" />
      <path d="M6 10c4-6 4 12 8 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
