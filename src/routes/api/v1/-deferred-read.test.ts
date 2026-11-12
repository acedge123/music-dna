import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), choice: vi.fn(), read: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("./_auth", async (original) => ({
  ...(await original<object>()),
  verifyBearer: mocks.auth,
}));
vi.mock("@/lib/musicdna.functions", () => ({
  recordChoiceImpl: mocks.choice,
  currentReadImpl: mocks.read,
  ChoiceConflictError: class ChoiceConflictError extends Error {},
}));
import { Route as Choice } from "./session.$id.choice";
import { Route as Read } from "./session.$id.read";
import { HttpError } from "./_auth";
import { ReadSupersededError } from "@/musicdna/adapters/read-cursor";
const sid = "11111111-1111-4111-8111-111111111111";
const pid = "22222222-2222-4222-8222-222222222222";
const song = "33333333-3333-4333-8333-333333333333";
const handle = (route: unknown) =>
  (route as { server: { handlers: { POST: (args: unknown) => Promise<Response> } } }).server
    .handlers.POST;
const request = (body: unknown, v1 = true) => ({
  params: { id: sid },
  request: new Request(`https://example.test/api/v1/session/${sid}/choice`, {
    method: "POST",
    headers: v1 ? { "X-MusicDNA-Experience": "1" } : {},
    body: JSON.stringify(body),
  }),
});
let owner: string | null;
beforeEach(() => {
  vi.resetAllMocks();
  owner = "owner";
  mocks.auth.mockResolvedValue({
    userId: "owner",
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: owner ? { user_id: owner } : null, error: null }),
          }),
        }),
      }),
    },
  });
  mocks.choice.mockResolvedValue({
    verdict: "Saved verdict",
    why: "Saved reason",
    vector: {},
    dim: "scale",
    delta: 1,
  });
  mocks.read.mockResolvedValue({ thesis: "Exact shared Critic text" });
});
describe("deferred running Critic", () => {
  it("acknowledges a committed V1 choice without awaiting or calling the model", async () => {
    const response = await handle(Choice)(
      request({ pairing_id: pid, chosen_song_id: song, defer_read: true }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      contract: 1,
      feedback: { verdict: "Saved verdict" },
      read: null,
      read_pending: true,
    });
    expect(mocks.choice).toHaveBeenCalledOnce();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("never acknowledges a failed vote as saved", async () => {
    mocks.choice.mockRejectedValue(new Error("save failed"));
    expect(
      (await handle(Choice)(request({ pairing_id: pid, chosen_song_id: song, defer_read: true })))
        .status,
    ).toBe(500);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("keeps old V1 inline narration and V0 shape unchanged", async () => {
    const body = { pairing_id: pid, chosen_song_id: song };
    expect(await (await handle(Choice)(request(body))).json()).toMatchObject({
      read: { thesis: "Exact shared Critic text" },
    });
    mocks.read.mockClear();
    const legacy = await (
      await handle(Choice)(request({ ...body, defer_read: true }, false))
    ).json();
    expect(legacy).toMatchObject({ verdict: "Saved verdict", vector: {} });
    expect(legacy).not.toHaveProperty("read_pending");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("uses the normal owner client and exact choice position for follow-up narration", async () => {
    const response = await handle(Read)(request({ after_pairing_id: pid, answered: 2 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      contract: 1,
      after_pairing_id: pid,
      answered: 2,
      read: { thesis: "Exact shared Critic text" },
    });
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), "owner", {
      sessionId: sid,
      afterChoice: { pairingId: pid, answered: 2 },
    });
  });
  it("denies signed-out and foreign/unknown sessions before narration", async () => {
    const body = { after_pairing_id: pid, answered: 2 };
    mocks.auth.mockRejectedValueOnce(new HttpError("UNAUTHORIZED", 401, "Missing bearer"));
    expect((await handle(Read)(request(body))).status).toBe(401);
    owner = "other";
    expect((await handle(Read)(request(body))).status).toBe(404);
    owner = null;
    expect((await handle(Read)(request(body))).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("rejects malformed or arbitrary-model input and normalizes stale/model failures", async () => {
    const body = { after_pairing_id: pid, answered: 2 };
    expect((await handle(Read)(request({ ...body, model: "other" }))).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.read.mockRejectedValueOnce(new ReadSupersededError());
    expect((await handle(Read)(request(body))).status).toBe(409);
    mocks.read.mockRejectedValueOnce(new Error("private backend detail"));
    const response = await handle(Read)(request(body));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private backend detail");
  });
});
