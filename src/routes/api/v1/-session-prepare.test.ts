import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), exposure: vi.fn(), prepare: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("./_auth", async (original) => ({
  ...(await original<object>()),
  verifyBearer: mocks.auth,
}));
vi.mock("@/musicdna/adapters/exposure", () => ({ acknowledgeExposure: mocks.exposure }));
vi.mock("@/lib/musicdna.functions", () => ({ prepareReadsImpl: mocks.prepare }));
import { Route } from "./session.$id.prepare";
import { HttpError } from "./_auth";

const sid = "11111111-1111-4111-8111-111111111111";
const body = {
  pairing_id: "22222222-2222-4222-8222-222222222222",
  exposure_id: "33333333-3333-4333-8333-333333333333",
};
const handler = (
  Route as unknown as { server: { handlers: { POST: (args: unknown) => Promise<Response> } } }
).server.handlers.POST;
const request = (value: unknown = body) => ({
  request: new Request(`https://example.test/api/v1/session/${sid}/prepare`, {
    method: "POST",
    body: JSON.stringify(value),
  }),
  params: { id: sid },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ supabase: "caller-scoped-client", userId: "verified-user" });
  mocks.exposure.mockResolvedValue({ recorded: true });
  mocks.prepare.mockResolvedValue({ prepared: 2 });
});
describe("authenticated REST Critic preparation", () => {
  it("denies unauthenticated requests before any exposure or generation", async () => {
    mocks.auth.mockRejectedValue(new HttpError("UNAUTHORIZED", 401, "Missing bearer token"));
    expect((await handler(request())).status).toBe(401);
    expect(mocks.exposure).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("rejects unowned or never-offered pairings without calling a model", async () => {
    mocks.exposure.mockRejectedValue(new Error("Unavailable"));
    expect((await handler(request())).status).toBe(403);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("validates the closed request before preparation", async () => {
    expect((await handler(request({ ...body, arbitrary_model: "other" }))).status).toBe(400);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("delegates to the shared web implementation using verified identity", async () => {
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ contract: 1, prepared: 2 });
    expect(mocks.exposure).toHaveBeenCalledWith(
      "caller-scoped-client",
      "verified-user",
      sid,
      body.pairing_id,
      body.exposure_id,
      "flutter",
    );
    expect(mocks.prepare).toHaveBeenCalledWith("caller-scoped-client", "verified-user", {
      sessionId: sid,
      pairingId: body.pairing_id,
    });
  });
  it("returns a sanitized best-effort failure without exposing backend diagnostics", async () => {
    mocks.prepare.mockRejectedValue(new Error("Private diagnostic"));
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Private diagnostic");
  });
});
