import { DispatchError, type DispatchTransport } from "../learning/dispatcher";

const ECHELON_LEARNING_INGRESS =
  "https://yczomejrvihbmydyraqg.supabase.co/functions/v1/app-signal-inbound/learning";
/** Endpoint is operator configuration, never a URL supplied by a listener/job. */
export function learningDispatchTransport(options: {
  endpoint?: string;
  keyForScope: (source: string, environment: string) => Promise<string>;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}): DispatchTransport {
  const endpoint = new URL(options.endpoint ?? ECHELON_LEARNING_INGRESS);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/functions/v1/app-signal-inbound/learning"
  )
    throw new DispatchError("configuration");
  return {
    async send(scope, kind, body) {
      const key = await options.keyForScope(scope.source, scope.environment);
      if (!key) throw new DispatchError("configuration");
      const signal = options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(5000)])
        : AbortSignal.timeout(5000);
      const response = await (options.fetch ?? fetch)(
        new URL(endpoint.toString() + (kind === "deletion" ? "/delete" : "")),
        {
          method: "POST",
          redirect: "error",
          signal,
          headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
          body,
        },
      );
      const retryAfter = response.headers.get("Retry-After");
      if (response.status !== 200) {
        try {
          await response.body?.cancel();
        } catch {
          /* headers still determine auth/retry classification */
        }
        return {
          status: response.status,
          body: null,
          retryAfter: retryAfter?.slice(0, 100) ?? null,
        };
      }
      const reader = response.body?.getReader();
      if (!reader) throw new DispatchError("invalid_response");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8192) {
            try {
              await reader.cancel();
            } catch {
              /* oversize remains a permanent invalid receipt */
            }
            throw new DispatchError("invalid_response");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        throw new DispatchError("invalid_response");
      }
      return {
        status: response.status,
        body: parsed,
        retryAfter: retryAfter?.slice(0, 100) ?? null,
      };
    },
  };
}
