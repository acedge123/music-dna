import { describe, expect, it } from "vitest";
import { requireReadCursor, ReadSupersededError } from "./read-cursor";
function client(pairingId: string | null, count: number | null, fail = false) {
  return {
    from: () => {
      let head = false;
      const result = () => ({
        data: pairingId ? { pairing_id: pairingId } : null,
        count,
        error: fail ? { message: "unavailable" } : null,
      });
      const q = {
        select: (_: string, options?: { head?: boolean }) => {
          head = !!options?.head;
          return q;
        },
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ ...result(), data: head ? null : result().data }).then(resolve),
      };
      return q;
    },
  };
}
describe("read position guard", () => {
  it("accepts only the last committed pairing at its exact answer count", async () => {
    await expect(
      requireReadCursor(client("p", 2) as never, "s", { pairingId: "p", answered: 2 }),
    ).resolves.toBeUndefined();
    for (const [pairingId, count] of [
      ["newer", 3],
      ["p", 3],
      [null, 0],
    ] as const)
      await expect(
        requireReadCursor(client(pairingId, count) as never, "s", { pairingId: "p", answered: 2 }),
      ).rejects.toBeInstanceOf(ReadSupersededError);
  });
  it("treats unavailable metadata as unavailable, never as a matching position", async () => {
    await expect(
      requireReadCursor(client("p", 2, true) as never, "s", { pairingId: "p", answered: 2 }),
    ).rejects.toThrow("unavailable");
  });
});
