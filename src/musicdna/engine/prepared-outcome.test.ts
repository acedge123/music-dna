import { describe, expect, it } from "vitest";
import { preparedOutcome } from "./prepared-read";

describe("preparedOutcome", () => {
  it("uses only an exact ready match", () => {
    expect(preparedOutcome({ status: "ready", fingerprint: "a" }, "a", false)).toBe("used");
    expect(preparedOutcome({ status: "ready", fingerprint: "b" }, "a", false)).toBe("mismatch");
  });
  it("names failed, missing and late drafts", () => {
    expect(preparedOutcome({ status: "failed", fingerprint: null }, "a", false)).toBe("failed");
    expect(preparedOutcome(null, "a", false)).toBe("missing");
    expect(preparedOutcome({ status: "pending", fingerprint: null }, "a", true)).toBe("not_ready");
    expect(preparedOutcome({ status: "pending", fingerprint: null }, "a", false)).toBeNull();
  });
});
