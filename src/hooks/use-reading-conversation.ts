import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatTurn, listChat } from "@/lib/musicdna.functions";
import { getSavedReading } from "@/lib/saved-reading.functions";
import { ensureAnonSession } from "@/lib/anon-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  mergeConversation,
  submitConversationTurn,
  readConversationDraft,
  storeConversationDraft,
  type ConversationMessage,
  type ConversationPage,
  type ConversationTransport,
  type PendingTurn,
} from "@/lib/reading-conversation";

function draftStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function useReadingConversation(sessionId: string | undefined, resultVersion?: number) {
  const sendFn = useServerFn(chatTurn),
    listFn = useServerFn(listChat),
    readingFn = useServerFn(getSavedReading);
  const transport = useMemo<ConversationTransport>(
    () => ({
      list: async (id, cursor) =>
        (await listFn({ data: { sessionId: id || undefined, cursor } })) as ConversationPage,
      send: (id, turn) =>
        sendFn({ data: { sessionId: id, message: turn.message, mutationId: turn.mutationId } }),
    }),
    [listFn, sendFn],
  );
  const [reading, setReading] = useState<Awaited<ReturnType<typeof readingFn>> | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const pendingRef = useRef<PendingTurn | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(false),
    generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const ownerRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const requestGeneration = ++generation.current;
    setLoading(true);
    setBusy(false);
    setError(null);
    setReading(null);
    setMessages([]);
    try {
      await ensureAnonSession();
      const { data: auth } = await supabase.auth.getSession();
      const owner = auth.session?.user.id;
      if (!owner) throw new Error("Sign in again to open this reading.");
      const id = sessionId ?? (await transport.list("")).sessionId;
      if (!id) throw new Error("Finish a reading before starting a conversation.");
      const [saved, page] = await Promise.all([
        readingFn({ data: { sessionId: id, resultVersion } }),
        transport.list(id),
      ]);
      if (requestGeneration !== generation.current) return;
      if (page.sessionId !== id) throw new Error("The conversation doesn't match this reading.");
      ownerRef.current = owner;
      const storage = draftStorage();
      const savedDraft = storage ? readConversationDraft(storage, owner, id) : null;
      pendingRef.current = savedDraft?.pending ?? null;
      setPending(savedDraft?.pending ?? null);
      setDraft(savedDraft?.draft ?? "");
      setReading(saved);
      setMessages(page.messages);
      setCursor(page.next_cursor ?? null);
    } catch (error) {
      if (requestGeneration === generation.current)
        setError(error instanceof Error ? error.message : "Couldn't load this conversation.");
    } finally {
      if (requestGeneration === generation.current) setLoading(false);
    }
  }, [sessionId, resultVersion, readingFn, transport]);

  useEffect(() => {
    pendingRef.current = null;
    setPending(null);
    setDraft("");
    void load();
    return invalidate;
  }, [load, invalidate]);
  useEffect(() => {
    const storage = draftStorage();
    if (storage && reading && ownerRef.current)
      storeConversationDraft(storage, ownerRef.current, reading.sessionId, draft, pending);
  }, [reading, draft, pending]);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_OUT" ||
        (event === "SIGNED_IN" && ownerRef.current && ownerRef.current !== session?.user.id)
      ) {
        const storage = draftStorage();
        if (storage && reading && ownerRef.current)
          storeConversationDraft(storage, ownerRef.current, reading.sessionId, "", null);
        generation.current++;
        pendingRef.current = null;
        setPending(null);
        setDraft("");
        setMessages([]);
        setReading(null);
        setLoading(false);
        setError("Sign in again to return to your reading.");
        ownerRef.current = null;
      }
    });
    return () => subscription.unsubscribe();
  }, [reading]);

  async function send() {
    if (!reading || requestRef.current || (!draft.trim() && !pendingRef.current)) return;
    const requestGeneration = generation.current;
    const turn = pendingRef.current ?? { mutationId: crypto.randomUUID(), message: draft.trim() };
    pendingRef.current = turn;
    setPending(turn);
    requestRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const page = await submitConversationTurn(transport, reading.sessionId, turn);
      if (requestGeneration !== generation.current) return;
      setMessages((previous) => mergeConversation(previous, page.messages));
      setDraft("");
      setPending(null);
      pendingRef.current = null;
      const saved = await readingFn({
        data: { sessionId: reading.sessionId, resultVersion: reading.selected.version },
      });
      if (requestGeneration === generation.current) setReading(saved);
    } catch (error) {
      if (requestGeneration === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Couldn't save your message. Retry the same message.",
        );
    } finally {
      requestRef.current = false;
      if (requestGeneration === generation.current) setBusy(false);
    }
  }

  async function loadOlder() {
    if (!reading || !cursor || requestRef.current) return;
    const requestGeneration = generation.current;
    requestRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const page = await transport.list(reading.sessionId, cursor);
      if (page.sessionId !== reading.sessionId)
        throw new Error("The conversation doesn't match this reading.");
      if (requestGeneration !== generation.current) return;
      setMessages((previous) => mergeConversation(page.messages, previous));
      setCursor(page.next_cursor ?? null);
    } catch {
      if (requestGeneration === generation.current)
        setError("Couldn't load earlier messages. Please retry.");
    } finally {
      requestRef.current = false;
      if (requestGeneration === generation.current) setBusy(false);
    }
  }
  return {
    reading,
    messages,
    draft,
    setDraft,
    pending,
    busy,
    loading,
    error,
    send,
    loadOlder,
    hasOlder: !!cursor,
    reload: load,
  };
}
