export type Accuracy = "accurate" | "mixed" | "not_accurate";
export type SavedAccuracy = {
  id: string;
  accuracy: Accuracy;
  resultVersion: number;
  mutationId: string | null;
};
export type ReadingFeedback = {
  sessionId: string;
  resultVersion: number;
  feedback: SavedAccuracy | null;
};
export type AccuracyAttempt = {
  sessionId: string;
  resultVersion: number;
  accuracy: Accuracy;
  mutationId: string;
};
export async function saveAndConfirmAccuracy(
  transport: {
    save: (attempt: AccuracyAttempt) => Promise<{ id: string }>;
    read: (sessionId: string, resultVersion: number) => Promise<ReadingFeedback>;
  },
  attempt: AccuracyAttempt,
) {
  const receipt = await transport.save(attempt);
  const saved = await transport.read(attempt.sessionId, attempt.resultVersion);
  if (
    saved.sessionId !== attempt.sessionId ||
    saved.resultVersion !== attempt.resultVersion ||
    !saved.feedback ||
    saved.feedback.resultVersion !== attempt.resultVersion ||
    saved.feedback.id !== receipt.id ||
    saved.feedback.accuracy !== attempt.accuracy ||
    saved.feedback.mutationId !== attempt.mutationId
  )
    throw Error("Your rating may be saved, but we couldn't confirm it. Retry this same rating.");
  return saved.feedback;
}

// This form records one accuracy vote per saved version. A reload cannot create
// a second operation while an earlier response is still uncertain.
export const readingAccuracyMutationId = (sessionId: string, resultVersion: number) =>
  `reading-accuracy.v1:${sessionId}:${resultVersion}`;
