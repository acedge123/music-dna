import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AccountControl() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (loading) return <span className="inline-block min-h-11 w-20" aria-label="Checking account" />;
  if (!user || user.is_anonymous) return (
    <Button asChild variant="ghost" className="min-h-11 text-muted-foreground">
      <Link to="/auth">Sign in</Link>
    </Button>
  );
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      await navigate({ to: "/auth", replace: true });
    } catch {
      setError("Couldn’t sign out. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button asChild variant="ghost" className="min-h-11 text-muted-foreground">
        <Link to="/profile">Account</Link>
      </Button>
      <Button variant="ghost" disabled={busy} onClick={signOut} className="min-h-11 text-muted-foreground">
        <LogOut />{busy ? "Signing out…" : "Sign out"}
      </Button>
      {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}