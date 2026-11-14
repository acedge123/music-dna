import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resumeLatestSession } from "@/lib/resume.functions";
import { verifiedUpgrade } from "@/lib/guest-upgrade";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export function GuestSaveForm({ sessionId }: { sessionId?: string }) {
  const { user } = useAuth();
  const restore = useServerFn(resumeLatestSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "confirm" | "password" | "saved">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `musicdna:upgrade:${sessionId ?? "account"}`;
  useEffect(() => {
    const source = sessionStorage.getItem(key);
    if (source) setStep(verifiedUpgrade(user ?? null, source) ? "password" : "confirm");
  }, [key, user]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user)
        throw new Error(
          "Your guest session is unavailable. Return to the reading in its original browser.",
        );
      if (step === "email") {
        if (!data.user.is_anonymous)
          throw new Error(
            "This account cannot claim a different guest reading. Return to the original guest session.",
          );
        if (sessionId) await restore({ data: { sessionId } });
        sessionStorage.setItem(key, data.user.id);
        const redirect = `${window.location.origin}/save-reading${sessionId ? `?session=${sessionId}` : ""}`;
        const { error: updateError } = await supabase.auth.updateUser(
          { email },
          { emailRedirectTo: redirect },
        );
        if (updateError) throw updateError;
        setStep("confirm");
      } else {
        const original = sessionStorage.getItem(key);
        if (!original || !verifiedUpgrade(data.user, original))
          throw new Error(
            "Confirm your email in this browser first. Your reading is still private.",
          );
        if (step === "confirm") {
          setStep("password");
          return;
        }
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;
        const { data: checked, error: checkError } = await supabase.auth.getUser();
        if (checkError || !verifiedUpgrade(checked.user, original))
          throw new Error("Could not confirm the saved account. Please retry.");
        const reading = await restore({ data: sessionId ? { sessionId } : {} });
        if (sessionId && (!reading || reading.sessionId !== sessionId || !reading.completed))
          throw new Error("Could not confirm this reading in your account. Please retry.");
        sessionStorage.removeItem(key);
        setStep("saved");
      }
    } catch (err) {
      setError(
        (err as { code?: string })?.code
          ? friendlyAuthError(err)
          : err instanceof Error
            ? err.message
            : "Could not save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (step === "saved")
    return (
      <div className="space-y-4">
        <p role="status" className="font-serif text-xl">
          Saved to your account.
        </p>
        <Button asChild>
          <Link to="/onboarding" search={{ session: sessionId }}>
            Back to my reading
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Your reading is private and stored. Keep access across devices by turning this guest session
        into an account.
      </p>
      <form onSubmit={submit} className="space-y-4">
        {step === "email" && (
          <div className="space-y-2">
            <label htmlFor="save-email" className="text-sm">
              Email
            </label>
            <Input
              id="save-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}
        {step === "confirm" && (
          <p role="status" className="text-sm">
            Check your email and open the confirmation link in this browser, then continue. Nothing
            has been transferred or published.
          </p>
        )}
        {step === "password" && (
          <div className="space-y-2">
            <label htmlFor="save-password" className="text-sm">
              Set your password
            </label>
            <Input
              id="save-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy
            ? "Checking…"
            : step === "email"
              ? "Send confirmation email"
              : step === "confirm"
                ? "I've confirmed my email"
                : "Save to my account"}
        </Button>
      </form>
      <details className="border-t border-border pt-3 text-sm">
        <summary className="cursor-pointer py-2">Already have an account?</summary>
        <p className="text-muted-foreground pt-2">
          Saving a guest reading to an existing account isn't available yet. Don't sign out of this
          guest session to save it; keep this reading's address instead.
        </p>
      </details>
    </div>
  );
}

export function GuestReadingSave({ sessionId }: { sessionId: string }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (
      !loading &&
      user?.is_anonymous &&
      !sessionStorage.getItem(`musicdna:save-prompt:${sessionId}`)
    )
      setOpen(true);
  }, [loading, user, sessionId]);
  if (loading || !user?.is_anonymous) return null;
  const dismiss = (value: boolean) => {
    setOpen(value);
    if (!value) sessionStorage.setItem(`musicdna:save-prompt:${sessionId}`, "dismissed");
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Keep this reading
      </Button>
      <Sheet open={open} onOpenChange={dismiss}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-xl max-h-[90dvh] overflow-y-auto space-y-5 rounded-t"
        >
          <SheetTitle className="font-serif text-3xl">Keep this reading.</SheetTitle>
          <SheetDescription>
            A guest session stays on this browser. An account keeps your access when you change
            devices.
          </SheetDescription>
          <GuestSaveForm sessionId={sessionId} />
          <Button variant="ghost" onClick={() => dismiss(false)}>
            Not now — back to my reading
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
