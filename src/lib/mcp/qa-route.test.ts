import { it, expect, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
import { Route } from "../../routes/api/v1/session.$id.qa-quips";
const handlers = (
  Route as unknown as {
    server: { handlers: Record<"GET" | "POST", (ctx: unknown) => Promise<Response>> };
  }
).server.handlers;
it("denies anonymous QA telemetry before reading a malformed observation or touching persistence", async () => {
  const sid = "11111111-1111-4111-8111-111111111111";
  for (const method of ["GET", "POST"] as const) {
    const response = await handlers[method]({
      params: { id: sid },
      request: new Request(`https://example.test/api/v1/session/${sid}/qa-quips`, {
        method,
        ...(method === "POST" ? { body: "SECRET_NOT_JSON" } : {}),
      }),
    });
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).toContain("UNAUTHORIZED");
    expect(text).not.toContain("SECRET_NOT_JSON");
  }
});
