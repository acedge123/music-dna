/** Bound tool inputs before SDK parsing. Caller authentication and RLS are still enforced downstream. */
export async function boundedMcpRequest(request: Request): Promise<Request | Response> {
  const origin = request.headers.get("origin");
  if (
    origin &&
    ![
      "https://www.musicdna.fm",
      "https://musicdna.fm",
      "https://chatgpt.com",
      "https://chat.openai.com",
      "https://claude.ai",
    ].includes(origin)
  )
    return new Response("Origin not allowed", { status: 403 });
  if (request.method !== "POST" || !request.body) return request;
  if (Number(request.headers.get("content-length")) > 65536)
    return new Response("Request too large", { status: 413 });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 65536) {
      void reader.cancel();
      return new Response("Request too large", { status: 413 });
    }
    chunks.push(value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  // TanStack/h3 can pass a wrapped Request without undici private fields.
  return new Request(request.url, { method: request.method, headers: request.headers, body });
}
