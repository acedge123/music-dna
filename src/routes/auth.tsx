import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MusicDNA" },
      {
        name: "description",
        content: "Sign in to keep your MusicDNA readings and critic conversations.",
      },
      { property: "og:title", content: "Sign in — MusicDNA" },
      {
        property: "og:description",
        content: "Sign in to keep your MusicDNA readings and critic conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/onboarding", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (s && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        navigate({ to: "/onboarding", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (error) throw error;
        toast.success("Check your email to confirm — or sign in if confirmation is off.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="eyebrow mb-10 inline-block">
          ← Back
        </Link>
        <h1 className="display text-4xl mb-2">
          {mode === "sign-in" ? "Continue your MusicDNA." : "Begin your MusicDNA."}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {mode === "sign-in"
            ? "Your readings persist across sessions."
            : "Email and a password. No social, no ceremony."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="eyebrow block mb-2">
              Email
            </label>
            <input
              id="auth-email"
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border hairline-strong rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="eyebrow block mb-2">
              Password
            </label>
            <input
              id="auth-password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border hairline-strong rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary text-primary-foreground rounded-sm px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "sign-in" ? "No account? Create one." : "Already have an account? Sign in."}
        </button>
      </div>
    </main>
  );
}
