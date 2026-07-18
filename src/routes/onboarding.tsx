import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  reactToOne,
  commitOpeningThree,
  recordEvent,
  startSession,
  nextPairing,
  recordChoice,
  skipPairing,
  finalizeSession,
  finalSynthesis,
  currentRead,
} from "@/lib/musicdna.functions";
import { getOnboardingOpener, type OnboardingOpener } from "@/lib/onboarding-openers.functions";
import { ensureAnonSession } from "@/lib/anon-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MusicDNA — Interview" },
      { name: "description", content: "The critic interviews you. Name three songs, then answer a few pairings — what you pick is the read." },
      { property: "og:title", content: "MusicDNA — Interview" },
      { property: "og:description", content: "The critic interviews you. What you pick is the read." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const MAX_ROUNDS = 6;

// LANE_LABEL removed — fork chip replaces the lane verdict.

const SLOT_LABELS = [
  "The one at the top",
  "Now #2",
  "And the third",
];
const PLACEHOLDERS = [
  "Ceremony — New Order",
  "Pyramid Song — Radiohead",
  "Untrue — Burial",
];

type Phase = "slot1" | "slot2" | "slot3" | "playing" | "done";
type Refined = { reaction?: string; hypothesis: string; lane: string; confidence: number; secondary_lanes?: string[]; observation?: string; fork?: string; stakes?: string };
type Song = { id: string; title: string; artist: string; year: number | null; lane: string };
type Pairing = {
  id: string; tests: string[]; hypothesis: string | null; why_good: string | null;
  diagnostic_weight: number; song_a: Song; song_b: Song;
};
type Entry = {
  round: number;
  pairing: Pairing;
  chosenSongId: string;
  reaction: string;
  thesis: string;
  hook: string;
  direction: "forming" | "holding" | "revising";
  topDim: string | null;
};


function LineReveal({
  lines,
  animate,
  intervalMs = 700,
  startDelayMs = 0,
  className,
}: {
  lines: string[];
  animate: boolean;
  intervalMs?: number;
  startDelayMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(animate ? 0 : lines.length);
  useEffect(() => {
    if (!animate) {
      setShown(lines.length);
      return;
    }
    setShown(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((_, idx) => {
      timers.push(setTimeout(() => setShown((s) => Math.max(s, idx + 1)), startDelayMs + idx * intervalMs));
    });
    return () => { for (const t of timers) clearTimeout(t); };
  }, [animate, lines.length, intervalMs, startDelayMs]);
  return (
    <div className={className}>
      {lines.slice(0, shown).map((line, i) => (
        <p key={i} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          {line}
        </p>
      ))}
    </div>
  );
}

function HomeLogo() {
  return (
    <Link
      to="/"
      className="fixed top-4 left-4 z-50 flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity"
      aria-label="MusicDNA — home / start over"
      title="Home / start over"
    >
      <img src="/music-dna-logo.png" alt="MusicDNA" className="h-12 w-auto" />
    </Link>
  );
}

function Onboarding() {
  const reactOneFn = useServerFn(reactToOne);
  const commitFn = useServerFn(commitOpeningThree);
  const logEvent = useServerFn(recordEvent);
  const getOpenerFn = useServerFn(getOnboardingOpener);
  const startFn = useServerFn(startSession);
  const nextFn = useServerFn(nextPairing);
  const chooseFn = useServerFn(recordChoice);
  const skipFn = useServerFn(skipPairing);
  const finalizeFn = useServerFn(finalizeSession);
  const synthFn = useServerFn(finalSynthesis);
  const readFn = useServerFn(currentRead);
  const navigate = useNavigate();

  type EventInput = {
    event_type:
      | "onboarding_viewed" | "onboarding_slot_submitted" | "onboarding_three_submitted" | "onboarding_classified"
      | "pairing_shown" | "choice_made" | "reveal_shown" | "reveal_continued"
      | "session_completed" | "result_viewed" | "result_shared" | "session_quit";
    session_id?: string | null;
    pairing_id?: string | null;
    choice_id?: string | null;
    response_time_ms?: number | null;
    props?: Record<string, unknown>;
    variant?: string;
  };
  const track = (e: EventInput) => { logEvent({ data: e } as never).catch(() => {}); };

  // phase + slot state
  const [phase, setPhase] = useState<Phase>("slot1");
  const [songs, setSongs] = useState<string[]>([]); // submitted, locked
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [reactions, setReactions] = useState<string[]>([]); // per-slot reaction text
  const [nextLabels, setNextLabels] = useState<(string | null)[]>([]); // personalized labels for slot 2 / slot 3
  const [refined, setRefined] = useState<Refined | null>(null);
  const [r5Step, setR5Step] = useState<0 | 1 | 2>(0);
  const [opener, setOpener] = useState<OnboardingOpener | null>(null);

  // play state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pendingSongId, setPendingSongId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [kept, setKept] = useState<Array<{ tradeoff: string; examples: string[]; supporting: number; tested: number }>>([]);
  const [counters, setCounters] = useState<Array<{ claim: string; notes: string }>>([]);
  const startedAt = useRef<number>(Date.now());
  const playStartedRef = useRef(false);
  const prevTopDim = useRef<string | null>(null);
  const slotAnchorRef = useRef<HTMLDivElement | null>(null);
  const pairingAnchorRef = useRef<HTMLDivElement | null>(null);
  const doneAnchorRef = useRef<HTMLDivElement | null>(null);

  // boot
  const [bootError, setBootError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureAnonSession();
        const o = (await getOpenerFn()) as OnboardingOpener;
        if (cancelled) return;
        setOpener(o);
        track({ event_type: "onboarding_viewed", variant: o.variant_key });
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reveal-final choreography (after slot 3)
  useEffect(() => {
    if (!refined) return;
    setR5Step(0);
    const t1 = setTimeout(() => setR5Step(1), 350);
    const t2 = setTimeout(() => setR5Step(2), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [refined]);

  // After reveal lands, auto-start the side-by-sides
  useEffect(() => {
    if (r5Step !== 2 || phase !== "playing" || playStartedRef.current) return;
    playStartedRef.current = true;
    (async () => {
      try {
        const { sessionId } = await startFn({});
        setSessionId(sessionId);
        const { pairing, round, selection_reason } = await nextFn({ data: { sessionId } }) as {
          pairing: Pairing | null; round: number; selection_reason?: unknown;
        };
        setPairing(pairing as unknown as Pairing | null);
        setRound(round);
        startedAt.current = Date.now();
        if (pairing) {
          track({
            event_type: "pairing_shown",
            session_id: sessionId,
            pairing_id: (pairing as unknown as Pairing).id,
            props: { round, tests: (pairing as unknown as Pairing).tests, selection_reason },
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start the side-by-sides.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r5Step, phase]);

  // scroll new active slot or pairing into view
  useEffect(() => {
    if ((phase === "slot2" || phase === "slot3") && slotAnchorRef.current) {
      setTimeout(() => slotAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    }
  }, [phase]);
  useEffect(() => {
    if (pairing && pairingAnchorRef.current) {
      pairingAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setPendingSongId(null);
  }, [pairing?.id]);
  useEffect(() => {
    if (phase === "done" && doneAnchorRef.current) {
      doneAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  async function submitSlot() {
    if (busy) return;
    const text = draft.trim();
    if (text.length < 2) {
      toast.error("Type a song first.");
      return;
    }
    const rank = songs.length + 1; // 1, 2, or 3
    setBusy(true);
    try {
      await ensureAnonSession();
      const nextSongs = [...songs, text];

      if (rank < 3) {
        // Short reaction, then reveal next slot.
        const r = (await reactOneFn({
          data: { song: text, index: rank - 1, priorSongs: songs },
        } as never)) as { text: string; nextLabel: string | null };
        setSongs(nextSongs);
        setDraft("");
        setReactions((prev) => [...prev, r.text]);
        setNextLabels((prev) => [...prev, r.nextLabel ?? null]);
        setPhase(rank === 1 ? "slot2" : "slot3");
        track({ event_type: "onboarding_slot_submitted", props: { rank } });
      } else {
        // Slot 3 — commit. Show a quick reaction first (from commit response),
        // then synthesis/hypothesis, then auto-start pairings.
        const r = (await commitFn({ data: { songs: nextSongs } } as never)) as {
          reaction: string;
          hypothesis: string;
          lane: string;
          confidence: number;
          secondary_lanes?: string[];
          observation?: string;
          fork?: string;
          stakes?: string;
        };
        setSongs(nextSongs);
        setDraft("");
        setReactions((prev) => [...prev, r.reaction]);
        setRefined({
          hypothesis: r.hypothesis,
          lane: r.lane,
          confidence: r.confidence,
          secondary_lanes: r.secondary_lanes ?? [],
          observation: r.observation,
          fork: r.fork,
          stakes: r.stakes,
        });
        setPhase("playing");
        track({ event_type: "onboarding_slot_submitted", props: { rank: 3 } });
        track({ event_type: "onboarding_three_submitted", variant: opener?.variant_key ?? "fallback" });
        track({
          event_type: "onboarding_classified",
          props: { lane: r.lane, confidence: r.confidence, song_count: 3 },
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(songId: string) {
    if (!pairing || !sessionId || busy) return;
    setPendingSongId(songId);
    setBusy(true);
    const ms = Math.min(600000, Date.now() - startedAt.current);
    const currentPairing = pairing;
    const currentRound = round;
    try {
      const { verdict, why, dim, delta } = await chooseFn({
        data: { sessionId, pairingId: currentPairing.id, chosenSongId: songId, msToDecide: ms },
      });
      const rejectedSongId = songId === currentPairing.song_a.id ? currentPairing.song_b.id : currentPairing.song_a.id;
      track({
        event_type: "choice_made",
        session_id: sessionId,
        pairing_id: currentPairing.id,
        response_time_ms: ms,
        props: { chosen_song_id: songId, rejected_song_id: rejectedSongId, top_dim: dim, delta, tests: currentPairing.tests },
      });

      let thesis = "Reading you now.";
      let hook = "";
      let topDim: string | null = null;
      try {
        const r = await readFn({ data: { sessionId } });
        thesis = r.thesis;
        hook = r.hook ?? "";
        topDim = r.topDim;
      } catch { /* keep default */ }

      const direction: Entry["direction"] =
        currentRound <= 1 || !prevTopDim.current
          ? "forming"
          : topDim && topDim === prevTopDim.current
            ? "holding"
            : topDim && topDim !== prevTopDim.current
              ? "revising"
              : "holding";
      prevTopDim.current = topDim ?? prevTopDim.current;

      const reaction = why ? `${verdict}\n${why}` : verdict;
      const entry: Entry = {
        round: currentRound, pairing: currentPairing, chosenSongId: songId,
        reaction, thesis, hook, direction, topDim,
      };
      setEntries((prev) => [...prev, entry]);
      setPairing(null);

      const { pairing: nxt, round: nr, done: isDone, selection_reason } = await nextFn({ data: { sessionId } }) as {
        pairing: Pairing | null; round: number; done: boolean; selection_reason?: unknown;
      };
      if (isDone || !nxt || nr > MAX_ROUNDS) {
        try {
          await finalizeFn({ data: { sessionId } });
        } catch (e) {
          console.error("finalizeSession failed", e);
        }
        track({ event_type: "session_completed", session_id: sessionId, props: { rounds: nr } });
        try {
          const r = await synthFn({ data: { sessionId } }) as {
            synthesis: string;
            kept_choosing: Array<{ tradeoff: string; examples: string[]; supporting: number; tested: number }>;
            counter_reads: Array<{ claim: string; notes: string }>;
          };
          setSynthesis(r.synthesis);
          setKept(r.kept_choosing ?? []);
          setCounters((r.counter_reads ?? []).map((c) => ({ claim: c.claim, notes: c.notes })));
        } catch (e) {
          console.error("finalSynthesis failed", e);
        }
        setPhase("done");
        setBusy(false);
        return;
      }
      setPairing(nxt as unknown as Pairing);
      setRound(nr);
      startedAt.current = Date.now();
      track({
        event_type: "pairing_shown",
        session_id: sessionId,
        pairing_id: (nxt as unknown as Pairing).id,
        props: { round: nr, tests: (nxt as unknown as Pairing).tests, selection_reason },
      });
      setBusy(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Choice failed.");
      setBusy(false);
    }
  }

  async function skip() {
    if (!pairing || !sessionId || busy) return;
    setBusy(true);
    const ms = Math.min(600000, Date.now() - startedAt.current);
    const currentPairing = pairing;
    try {
      await skipFn({ data: { sessionId, pairingId: currentPairing.id, msToDecide: ms } });
      track({
        event_type: "pairing_shown",
        session_id: sessionId,
        pairing_id: currentPairing.id,
        response_time_ms: ms,
        props: { skipped: true },
      });
      setPairing(null);
      const { pairing: nxt, round: nr, done: isDone, selection_reason } = await nextFn({ data: { sessionId } }) as {
        pairing: Pairing | null; round: number; done: boolean; selection_reason?: unknown;
      };
      if (isDone || !nxt || nr > MAX_ROUNDS) {
        try { await finalizeFn({ data: { sessionId } }); } catch (e) { console.error("finalizeSession failed", e); }
        setPhase("done");
        setBusy(false);
        return;
      }
      setPairing(nxt as unknown as Pairing);
      setRound(nr);
      startedAt.current = Date.now();
      track({
        event_type: "pairing_shown",
        session_id: sessionId,
        pairing_id: (nxt as unknown as Pairing).id,
        props: { round: nr, tests: (nxt as unknown as Pairing).tests, selection_reason, after_skip: true },
      });
      setBusy(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Skip failed.");
      setBusy(false);
    }
  }


  if (bootError) {
    return (
      <>
      <HomeLogo />
      <main className="mx-auto max-w-2xl px-6 pt-24 text-center space-y-4">
        <p className="eyebrow">can't start a session</p>
        <p className="font-serif text-xl text-muted-foreground">{bootError}</p>
      </main>
      </>
    );
  }

  // INITIAL: cold open — single slot only
  if (phase === "slot1") {
    return (
    <>
    <HomeLogo />
    <main className="mx-auto max-w-2xl px-6 pt-24 pb-24 min-h-screen flex flex-col">
      <section className="space-y-16 animate-in fade-in duration-500">
        <header className="space-y-4 text-center sm:text-left">
          <p className="eyebrow">YOUR SONGS · RANKED</p>
          <h1 className="display text-4xl md:text-5xl leading-[1.05] tracking-tight">
            What's YOUR greatest song of all time?
            <br />
            <span className="italic text-muted-foreground">Don't be shy...</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-md text-center sm:text-left">
            Start with #1 — and we'll see what makes YOU tick.
          </p>
        </header>

        <div className="space-y-8">
          <RankedInput
            rank={1}
            label={SLOT_LABELS[0]}
            value={draft}
            placeholder={PLACEHOLDERS[0]}
            onChange={setDraft}
            autoFocus
            onEnter={submitSlot}
          />
        </div>

        <div className="flex justify-center sm:justify-start">
          <button
            onClick={submitSlot}
            disabled={busy || draft.trim().length < 2}
            className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Reading…" : "→"}
          </button>
        </div>
      </section>
    </main>
    </>
    );
  }

  // TRANSCRIPT: slot2 → slot3 → playing → done in one continuous scroll
  return (
    <>
    <HomeLogo />
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-24 space-y-12">
      <header className="space-y-2">
        <p className="eyebrow">the interview</p>
      </header>

      {/* Submitted songs + their reactions, interleaved */}
      <section className="space-y-8">
        {songs.map((s, i) => (
          <div key={i} className="space-y-3 animate-in fade-in duration-500">
            <div className="grid grid-cols-[3rem_1fr] gap-4 items-baseline">
              <span className="text-right font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                #{i + 1}
              </span>
              <span className="font-mono text-base md:text-lg text-foreground">✓ {s}</span>
            </div>
            {reactions[i] && i < 2 && (
              <div className="pl-[4rem]">
                <p className="font-serif text-xl md:text-2xl leading-snug text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {reactions[i]}
                </p>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Active slot input — slot2 or slot3 */}
      {(phase === "slot2" || phase === "slot3") && (
        <section ref={slotAnchorRef} className="space-y-6 animate-in fade-in duration-500">
          {phase === "slot2" && (
            <p className="font-serif italic text-xl md:text-2xl text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-500">
              now give me one more
            </p>
          )}
          <div className="space-y-6">
            <RankedInput
              key={phase}
              rank={songs.length + 1}
              label={nextLabels[songs.length - 1] || SLOT_LABELS[songs.length] || ""}
              value={draft}
              placeholder={PLACEHOLDERS[songs.length] ?? ""}
              onChange={setDraft}
              autoFocus
              onEnter={submitSlot}
            />
          </div>
          <div>
            <button
              onClick={submitSlot}
              disabled={busy || draft.trim().length < 2}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Reading…" : "→"}
            </button>
          </div>
        </section>
      )}

      {/* Post-3 read — one short conversational observation. No fork, no stakes, no axis talk. */}
      {refined && (
        <section className="space-y-3 animate-in fade-in duration-500">
          {r5Step >= 2 && (
            <>
              <p className="eyebrow text-primary">working theory</p>
              <p className="font-serif text-2xl md:text-3xl leading-snug text-foreground animate-in fade-in duration-700">
                {refined.observation || refined.hypothesis}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground pt-1">
                next one coming up…
              </p>
            </>
          )}
        </section>
      )}

      {entries.length > 0 && (
        <div className="space-y-10">
          {entries.map((e, i) => {
            const isLatest = i === entries.length - 1;
            const reactionLines = e.reaction.split("\n").map((s) => s.trim()).filter(Boolean);
            const thesisFirst = (e.thesis.split("\n").map((s) => s.trim()).filter(Boolean)[0]) ?? "";
            return (
              <article key={e.round} className="space-y-4">
                <LineReveal
                  lines={reactionLines}
                  animate={isLatest}
                  intervalMs={700}
                  className="font-serif text-lg md:text-xl leading-snug text-foreground"
                />
                {thesisFirst && (
                  <LineReveal
                    lines={[thesisFirst]}
                    animate={isLatest}
                    startDelayMs={isLatest ? reactionLines.length * 700 + 250 : 0}
                    intervalMs={700}
                    className="font-serif italic text-base md:text-lg text-foreground/90 leading-snug border-l-2 border-primary/40 pl-4 py-1"
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Current pairing */}
      {pairing && phase === "playing" && (
        <section ref={pairingAnchorRef} className="space-y-6 pt-2">
          <div className="flex items-center">
            <p className="eyebrow">Round {String(round).padStart(2, "0")} / {MAX_ROUNDS}</p>
            <div className="h-px flex-1 ml-6 bg-border" />
          </div>
          <p className="font-serif text-xl md:text-2xl text-muted-foreground">
            {entries.length === 0 ? "Pick one. Don't overthink it." : "Next one — go with your gut."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-sm overflow-hidden">
            {[pairing.song_a, pairing.song_b].map((song) => {
              const isPending = pendingSongId === song.id;
              const isDimmed = busy && pendingSongId !== null && !isPending;
              return (
                <button
                  key={song.id}
                  disabled={busy}
                  onClick={() => pick(song.id)}
                  className={`group p-8 md:p-12 text-left transition-colors ${
                    isPending
                      ? "bg-background ring-1 ring-primary/60"
                      : isDimmed
                        ? "bg-surface opacity-40"
                        : "bg-surface hover:bg-background"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                    {song.lane}{song.year ? ` · ${song.year}` : ""}
                  </p>
                  <p className="font-serif text-2xl md:text-3xl text-foreground leading-tight mb-2">{song.title}</p>
                  <p className="text-sm text-muted-foreground">{song.artist}</p>
                </button>
              );
            })}
          </div>
          <div className="flex justify-center pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={skip}
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              Skip — I don't know these
            </button>
          </div>
        </section>
      )}

      {busy && !pairing && phase === "playing" && (
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Thinking…
        </p>
      )}

      {/* Final report */}
      {phase === "done" && (
        <section ref={doneAnchorRef} className="space-y-14 pt-6 animate-in fade-in duration-700">
          <header className="space-y-3">
            <p className="eyebrow">the read</p>
            <h2 className="display text-3xl md:text-4xl leading-tight">What you kept choosing.</h2>
          </header>

          {kept.length > 0 ? (
            <section className="space-y-5">
              <p className="eyebrow">evidence</p>
              <ul className="space-y-4">
                {kept.map((k, i) => (
                  <li key={i} className="border-l-2 border-primary/40 pl-5 space-y-2">
                    <p className="font-serif text-xl md:text-2xl leading-snug">
                      You repeatedly favored <span className="italic">{k.tradeoff}</span>.
                    </p>
                    {k.examples.length > 0 && (
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {k.examples.join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="space-y-3">
              <p className="eyebrow">the finding</p>
              <p className="font-serif text-xl md:text-2xl italic text-muted-foreground leading-snug">
                You refused to collapse into a single pattern. Every time a clear read started to form, another pick complicated it. Broad ear — not random.
              </p>
            </section>
          )}

          {synthesis && (
            <section className="space-y-3">
              <p className="eyebrow">what this might mean</p>
              <p className="font-serif text-2xl md:text-3xl leading-snug border-l-2 border-primary pl-6 italic">
                {synthesis}
              </p>
            </section>
          )}

          {counters.length > 0 && (
            <section className="space-y-3">
              <p className="eyebrow">other possible explanations</p>
              <ul className="space-y-2">
                {counters.map((c, i) => (
                  <li key={i} className="text-sm md:text-base text-muted-foreground">
                    <span className="font-serif italic text-foreground">{c.claim}</span>
                    {c.notes && <span className="block font-mono text-[11px] uppercase tracking-[0.22em] mt-1">{c.notes}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={() => navigate({ to: "/me" })}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
            >
              Push back on this →
            </button>
            <button
              onClick={() => navigate({ to: "/profile" })}
              className="border hairline-strong rounded-sm px-6 py-3 text-sm font-medium hover:bg-muted/40"
            >
              See your full reading
            </button>
          </div>
        </section>
      )}
    </main>
    </>
  );
}

function RankedInput({
  rank, label, value, placeholder, onChange, onEnter, autoFocus,
}: {
  rank: number; label: string; value: string; placeholder: string;
  onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 items-baseline">
      <div className="text-right">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">#{rank}</p>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">{label}</p>
        <div className="border-b-2 hairline-strong focus-within:border-primary transition-colors pb-1">
          <input
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-xl md:text-2xl font-serif italic py-2 placeholder:text-muted-foreground/40 placeholder:not-italic placeholder:font-serif focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
