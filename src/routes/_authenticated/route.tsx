import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminCheck } from "@/lib/admin.functions";
import { AccountControl } from "@/components/musicdna/account-control";

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
  const check = useServerFn(adminCheck);
  const adminQ = useQuery({
    queryKey: ["adminCheck"],
    queryFn: () => check(),
    staleTime: 5 * 60_000,
  });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-mono text-xs tracking-[0.22em] uppercase">
            MusicDNA
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              to="/onboarding"
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Interview
            </Link>
            <Link
              to="/me"
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Me
            </Link>
            <Link
              to="/profile"
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Profile
            </Link>
            {adminQ.data?.isAdmin && (
              <Link
                to="/admin"
                className="text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                Admin
              </Link>
            )}
            <AccountControl />
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
