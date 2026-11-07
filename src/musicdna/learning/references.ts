import { LearningOutboxError, type LearningReferences } from "./outbox";

/** Inject the existing server-managed secret; never load it in client/shared code.
 * HKDF derives a distinct purpose key. Enrollment refs are persisted once so a
 * managed-key rotation cannot change an existing subject's withdrawal scope.
 */
export function learningReferences(serverSecret: string): LearningReferences {
  if (!serverSecret) throw new LearningOutboxError("outbox_unavailable");
  const encode = (value: string) => new TextEncoder().encode(value);
  const key = (async () => {
    const root = await crypto.subtle.importKey("raw", encode(serverSecret), "HKDF", false, [
      "deriveKey",
    ]);
    return crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encode("musicdna-learning-refs.v1"),
        info: encode("purpose-scoped-references"),
      },
      root,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"],
    );
  })();
  return {
    async reference(scope, kind, internalId) {
      const prefix = { subject: "s", decision: "d", result: "r", feedback: "f" }[kind];
      if (!prefix || !internalId || internalId.length > 128 || !scope.tenantId)
        throw new LearningOutboxError("invalid_capture");
      const input = JSON.stringify([
        "musicdna_diagnostic_quality",
        scope.tenantId,
        scope.source,
        scope.environment,
        kind,
        internalId,
      ]);
      const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", await key, encode(input)));
      return prefix + "_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    },
  };
}
