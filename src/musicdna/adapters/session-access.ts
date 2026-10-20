// A user-scoped query can hide a foreign row through RLS. Absence must never
// become a fresh, empty-vector interview in a shared application service.
export class SessionUnavailableError extends Error {
  constructor() {
    super("Session not available for this account.");
  }
}

export function requireVisibleSession<T>(result: {
  data: T | null;
  error: { code?: string; message?: string } | null;
}): T {
  if (result.error && result.error.code !== "PGRST116") {
    throw new Error("Couldn't load this session. Please retry.");
  }
  if (result.error || !result.data) throw new SessionUnavailableError();
  return result.data;
}
