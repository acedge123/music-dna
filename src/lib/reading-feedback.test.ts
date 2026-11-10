import { describe, it, expect, vi } from "vitest";
import {
  saveAndConfirmAccuracy,
  readingAccuracyMutationId,
  type AccuracyAttempt,
  type ReadingFeedback,
} from "./reading-feedback";
const attempt: AccuracyAttempt = {
  sessionId: "session-a",
  resultVersion: 1,
  accuracy: "mixed",
  mutationId: readingAccuracyMutationId("session-a", 1),
};
const page: ReadingFeedback = {
  sessionId: "session-a",
  resultVersion: 1,
  feedback: {
    id: "saved-row",
    accuracy: "mixed",
    resultVersion: 1,
    mutationId: attempt.mutationId,
  },
};
describe("reading accuracy confirmation", () => {
  it("requires durable readback matching the receipt, exact version and original operation", async () => {
    const save = vi.fn(async () => ({ id: "saved-row" })),
      read = vi.fn(async () => page);
    expect(await saveAndConfirmAccuracy({ save, read }, attempt)).toEqual(page.feedback);
    expect(save).toHaveBeenCalledExactlyOnceWith(attempt);
    expect(read).toHaveBeenCalledWith("session-a", 1);
  });
  it.each([
    { ...page, feedback: null },
    { ...page, resultVersion: 2 },
    { ...page, feedback: { ...page.feedback!, id: "another-row" } },
    { ...page, feedback: { ...page.feedback!, accuracy: "accurate" as const } },
    { ...page, feedback: { ...page.feedback!, mutationId: "another-operation" } },
  ])("never presents a different or unavailable persisted vote as saved", async (value) => {
    await expect(
      saveAndConfirmAccuracy(
        { save: async () => ({ id: "saved-row" }), read: async () => value },
        attempt,
      ),
    ).rejects.toThrow("couldn't confirm");
  });
  it("reuses the operation across reloads and separates sessions and revisions", () => {
    expect(readingAccuracyMutationId("session-a", 1)).toBe(attempt.mutationId);
    expect(readingAccuracyMutationId("session-a", 2)).not.toBe(attempt.mutationId);
    expect(readingAccuracyMutationId("session-b", 1)).not.toBe(attempt.mutationId);
  });
});
