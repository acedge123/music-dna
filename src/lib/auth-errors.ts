export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  const map: Record<string, string> = {
    user_already_exists: "That email already has an account. Sign in instead.",
    invalid_credentials: "Wrong email or password.",
    email_not_confirmed: "Confirm your email first — check your inbox.",
    weak_password: "Pick a stronger password (at least 6 characters).",
    over_email_send_rate_limit: "Too many emails just now. Try again in a few minutes.",
    same_password: "That's your current password. Choose a new one.",
  };
  return (code && map[code]) || "Something went wrong. Try again.";
}
