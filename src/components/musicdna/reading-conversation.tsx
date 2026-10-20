import { useEffect, useRef } from "react";
import type { ConversationMessage, PendingTurn } from "@/lib/reading-conversation";

export function ReadingConversation({
  messages,
  draft,
  onDraft,
  onSend,
  busy,
  pending,
  error,
  hasOlder,
  onOlder,
}: {
  messages: ConversationMessage[];
  draft: string;
  onDraft: (text: string) => void;
  onSend: () => void;
  busy: boolean;
  pending: PendingTurn | null;
  error: string | null;
  hasOlder: boolean;
  onOlder: () => void;
}) {
  const end = useRef<HTMLDivElement>(null),
    lastMessage = useRef<string | null>(null);
  useEffect(() => {
    const last = messages.at(-1)?.id;
    if (last && lastMessage.current !== last) {
      end.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      lastMessage.current = last;
    }
  }, [messages]);
  return (
    <section className="space-y-5" aria-label="Continue this reading">
      <header className="space-y-2">
        <p className="eyebrow">Push back</p>
        <h2 className="font-serif text-2xl">What did the read miss?</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your own account adds context. It doesn't replace the original choices or publish this
          conversation.
        </p>
      </header>
      {hasOlder && (
        <button
          type="button"
          disabled={busy}
          onClick={onOlder}
          className="min-h-11 rounded-sm border hairline-strong px-4 py-2 text-sm disabled:opacity-50"
        >
          Load earlier messages
        </button>
      )}
      <div
        role="log"
        aria-label="Saved conversation"
        aria-live="polite"
        aria-relevant="additions"
        className="space-y-6 break-words"
      >
        {messages.length === 0 && (
          <p className="font-serif text-lg text-muted-foreground">
            The original read is above. Tell the critic what fits, what doesn't, or which song
            changes the picture.
          </p>
        )}
        {messages
          .filter((message) => message.role !== "system")
          .map((message) => (
            <article
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-6 rounded-sm border hairline-strong bg-surface p-4"
                  : "space-y-2 border-l-2 border-primary pl-4"
              }
            >
              <p className="mb-2 font-mono text-xs text-muted-foreground">
                {message.role === "user" ? "You" : "The critic"}
              </p>
              <p className="whitespace-pre-wrap font-serif text-xl leading-snug">
                {message.content}
              </p>
            </article>
          ))}
        <div ref={end} />
      </div>
      {error && (
        <p role="alert" className="rounded-sm border border-primary p-3 text-sm leading-relaxed">
          {error}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="space-y-3"
      >
        <label htmlFor="reading-message" className="block text-sm font-medium">
          Your message
        </label>
        <textarea
          id="reading-message"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          readOnly={pending !== null}
          maxLength={2000}
          rows={3}
          placeholder="That fits, but here's what you missed…"
          className="block w-full min-w-0 resize-y rounded-sm border hairline-strong bg-surface p-3 text-base leading-relaxed focus-visible:outline-2 focus-visible:outline-gold"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || (!draft.trim() && !pending)}
            className="min-h-11 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving your conversation…" : pending ? "Retry this message" : "Send message"}
          </button>
          {pending && (
            <p role="status" className="text-xs text-muted-foreground">
              Your draft is kept until its reply is saved.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
