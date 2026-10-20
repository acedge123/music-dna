export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  mutation_id: string | null;
};
export type ConversationPage = {
  sessionId: string | null;
  messages: ConversationMessage[];
  next_cursor?: string | null;
};
export type PendingTurn = { mutationId: string; message: string };
export type ConversationTransport = {
  list: (sessionId: string, cursor?: string) => Promise<ConversationPage>;
  send: (
    sessionId: string,
    turn: PendingTurn,
  ) => Promise<{
    pending?: boolean;
    userMessageId?: string;
    assistantMessageId?: string;
    sessionId: string;
    reply: string;
  }>;
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const draftKey = (owner: string, sessionId: string) =>
  `musicdna:reading-draft:${owner}:${sessionId}`;

export function readConversationDraft(
  storage: DraftStorage,
  owner: string,
  sessionId: string,
): { draft: string; pending: PendingTurn | null } | null {
  try {
    const value = JSON.parse(storage.getItem(draftKey(owner, sessionId)) ?? "null");
    if (!value || typeof value.draft !== "string" || value.draft.length > 2000) return null;
    const pending = value.pending;
    if (
      pending != null &&
      (typeof pending.mutationId !== "string" ||
        !pending.mutationId ||
        pending.mutationId.length > 80 ||
        typeof pending.message !== "string" ||
        !pending.message.trim() ||
        pending.message.length > 2000)
    )
      return null;
    return { draft: value.draft, pending: pending ?? null };
  } catch {
    return null;
  }
}

export function storeConversationDraft(
  storage: DraftStorage,
  owner: string,
  sessionId: string,
  draft: string,
  pending: PendingTurn | null,
) {
  const key = draftKey(owner, sessionId);
  try {
    if (!draft && !pending) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ draft, pending }));
  } catch {
    /* Storage can be unavailable; in-memory draft remains intact. */
  }
}

export function mergeConversation(...pages: ConversationMessage[][]): ConversationMessage[] {
  const messages = new Map(pages.flat().map((message) => [message.id, message]));
  return [...messages.values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

export class PendingConversationError extends Error {
  constructor() {
    super(
      "Your message is saved, but its reply is still being prepared. Retry this same message shortly.",
    );
  }
}

function committedTurn(page: ConversationPage, sessionId: string, turn: PendingTurn) {
  if (page.sessionId !== sessionId) throw new Error("The conversation doesn't match this reading.");
  const user = page.messages.find(
    (message) => message.mutation_id === turn.mutationId && message.role === "user",
  );
  const reply = page.messages.find(
    (message) => message.mutation_id === `${turn.mutationId}:reply` && message.role === "assistant",
  );
  if (user && user.content !== turn.message)
    throw new Error("This saved message doesn't match the pending draft.");
  return user && reply ? { user, reply } : null;
}

// Only display stored messages. A lost acknowledgment is reconciled by exact
// mutation identities; timestamps and invented local replies are never proof.
export async function submitConversationTurn(
  transport: ConversationTransport,
  sessionId: string,
  turn: PendingTurn,
) {
  const before = await transport.list(sessionId);
  if (committedTurn(before, sessionId, turn)) return before;
  let result: Awaited<ReturnType<ConversationTransport["send"]>>;
  try {
    result = await transport.send(sessionId, turn);
  } catch {
    throw new Error("Couldn't save your message. Your draft is kept; retry this same message.");
  }
  if (result.sessionId !== sessionId) throw new Error("The reply doesn't match this reading.");
  if (result.pending) throw new PendingConversationError();
  const after = await transport.list(sessionId);
  const saved = committedTurn(after, sessionId, turn);
  if (
    !saved ||
    saved.user.id !== result.userMessageId ||
    saved.reply.id !== result.assistantMessageId
  ) {
    throw new Error("Couldn't confirm the saved reply. Retry the same message.");
  }
  return after;
}
