import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { reactToOne, reactToThree, refineWithTwoMore, recordEvent } from "@/lib/musicdna.functions";
import { listDecadePromptsPublic } from "@/lib/decade-prompts.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/1980")({
  head: () => ({
    meta: [
      { title: "MusicDNA — The 1980s" },
      { name: "description", content: "Five songs from the '80s. One read on you." },
    ],
  }),
  component: NineteenEighty,
});

const DECADE = "80s" as const;
const DECADE_LABEL = "the 1980s";

const LANE_LABEL: Record<string, string> = {
  alternative: "Alternative",
  pop: "Pop",
  hip_hop: "Hip-Hop",
  electronic: "Electronic",
  classic_rock: "Classic Rock",
  metal: "Metal",
  r_and_b: "R&B / Soul",
  general: "General",
};

// Fallback question sequence — used if the DB hasn't been seeded yet.
const FALLBACK_PROMPTS: string[] = [
  "What song still sounds like the future?",
  "What song still feels like midnight?",
  "What song would you rescue from a box of old mixtapes?",
  "What song takes you back the fastest?",
  "What song never left you, even when the decade did?",
];

const PLACEHOLDERS: string[] = [
  "Blue Monday — New Order",
  "Once In A Lifetime — Talking Heads",
  "Just Like Heaven — The Cure",
  "Running Up That Hill — Kate Bush",
  "Where Is My Mind — Pixies",
];

type Exchange = {
  prompt: string;
  song: string;
  reaction?: string;
  hypothesis?: string;
};

