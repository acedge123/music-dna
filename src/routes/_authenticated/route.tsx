import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminCheck } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const check = useServerFn(adminCheck);
  const adminQ = useQuery({ queryKey: ["adminCheck"], queryFn: () => check(), staleTime: 5 * 60_000 });
  async function signOut() {
    await supabase.auth.signOut();
    // Clear cached authenticated data (admin check, profile, etc.) so it
    // can't leak into a subsequent session in the same tab. The centralized
    // onAuthStateChange listener in __root.tsx also clears on SIGNED_OUT,
    // but doing it here first keeps the navigate() below deterministic.
    queryClient.clear();
    toast.success("Signed out.");
    navigate({ to: "/" });
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-mono text-xs tracking-[0.22em] uppercase">MusicDNA</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/onboarding" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Interview</Link>
            <Link to="/me" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Me</Link>
            <Link to="/profile" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Profile</Link>
            {adminQ.data?.isAdmin && (
              <Link to="/admin" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Admin</Link>
            )}
            <button onClick={signOut} className="text-muted-foreground hover:text-foreground">Sign out</button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
