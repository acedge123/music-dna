import {
  validateMusicDnaLearningEnvelopeV1,
  validateMusicDnaLearningReceiptV1,
  LEARNING_OBSERVATION_MAX_BYTES,
  LEARNING_OBSERVATION_SUMMARY,
  type MusicDnaLearningEnvelopeV1,
} from "./learning-observation-v1";
import {
  validateMusicDnaLearningEnvelopeV2,
  type MusicDnaLearningEnvelopeV2,
} from "./learning-observation-v2";
export {
  validateMusicDnaLearningReceiptV1,
  LEARNING_OBSERVATION_MAX_BYTES,
  LEARNING_OBSERVATION_SUMMARY,
};
export type MusicDnaLearningEnvelope = MusicDnaLearningEnvelopeV1 | MusicDnaLearningEnvelopeV2;
/** Validate the original bytes. Never normalize real evidence into synthetic evidence. */
export function validateMusicDnaLearningEnvelope(value: unknown) {
  const legacy = validateMusicDnaLearningEnvelopeV1(value);
  if (legacy.ok) return legacy;
  return validateMusicDnaLearningEnvelopeV2(value);
}