function NineteenEighty() {
  const reactOneFn = useServerFn(reactToOne);
  const reactThreeFn = useServerFn(reactToThree);
  const refineFn = useServerFn(refineWithTwoMore);
  const logEvent = useServerFn(recordEvent);
  const listPromptsFn = useServerFn(listDecadePromptsPublic);
  const navigate = useNavigate();

  // Pull all 80s prompts (ordered). Active one first, then the rest in position order.
  const promptsQuery = useQuery({
    queryKey: ["decade-prompts", DECADE],
    queryFn: () => listPromptsFn({ data: { decade: DECADE } }),
    staleTime: 5 * 60_000,
  });

  const PROMPTS: string[] = (() => {
    const rows = promptsQuery.data?.rows ?? [];
    if (rows.length === 0) return FALLBACK_PROMPTS;
    const active = rows.filter((r) => r.is_active).map((r) => r.text);
    const rest = rows.filter((r) => !r.is_active).map((r) => r.text);
    const ordered = [...active, ...rest];
    // Pad with fallbacks if fewer than 5
    while (ordered.length < 5) ordered.push(FALLBACK_PROMPTS[ordered.length]);
    return ordered.slice(0, 5);
  })();

  const [history, setHistory] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  type RevealStage = "thinking" | "preamble" | "observation";
  type ShippedClaim = {
    text: string;
    status: "tentative" | "strengthening" | "stable";
    competing_explanation: string;
  };
  type FinalRead = {
    lane: string;
    hypothesis: string;
    reaction?: string;
    claims: ShippedClaim[];
    stillLearning: boolean;
  };
  type Pending = {
    prompt: string;
    song: string;
    reaction?: string;
    hypothesis?: string;
    stage: RevealStage;
    final?: FinalRead;
  };
  const [pending, setPending] = useState<Pending | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const idx = history.length;

  useEffect(() => {
    if (!busy && !pending) inputRef.current?.focus();
  }, [busy, pending, idx]);

  useEffect(() => {
    if (!pending) return;
    if (pending.stage === "thinking" && pending.reaction) {
      const t1 = setTimeout(() => setPending((p) => (p ? { ...p, stage: "preamble" } : p)), 350);
      return () => clearTimeout(t1);
    }
    if (pending.stage === "preamble") {
      const t2 = setTimeout(() => setPending((p) => (p ? { ...p, stage: "observation" } : p)), 750);
      return () => clearTimeout(t2);
    }
    if (pending.stage === "observation" && pending.reaction && !pending.final) {
      const wordCount = (pending.reaction + " " + (pending.hypothesis ?? "")).split(/\s+/).length;
      const ms = Math.min(4200, Math.max(1800, 350 * wordCount));
      const t3 = setTimeout(() => commitAndAdvance(), ms);
      return () => clearTimeout(t3);
    }
  }, [pending]);

  async function handleSubmit() {
    const value = input.trim();
    if (value.length < 2 || busy || pending) return;

    const currentIdx = idx;
    const currentPrompt = PROMPTS[currentIdx];
    setBusy(true);
    setInput("");
    setPending({ prompt: currentPrompt, song: value, stage: "thinking" });

    try {
      if (currentIdx < 2) {
        const r = await reactOneFn({
          data: { song: value, index: currentIdx, priorSongs: history.map((h) => h.song) },
        });
        setPending((p) => (p ? { ...p, reaction: r.text } : p));
      } else if (currentIdx === 2) {
        const songs = [...history.map((h) => h.song), value] as [string, string, string];
        const r = await reactThreeFn({ data: { songs } });
        setPending((p) => (p ? { ...p, reaction: r.reaction, hypothesis: r.hypothesis_v1 } : p));
      } else if (currentIdx === 3) {
        const r = await reactOneFn({
          data: { song: value, index: 3, priorSongs: history.map((h) => h.song) },
        });
        setPending((p) => (p ? { ...p, reaction: r.text } : p));
      } else {
        const allSongs = [...history.map((h) => h.song), value];
        type ShippedClaim = {
          text: string;
          status: "tentative" | "strengthening" | "stable";
          competing_explanation: string;
        };
        const r = (await refineFn({
          data: {
            firstThree: allSongs.slice(0, 3),
            twoMore: allSongs.slice(3, 5),
          },
        } as never)) as {
          reaction?: string;
          hypothesis: string;
          lane: string;
          confidence: number;
          claims?: ShippedClaim[];
          stillLearning?: boolean;
        };
        const reaction = r.reaction ?? "That's enough. Here's where I've landed.";
        setPending((p) =>
          p
            ? {
                ...p,
                reaction,
                final: {
                  lane: r.lane,
                  hypothesis: r.hypothesis,
                  reaction: r.reaction,
                  claims: r.claims ?? [],
                  stillLearning: r.stillLearning ?? true,
                },
              }
            : p,
        );
        logEvent({
          data: {
            event_type: "onboarding_classified",
            props: {
              lane: r.lane,
              confidence: r.confidence,
              song_count: 5,
              decade: DECADE,
              reasoning: { claims: r.claims ?? [], stillLearning: r.stillLearning ?? true },
            },
          },
        } as never).catch(() => {});
      }
    } catch (e) {
      setPending(null);
      setInput(value);
      toast.error(e instanceof Error ? e.message : "Couldn't read that one.");
    } finally {
      setBusy(false);
    }
  }

  function commitAndAdvance() {
    if (!pending || !pending.reaction) return;
    if (pending.final) {
      setHistory((h) => [
        ...h,
        { prompt: pending.prompt, song: pending.song, reaction: pending.reaction },
      ]);
      setDone(pending.final);
      setPending(null);
      return;
    }
    setHistory((h) => [
      ...h,
      {
        prompt: pending.prompt,
        song: pending.song,
        reaction: pending.reaction,
        hypothesis: pending.hypothesis,
      },
    ]);
    setPending(null);
  }

  const [done, setDone] = useState<FinalRead | null>(null);

  const showingQuestion = !done && !pending;
  const activePrompt = showingQuestion ? PROMPTS[idx] : null;
  const counter = `${String(Math.min(idx + 1, 5)).padStart(2, "0")} / 05`;
  const isFinalPending = pending?.final != null;
  const nextLabel = isFinalPending
    ? "See what I think →"
    : idx + 1 >= 5
      ? "Finish →"
      : "Next question →";

  return (
    <main className="mx-auto max-w-2xl px-6 pt-16 pb-24 min-h-screen flex flex-col">
      {/* DECADE BADGE */}
      <div className="mb-10 flex items-baseline justify-between">
        <p className="eyebrow text-primary">1980 — 1989</p>
        <p className="eyebrow text-muted-foreground">{DECADE_LABEL}</p>
      </div>

      {/* CONVERSATION LOG — oldest first, fading as it ages */}
      {history.length > 0 && !done && (
        <section className="space-y-10 mb-12">
          {history.map((h, i) => {
            const age = history.length - 1 - i;
            const opacity = Math.max(0.35, 1 - age * 0.18);
            return (
              <article
                key={i}
                style={{ opacity }}
                className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-500"
              >
                <p className="eyebrow text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · {h.prompt}
                </p>
                <p className="font-mono text-base md:text-lg text-foreground">✓ {h.song}</p>
                {h.reaction && (
                  <p className="font-serif text-xl md:text-2xl leading-snug italic text-primary/90">
                    {h.reaction}
                  </p>
                )}
                {h.hypothesis && (
                  <div className="mt-3 border-l-2 border-primary/60 pl-4 py-1">
                    <p className="eyebrow mb-1">working hypothesis</p>
                    <p className="font-serif text-lg italic">"{h.hypothesis}"</p>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* ACTIVE QUESTION */}
      {activePrompt && (
        <section className="space-y-6 animate-in fade-in duration-700">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">{counter}</p>
            {history.length > 0 && <p className="eyebrow text-muted-foreground">listening</p>}
          </div>

          <h1
            key={idx}
            className="display text-4xl md:text-5xl leading-[1.05] tracking-tight animate-in fade-in slide-in-from-bottom-1 duration-500"
          >
            {activePrompt}
          </h1>

          <div className="border-b-2 hairline-strong focus-within:border-primary transition-colors pb-1">
            <input
              ref={inputRef}
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={PLACEHOLDERS[Math.min(idx, PLACEHOLDERS.length - 1)]}
              className="w-full bg-transparent text-2xl md:text-3xl font-serif italic py-2 placeholder:text-muted-foreground/40 placeholder:not-italic placeholder:font-serif focus:outline-none disabled:opacity-50"
              autoFocus
            />
          </div>

          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {input.trim().length >= 2
              ? "press enter"
              : idx === 0
                ? "start anywhere in the decade"
                : "keep going"}
          </p>
        </section>
      )}

      {/* REVEAL */}
      {pending && (
        <section className="space-y-8 animate-in fade-in duration-500">
          <p className="eyebrow">{counter}</p>

          <p className="font-mono text-lg md:text-xl text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
            ✓ {pending.song}
          </p>

          {pending.stage === "thinking" && (
            <p className="font-mono text-sm uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-2">
              listening
              <span className="inline-flex gap-1 text-primary">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>
                  ·
                </span>
                <span className="animate-bounce" style={{ animationDelay: "120ms" }}>
                  ·
                </span>
                <span className="animate-bounce" style={{ animationDelay: "240ms" }}>
                  ·
                </span>
              </span>
            </p>
          )}

          {(pending.stage === "preamble" || pending.stage === "observation") && (
            <p className="font-serif italic text-3xl md:text-4xl text-primary animate-in fade-in slide-in-from-bottom-2 duration-500">
              Interesting…
            </p>
          )}

          {pending.stage === "observation" && pending.reaction && (
            <p className="font-serif text-2xl md:text-3xl leading-snug text-foreground animate-in fade-in slide-in-from-bottom-2 duration-700">
              {pending.reaction}
            </p>
          )}

          {pending.stage === "observation" && pending.hypothesis && (
            <div className="border-l-2 border-primary/60 pl-4 py-1 animate-in fade-in duration-700">
              <p className="eyebrow mb-1">working hypothesis</p>
              <p className="font-serif text-lg italic">"{pending.hypothesis}"</p>
            </div>
          )}

          {pending.stage === "observation" && pending.final && (
            <div className="pt-4 animate-in fade-in duration-500">
              <button
                onClick={commitAndAdvance}
                className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
                autoFocus
              >
                {nextLabel}
              </button>
            </div>
          )}
        </section>
      )}

      {/* FINAL PAYOFF — one claim or the still-learning state. No percentages. */}
      {done &&
        (() => {
          const claim = done.claims[0];
          const statusLabel = !claim
            ? "still learning"
            : claim.status === "stable"
              ? "pretty confident"
              : claim.status === "strengthening"
                ? "starting to think"
                : "working theory";
          return (
            <section className="space-y-8 animate-in fade-in duration-700">
              <p className="eyebrow">that's enough</p>
              {done.reaction && (
                <p className="font-serif text-2xl md:text-3xl leading-snug">{done.reaction}</p>
              )}

              {claim ? (
                <div className="space-y-3">
                  <p className="eyebrow text-primary">{statusLabel}</p>
                  <p className="display text-3xl md:text-4xl leading-[1.1] italic text-primary">
                    "{claim.text}"
                  </p>
                  <p className="font-serif text-base md:text-lg italic text-muted-foreground leading-snug">
                    {claim.competing_explanation}. Let's see if that survives.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="eyebrow text-muted-foreground">{statusLabel}</p>
                  <p className="display text-2xl md:text-3xl leading-[1.15] italic text-foreground">
                    Not enough to call it yet.
                  </p>
                  <p className="font-serif text-base md:text-lg italic text-muted-foreground leading-snug">
                    Five picks, no thread I trust. The matchups will do the work.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Lane
                </span>
                <span className="border hairline-strong rounded-sm px-3 py-1 text-sm font-medium">
                  {LANE_LABEL[done.lane] ?? done.lane}
                </span>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate({ to: "/onboarding" })}
                  className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
                >
                  Let's test that →
                </button>
              </div>
            </section>
          );
        })()}
    </main>
  );
}
