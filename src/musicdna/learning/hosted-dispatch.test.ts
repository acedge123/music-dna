// @vitest-environment node
import { it, expect, vi } from "vitest";
import { createHostedDispatchHandler } from "./hosted-dispatch";
const req = (body = "{}", token = "a".repeat(64)) =>
  new Request("http://localhost", {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : {},
    body,
  });
it("denies missing caller keys and any caller parameters before accessing the backend", async () => {
  const claim = vi.fn(),
    dispatch = vi.fn(),
    record = vi.fn(),
    h = createHostedDispatchHandler({ claim, dispatch, record });
  expect((await h(req("{}", ""))).status).toBe(401);
  expect((await h(req('{"source":"foreign"}'))).status).toBe(400);
  expect((await h(req("x".repeat(300)))).status).toBe(413);
  expect(claim).not.toHaveBeenCalled();
});
it("uses a verifier and server-issued lease, returning only operational metadata", async () => {
  const claim = vi.fn(async (_hash: string) => ({ state: "leased", run_id: "server-run" })),
    record = vi.fn();
  const h = createHostedDispatchHandler({
    claim,
    record,
    dispatch: async () => ({ state: "idle", delivered: 0, attention_required: false }) as never,
  });
  const r = await h(req());
  expect(r.status).toBe(200);
  expect(claim.mock.calls[0][0]).toMatch(/^[0-9a-f]{64}$/);
  expect(claim.mock.calls[0][0]).not.toBe("a".repeat(64));
  expect(record).toHaveBeenCalledWith("server-run", "completed", 0, false);
  expect(await r.json()).toEqual({
    ok: true,
    state: "idle",
    delivered: 0,
    attention_required: false,
  });
});
it("sanitizes errors and preserves a failed durable receipt", async () => {
  const record = vi.fn(),
    h = createHostedDispatchHandler({
      claim: async () => ({ state: "leased", run_id: "server-run" }),
      record,
      dispatch: async () => {
        throw Error("secret details");
      },
    });
  const r = await h(req());
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("secret");
  expect(record).toHaveBeenCalledWith("server-run", "failed", 0, true);
});
