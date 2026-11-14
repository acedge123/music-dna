import { describe, expect, it } from "vitest";
import { verifiedUpgrade } from "./guest-upgrade";
describe("guest upgrade verification", () => {
  it("requires confirmed email", () =>
    expect(verifiedUpgrade({ id: "guest", is_anonymous: false }, "guest")).toBe(false));
  it("rejects a different signed-in account", () =>
    expect(
      verifiedUpgrade(
        { id: "other", is_anonymous: false, email_confirmed_at: "2026-11-14" },
        "guest",
      ),
    ).toBe(false));
  it("rejects an anonymous identity", () =>
    expect(
      verifiedUpgrade(
        { id: "guest", is_anonymous: true, email_confirmed_at: "2026-11-14" },
        "guest",
      ),
    ).toBe(false));
  it("accepts only the confirmed original identity", () =>
    expect(
      verifiedUpgrade(
        { id: "guest", is_anonymous: false, email_confirmed_at: "2026-11-14" },
        "guest",
      ),
    ).toBe(true));
});
