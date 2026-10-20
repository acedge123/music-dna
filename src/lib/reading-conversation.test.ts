import { describe, it, expect, vi } from "vitest";
import {
  mergeConversation,
  submitConversationTurn,
  readConversationDraft,
  storeConversationDraft,
  PendingConversationError,
  type ConversationMessage,
  type ConversationTransport,
} from "./reading-conversation";
const turn = { mutationId: "mutation-1", message: "My own account" };
const user: ConversationMessage = {
  id: "user-1",
  role: "user",
  content: turn.message,
  mutation_id: turn.mutationId,
  created_at: "2026-10-20T00:00:00Z",
};
const reply: ConversationMessage = {
  id: "reply-1",
  role: "assistant",
  content: "Stored reply",
  mutation_id: `${turn.mutationId}:reply`,
  created_at: "2026-10-20T00:00:01Z",
};
const page = { sessionId: "owned", messages: [user, reply] };
function transport(): ConversationTransport {
  return {
    list: vi
      .fn()
      .mockResolvedValueOnce({ sessionId: "owned", messages: [] })
      .mockResolvedValue(page),
    send: vi.fn().mockResolvedValue({
      sessionId: "owned",
      reply: reply.content,
      userMessageId: user.id,
      assistantMessageId: reply.id,
    }),
  };
}
describe("reading conversation reconciliation", () => {
  it("recovers a lost successful acknowledgment without another POST", async () => {
    const t = transport();
    t.list = vi.fn().mockResolvedValue(page);
    expect(await submitConversationTurn(t, "owned", turn)).toEqual(page);
    expect(t.send).not.toHaveBeenCalled();
  });
  it("confirms both exact stored message identities before acknowledging", async () => {
    const t = transport();
    expect(await submitConversationTurn(t, "owned", turn)).toEqual(page);
    expect(t.send).toHaveBeenCalledWith("owned", turn);
  });
  it("keeps a pending generation uncertain rather than inventing a reply", async () => {
    const t = transport();
    t.send = vi.fn().mockResolvedValue({ sessionId: "owned", pending: true, reply: "" });
    await expect(submitConversationTurn(t, "owned", turn)).rejects.toBeInstanceOf(
      PendingConversationError,
    );
  });
  it("does not accept the right text under different saved reply IDs", async () => {
    const t = transport();
    t.send = vi.fn().mockResolvedValue({
      sessionId: "owned",
      reply: reply.content,
      userMessageId: user.id,
      assistantMessageId: "different-reply",
    });
    await expect(submitConversationTurn(t, "owned", turn)).rejects.toThrow(
      "confirm the saved reply",
    );
  });
  it("rejects another reading before sending anything", async () => {
    const t = transport();
    t.list = vi.fn().mockResolvedValue({ ...page, sessionId: "foreign" });
    await expect(submitConversationTurn(t, "owned", turn)).rejects.toThrow("doesn't match");
    expect(t.send).not.toHaveBeenCalled();
  });
  it("rejects a reused key containing a different saved user message", async () => {
    const t = transport();
    t.list = vi
      .fn()
      .mockResolvedValue({ ...page, messages: [{ ...user, content: "different" }, reply] });
    await expect(submitConversationTurn(t, "owned", turn)).rejects.toThrow("pending draft");
    expect(t.send).not.toHaveBeenCalled();
  });
  it("merges overlapping cursor pages chronologically with stable equal-time IDs", () => {
    const earlier = { ...user, id: "a", created_at: user.created_at };
    const equal = { ...user, id: "b", created_at: user.created_at };
    expect(mergeConversation([equal, reply], [earlier, equal]).map((x) => x.id)).toEqual([
      "a",
      "b",
      "reply-1",
    ]);
  });
});

describe("private conversation draft restoration", () => {
  function memory() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  }
  it("restores the exact pending mutation and draft after refresh", () => {
    const store = memory();
    storeConversationDraft(store, "owner", "reading", turn.message, turn);
    expect(readConversationDraft(store, "owner", "reading")).toEqual({
      draft: turn.message,
      pending: turn,
    });
  });
  it("never restores another account or session's private draft", () => {
    const store = memory();
    storeConversationDraft(store, "owner", "reading", "private draft", null);
    expect(readConversationDraft(store, "other", "reading")).toBeNull();
    expect(readConversationDraft(store, "owner", "another")).toBeNull();
  });
  it("clears the draft after acknowledgment and tolerates unavailable storage", () => {
    const store = memory();
    storeConversationDraft(store, "owner", "reading", "draft", turn);
    storeConversationDraft(store, "owner", "reading", "", null);
    expect(readConversationDraft(store, "owner", "reading")).toBeNull();
    const broken = {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
      removeItem: () => {
        throw Error("blocked");
      },
    };
    expect(() => storeConversationDraft(broken, "owner", "reading", "draft", turn)).not.toThrow();
    expect(readConversationDraft(broken, "owner", "reading")).toBeNull();
  });
});
