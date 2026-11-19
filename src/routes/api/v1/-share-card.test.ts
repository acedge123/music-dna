import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ published: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/lib/share.functions", () => ({ getPublicSession: mocks.published }));
import { Route } from "./share.$token.card";
const handle = (
  Route as unknown as { server: { handlers: { GET: (args: unknown) => Promise<Response> } } }
).server.handlers.GET;
const frozen = {
  session: {
    content: {
      synthesis: "Polish doesn't mean polite.",
      archetype_v2: { name: "The Witness", status: "confirmed" },
    },
  },
  definingChoices: [{ chosen: "True", rejected: "Roxanne" }],
};
function get(token = "same-normal-token", format = "square") {
  return handle({
    params: { token },
    request: new Request(`https://www.musicdna.fm/api/v1/share/${token}/card?format=${format}`),
  });
}
function noStore(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("cdn-cache-control")).toBe("no-store");
  expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.published.mockResolvedValue(frozen);
});
describe("revocable share card response", () => {
  it.each(["square", "story"])(
    "never stores %s cards and preserves the published snapshot",
    async (format) => {
      const before = JSON.stringify(frozen);
      const response = await get(undefined, format);
      expect(response.status).toBe(200);
      noStore(response);
      expect(response.headers.get("content-type")).toMatch(/^image\/svg\+xml/);
      const svg = await response.text();
      expect(svg).toContain("Polish");
      expect(svg).toContain("The Witness");
      expect(JSON.stringify(frozen)).toBe(before);
    },
  );
  it("rechecks publication at the same URL after a successful read and returns uncached 404 on revoke", async () => {
    expect((await get()).status).toBe(200);
    mocks.published.mockRejectedValue(new Error("Session not found"));
    const revoked = await get();
    expect(revoked.status).toBe(404);
    noStore(revoked);
    expect(await revoked.text()).not.toContain("Polish");
    expect(mocks.published).toHaveBeenCalledTimes(2);
  });
  it("does not cache malformed tokens or look them up", async () => {
    const invalid = await get("x");
    expect(invalid.status).toBe(400);
    noStore(invalid);
    expect(mocks.published).not.toHaveBeenCalled();
  });
});
