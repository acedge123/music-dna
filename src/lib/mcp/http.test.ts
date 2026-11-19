import { describe, it, expect } from "vitest";
import {
  createTanStackMcpHandler,
  createTanStackOAuthProtectedResourceMetadataHandler,
} from "@lovable.dev/mcp-js/stacks/tanstack";
import mcp from "./index";
import { boundedMcpRequest } from "./http";
describe("MCP HTTP boundary", () => {
  it("advertises the exact resource without leaking tokens or accepting anonymous tool calls", async () => {
    const options = { resourcePath: "/mcp", trustForwardedHost: false };
    const metadata = await createTanStackOAuthProtectedResourceMetadataHandler(
      mcp,
      options,
    )({ request: new Request("https://musicdna.fm/.well-known/oauth-protected-resource") });
    expect(await metadata.json()).toMatchObject({
      resource: "https://musicdna.fm/mcp",
      authorization_servers: ["https://udycgnhvaanemhrchbuj.supabase.co/auth/v1"],
    });
    const response = await createTanStackMcpHandler(
      mcp,
      options,
    )({
      request: new Request("https://musicdna.fm/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
    expect(await response.text()).not.toContain("song_whys_list");
  });
  it("rejects untrusted browser origins and oversized declared or streamed requests", async () => {
    expect(
      (
        (await boundedMcpRequest(
          new Request("https://musicdna.fm/mcp", {
            headers: { Origin: "https://evil.example" },
          }),
        )) as Response
      ).status,
    ).toBe(403);
    const request = new Request("https://musicdna.fm/mcp", {
      method: "POST",
      body: "x".repeat(66000),
    });
    expect(((await boundedMcpRequest(request)) as Response).status).toBe(413);
    const small = await boundedMcpRequest(
      new Request("https://musicdna.fm/mcp", { method: "POST", body: "{}" }),
    );
    expect(small).toBeInstanceOf(Request);
    expect(await (small as Request).text()).toBe("{}");
    const source = new Request("https://musicdna.fm/mcp", { method: "POST", body: '{"id":1}' });
    const wrapped = {
      url: source.url,
      method: source.method,
      headers: source.headers,
      body: source.body,
    } as Request;
    expect(await ((await boundedMcpRequest(wrapped)) as Request).text()).toBe('{"id":1}');
  });
});
