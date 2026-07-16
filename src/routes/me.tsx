import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureAnonSession } from "@/lib/anon-auth";
import { chatTurn, listChat, getMyResult } from "@/lib/musicdna.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/me")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MusicDNA — Your read" },
      { name: "description", content: "Your MusicDNA read: the critic's interpretation of the choices you made." },
      { property: "og:title", content: "MusicDNA — Your read" },
      { property: "og:description", content: "The critic's interpretation of your choices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Me,
});

type ChatMsg = { role: "user" | "assistant" | "system"; content: string; created_at?: string };

const LANE_LABEL: Record<string, string> = {
  alternative: "Alternative", pop: "Pop", hip_hop: "Hip-Hop",
  electronic: "Electronic", classic_rock: "Classic Rock", metal: "Metal", r_and_b: "R&B / Soul", general: "General",
};

function Me() {
  const navigate = useNavigate();
  const chatFn = useServerFn(chatTurn);
  const listFn = useServerFn(listChat);
  const resultFn = useServerFn(getMyResult);

  const [bootError, setBootError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [openingSongs, setOpeningSongs] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAnon, setIsAnon] = useState(true);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Boot anon session, then load profile + chat history.
  useEffect(() => {
    (async () => {
      try {
        await ensureAnonSession();
        const { data: u } = await supabase.auth.getUser();
        setIsAnon(Boolean(u.user?.is_anonymous));
        const [r, h] = await Promise.all([
          resultFn() as Promise<any>,
          listFn({ data: {} } as never) as Promise<{ sessionId: string | null; messages: ChatMsg[] }>,
        ]);
        setProfile(r?.profile ?? null);
        setOpeningSongs((r?.profile?.opening_songs as string[] | null) ?? []);
        setSessionId(h.sessionId);
        setMessages(h.messages);
        // If no chat yet, seed the opener with a hello from the critic.
        if (!h.messages.length && r?.profile?.opening_hypothesis) {
          setMessages([{
            role: "assistant",
            content: `${r.profile.opening_hypothesis}\n\nAsk me anything — or push back.`,
          }]);
        } else if (!h.messages.length && !r?.profile?.opening_songs) {
          setMessages([{
            role: "assistant",
            content: "We haven't started yet. Name three songs first — then we'll talk.",
          }]);
        }
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [listFn, resultFn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    if (!profile?.opening_songs?.length) {
      toast.error("Name three songs first.");
      navigate({ to: "/onboarding" });
      return;
    }
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    try {
      const res = (await chatFn({ data: { message: text, sessionId: sessionId ?? undefined } } as never)) as { reply: string; sessionId: string };
      setSessionId(res.sessionId || sessionId);
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lost the thread.");
      setMessages((m) => [...m, { role: "assistant", content: "I lost the thread. Say that again?" }]);
    } finally {
      setBusy(false);
    }
  }

  if (bootError) {
    return (
      <main className="mx-auto max-w-2xl px-6 pt-24 text-center space-y-4">
        <p className="eyebrow">can't load your read</p>
        <p className="font-serif text-xl text-muted-foreground">{bootError}</p>
      </main>
    );
  }

  const hypothesis = (profile?.opening_hypothesis as string | null) ?? null;
  const lane = (profile?.opening_lane as string | null) ?? null;
  const confidence = Number(profile?.opening_lane_confidence ?? 0);

  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-32 min-h-screen flex flex-col gap-8">
      <header className="space-y-3">
        <p className="eyebrow">the living read</p>
        <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight">
          Your read so far.
          <br />
          <span className="italic text-muted-foreground">Never really finished.</span>
        </h1>
      </header>

      {loading ? (
        <p className="text-muted-foreground font-serif italic">Pulling the file…</p>
      ) : (
        <>
          {hypothesis && (
            <section className="border-l-2 border-primary/60 pl-4 py-2 space-y-3">
              <p className="eyebrow">working hypothesis</p>
              <p className="font-serif text-xl md:text-2xl italic leading-snug">"{hypothesis}"</p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {lane && (
                  <span className="border hairline-strong rounded-sm px-3 py-1 text-xs font-medium">
                    {LANE_LABEL[lane] ?? lane}
                  </span>
                )}
                {confidence > 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {Math.round(confidence * 100)}% confidence
                  </span>
                )}
                <Link
                  to="/onboarding"
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary underline-offset-4 hover:underline"
                >
                  Sharpen it with side-by-sides →
                </Link>
              </div>
            </section>
          )}

          {openingSongs.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow">opener · ranked</p>
              <ul className="space-y-1">
                {openingSongs.map((s, i) => (
                  <li key={i} className="grid grid-cols-[2rem_1fr] gap-3 items-baseline">
                    <span className="text-right font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      #{i + 1}
                    </span>
                    <span className="font-mono text-sm">{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!profile?.opening_songs?.length && (
            <section className="border hairline-strong rounded-sm p-6 text-center space-y-3">
              <p className="font-serif text-lg italic text-muted-foreground">
                I don't have anything to read yet.
              </p>
              <Link
                to="/onboarding"
                className="inline-block bg-primary text-primary-foreground rounded-sm px-5 py-2.5 text-sm font-medium hover:opacity-90"
              >
                Name three songs →
              </Link>
            </section>
          )}

          {/* Chat surface */}
          {profile?.opening_songs?.length > 0 && (
            <section className="flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="eyebrow">talk to the critic</p>
                {isAnon && (
                  <button
                    onClick={() => navigate({ to: "/auth" })}
                    className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    Save this read →
                  </button>
                )}
              </div>

              <div
                ref={scrollRef}
                className="flex-1 min-h-[280px] max-h-[55vh] overflow-y-auto border hairline rounded-sm p-5 space-y-5 bg-background"
              >
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[80%] bg-primary text-primary-foreground rounded-sm px-4 py-2.5 text-sm whitespace-pre-wrap"
                          : "max-w-[85%] font-serif text-base md:text-lg leading-snug text-foreground whitespace-pre-wrap"
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    thinking…
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Push back. Ask. Add another song you love."
                  className="flex-1 bg-transparent border-b-2 hairline-strong focus:border-primary outline-none py-2 font-serif italic text-base placeholder:not-italic placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={send}
                  disabled={busy || !input.trim()}
                  className="bg-primary text-primary-foreground rounded-sm px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
                >
                  Send
                </button>
              </div>

              {isAnon && messages.length >= 6 && (
                <div className="border hairline rounded-sm p-4 bg-muted/40">
                  <p className="font-serif italic text-base">
                    This read is yours. <Link to="/auth" className="text-primary underline-offset-4 hover:underline">Save it</Link> so we can pick this back up — and surface new side-by-sides later.
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
