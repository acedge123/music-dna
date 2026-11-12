import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyAuthError } from "./auth";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — MusicDNA" },
      { name: "description", content: "Choose a new password for your MusicDNA account." },
      { property: "og:title", content: "Set a new password — MusicDNA" },
      { property: "og:description", content: "Choose a new password for your MusicDNA account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && (isRecovery || s.session.user)) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      void navigate({ to: "/onboarding", replace: true });
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/auth" className="eyebrow mb-10 inline-block">
          ← Sign in
        </Link>
        <h1 className="display text-4xl mb-2">Set a new password.</h1>
        {!ready ? (
          <p role="status" className="text-sm text-muted-foreground">
            Open this page from the reset link in your email. Links expire — request a new one from
            sign in if this one doesn't work.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-8">
            <label htmlFor="new-password" className="eyebrow block mb-2">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border hairline-strong rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground rounded-sm px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
