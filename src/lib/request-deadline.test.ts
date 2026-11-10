import { afterEach, describe, expect, it, vi } from "vitest";
import { withRequestDeadline } from "./request-deadline";

afterEach(() => vi.useRealTimers());
describe("request deadline", () => {
  it("returns the confirmed result", async () => {
    expect(await withRequestDeadline(Promise.resolve("saved"), "retry")).toBe("saved");
  });
  it("releases a stuck request without asserting a failed write", async () => {
    vi.useFakeTimers();
    const pending = withRequestDeadline(new Promise(() => {}), "Outcome unknown; retry");
    const assertion = expect(pending).rejects.toThrow("Outcome unknown; retry");
    await vi.advanceTimersByTimeAsync(45000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans up the deadline after a rejected request", async () => {
    vi.useFakeTimers();
    await expect(
      withRequestDeadline(Promise.reject(new Error("offline")), "retry"),
    ).rejects.toThrow("offline");
    expect(vi.getTimerCount()).toBe(0);
  });
});
