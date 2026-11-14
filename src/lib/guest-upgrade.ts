export type UpgradeUser = { id: string; is_anonymous?: boolean; email_confirmed_at?: string | null };

/** Email confirmation and stable identity both precede password setup or a saved claim. */
export function verifiedUpgrade(user: UpgradeUser | null, expectedId: string): boolean {
  return !!user && user.id === expectedId && user.is_anonymous === false && !!user.email_confirmed_at;
}