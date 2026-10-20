import { describe, expect, it, vi } from "vitest";
import { requireVisibleSession, SessionUnavailableError } from "./session-access";
import { nextPairingImpl } from "@/lib/musicdna.functions";

describe("visible session boundary", () => {
  it("keeps an existing caller-visible session", () => {
    const session = { user_id: "owner", vector: { scale: 2 } };
    expect(requireVisibleSession({ data: session, error: null })).toBe(session);
  });
  it("rejects both RLS-hidden and nonexistent sessions", () => {
    expect(() => requireVisibleSession({ data: null, error: null })).toThrow(
      SessionUnavailableError,
    );
    expect(() => requireVisibleSession({ data: null, error: { code: "PGRST116" } })).toThrow(
      SessionUnavailableError,
    );
  });
  it("keeps database failures distinct without exposing database text", () => {
    expect(() =>
      requireVisibleSession({ data: null, error: { code: "08006", message: "private DB detail" } }),
    ).toThrow("Couldn't load this session");
  });
  it("next does not enter selection or telemetry when the session is hidden", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const from = vi.fn().mockReturnValue(chain);
    await expect(
      nextPairingImpl({ from } as never, { sessionId: "foreign-or-missing" }),
    ).rejects.toThrow(SessionUnavailableError);
    expect(from.mock.calls.map(([table]) => table)).toEqual(["choices", "sessions", "sessions"]);
  });
});
