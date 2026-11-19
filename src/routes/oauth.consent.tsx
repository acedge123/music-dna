import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";
export const Route = createFileRoute("/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id:
      typeof s.authorization_id === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(s.authorization_id)
        ? s.authorization_id
        : undefined,
  }),
  component: Consent,
});
/** Only redirect to an HTTPS destination returned by Supabase, never a query-supplied callback. */
function complete(url: string) {
  if (new URL(url).protocol !== "https:") throw new Error("Invalid OAuth callback");
  window.location.assign(url);
}
function Consent() {
  const { authorization_id } = Route.useSearch(),
    { user, loading } = useAuth();
  const signedIn = !!user && !user.is_anonymous;
  const [details, setDetails] = useState<OAuthAuthorizationDetails>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setDetails(undefined);
    setError("");
    if (!signedIn || !authorization_id) return;
    let active = true;
    void supabase.auth.oauth.getAuthorizationDetails(authorization_id).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) {
        setError(
          "This authorization request is unavailable or expired. Restart the connection in your assistant.",
        );
        return;
      }
      if ("redirect_url" in data) {
        try {
          complete(data.redirect_url);
        } catch {
          setError("Invalid authorization callback.");
        }
      } else if (data.user.id !== user?.id) {
        setError("Authorization account mismatch. Restart the connection.");
      } else setDetails(data);
    });
    return () => {
      active = false;
    };
  }, [authorization_id, signedIn, user?.id]);
  async function decide(approve: boolean) {
    if (!authorization_id) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await (approve
        ? supabase.auth.oauth.approveAuthorization(authorization_id, { skipBrowserRedirect: true })
        : supabase.auth.oauth.denyAuthorization(authorization_id, { skipBrowserRedirect: true }));
      if (error || !data) throw new Error();
      complete(data.redirect_url);
    } catch {
      setError("Authorization was not confirmed. Restart the connection if this request expired.");
      setBusy(false);
    }
  }
  return (
    <main className="max-w-xl mx-auto p-8 space-y-5">
      <h1 className="text-2xl">Connect to MusicDNA</h1>
      {!authorization_id ? (
        <p>Missing authorization request. Start this connection from ChatGPT or Claude.</p>
      ) : loading ? (
        <p>Checking your account…</p>
      ) : !signedIn ? (
        <>
          <p>
            Sign in with your existing MusicDNA operator account. Signing in does not grant catalog
            or QA permissions.
          </p>
          <Link to="/auth" search={{ authorization_id }}>
            Sign in to continue
          </Link>
        </>
      ) : details ? (
        <>
          <p>
            <strong>{details.client.name}</strong> is requesting access to your MusicDNA account.
          </p>
          <p className="break-all">Return address: {details.redirect_uri}</p>
          <p>Requested scopes: {details.scope}</p>
          <p>
            Server permissions determine which catalog records the assistant can inspect and whether
            it can submit draft corrections. Approval and publishing remain in the human admin
            workflow. No additional role is granted by connecting.
          </p>
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void decide(true)}>
              Allow connection
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>
              Deny
            </Button>
          </div>
        </>
      ) : !error ? (
        <p>Loading authorization details…</p>
      ) : null}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
