import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "forgot" } => ({
    mode: search.mode === "forgot" ? "forgot" : undefined,
  }),
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
  const { mode: requestedMode } = Route.useSearch();
  const { user, loading } = useAuth();
  const signedIn = !!user && !user.is_anonymous;
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">(requestedMode ?? "sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && signedIn && mode !== "forgot")
      void navigate({ to: "/onboarding", replace: true });
  }, [navigate, loading, signedIn, mode]);

  useEffect(() => {
    if (requestedMode === "forgot") setMode("forgot");
  }, [requestedMode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If that email has an account, a reset link is on its way.");
        setMode("sign-in");
        return;
      }
      if (mode === "sign-up") {
        if (user?.is_anonymous) {
          await navigate({ to: "/save-reading" });
          return;
        }
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
      toast.error(friendlyAuthError(err));
      if ((err as { code?: string })?.code === "user_already_exists") setMode("sign-in");
    } finally {
      setBusy(false);
    }
  }

  if (loading || (signedIn && mode !== "forgot"))
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <p role="status" className="text-muted-foreground">
          Opening your account…
        </p>
      </main>
    );

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="eyebrow mb-10 inline-block">
          ← Back
        </Link>
        <h1 className="display text-4xl mb-2">
          {mode === "sign-in"
            ? "Continue your MusicDNA."
            : mode === "forgot"
              ? "Reset your password."
              : "Begin your MusicDNA."}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {mode === "forgot"
            ? "We'll email you a link to set a new one."
            : mode === "sign-in"
              ? "Your readings persist across sessions."
              : "Email and a password. No social, no ceremony."}
        </p>
        {user?.is_anonymous && (
          <div className="mb-6 space-y-3 border border-border rounded p-4 text-sm">
            <p>Signing in to a different account won't move your guest reading. Keep your guest session to preserve access.</p>
            <Link to="/save-reading" className="underline">Keep my guest readings with a new account</Link>
          </div>
        )}
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
          {mode !== "forgot" && (
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
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary text-primary-foreground rounded-sm px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "…"
              : mode === "sign-in"
                ? "Sign in"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Create account"}
          </button>
        </form>
        {mode === "sign-in" && (
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="mt-6 mr-6 text-xs text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </button>
        )}
        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "sign-in" ? "No account? Create one." : "Already have an account? Sign in."}
        </button>
      </div>
    </main>
  );
}
