import { expect, it } from "vitest";
import { friendlyAuthError } from "./auth-errors";
it("maps existing-account signup to a sign-in hint", () => {
  expect(friendlyAuthError({ code: "user_already_exists" })).toBe(
    "That email already has an account. Sign in instead.",
  );
});
it("never shows raw errors", () => {
  expect(friendlyAuthError(new Error("AuthApiException(...)"))).toBe("Something went wrong. Try again.");
});
