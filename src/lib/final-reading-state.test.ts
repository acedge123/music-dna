import { describe, expect, it, vi } from "vitest";
import { needsInterimRead, recoverFinalReading } from "./final-reading-state";

describe("final reading delivery state", () => {
  const rejected = { result_version: null, narration_status: "invalid_generation" };
  const saved = { result_version: 1, narration_status: "ok" };
  it("shows a saved version without generating", async () => {
    const generate = vi.fn();
    expect(await recoverFinalReading(async () => saved, generate)).toBe(saved);
    expect(generate).not.toHaveBeenCalled();
  });
  it("automatically retries a rejected draft once", async () => {
    const generate = vi.fn().mockResolvedValueOnce(rejected).mockResolvedValueOnce(saved);
    expect(await recoverFinalReading(async () => null, generate)).toBe(saved);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("reads a concurrent saved result instead of retrying rejection", async () => {
    const read = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    const generate = vi.fn().mockResolvedValue(rejected);
    expect(await recoverFinalReading(read, generate)).toBe(saved);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("stops after two rejected drafts", async () => {
    const generate = vi.fn().mockResolvedValue(rejected);
    expect(await recoverFinalReading(async () => null, generate)).toBe(rejected);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("checks saved results after timeout without duplicating generation", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("timeout"));
    const read = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    expect(await recoverFinalReading(read, generate)).toBe(saved);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("does not retry an unknown outcome with no saved result", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(recoverFinalReading(async () => null, generate)).rejects.toThrow("timeout");
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("does not retry after navigation supersedes the interview", async () => {
    let current = true;
    const generate = vi.fn().mockImplementation(async () => {
      current = false;
      return rejected;
    });
    await expect(
      recoverFinalReading(
        async () => null,
        generate,
        () => current,
      ),
    ).rejects.toThrow("superseded");
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("pick six never waits for an interim read before the final report in either flow", () => {
    expect(needsInterimRead("per_pick", 6, null)).toBe(false);
    expect(needsInterimRead("checkpoints", 6, null)).toBe(false);
    expect(needsInterimRead("per_pick", 5, null)).toBe(true);
    expect(needsInterimRead("checkpoints", 4, 2)).toBe(true);
    expect(needsInterimRead("checkpoints", 5, null)).toBe(false);
  });
});
