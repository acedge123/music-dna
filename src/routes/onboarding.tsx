import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useInterview } from "@/hooks/use-interview";
import { ReadingResult } from "@/components/musicdna/reading-result";
import { InterviewHistory } from "@/components/musicdna/interview-history";
import { OpeningSongInput as RankedInput } from "@/components/musicdna/opening-song-input";
import { SongChoices } from "@/components/musicdna/song-choices";
import { Button } from "@/components/ui/button";
import { ArrowRight, Share2, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  validateSearch: (search) => z.object({ session: z.string().uuid().optional() }).parse(search),
  head: () => ({
    meta: [
      { title: "MusicDNA — Interview" },
      {
        name: "description",
        content:
          "The critic interviews you. Name three songs, then answer a few pairings — what you pick is the read.",
      },
      { property: "og:title", content: "MusicDNA — Interview" },
      {
        property: "og:description",
        content: "The critic interviews you. What you pick is the read.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

// LANE_LABEL removed — fork chip replaces the lane verdict.

const SLOT_LABELS = ["The one at the top", "Now #2", "And the third"];
const PLACEHOLDERS = ["Ceremony — New Order", "Pyramid Song — Radiohead", "Untrue — Burial"];

function HomeLogo() {
  return (
    <Link
      to="/"
      className="absolute top-4 left-5 z-10 flex min-h-11 items-center gap-2 opacity-80 transition-opacity hover:opacity-100"
      aria-label="MusicDNA — home / start over"
      title="Home / start over"
    >
      <img src="/music-dna-logo.png" alt="MusicDNA" className="h-12 w-auto" />
    </Link>
  );
}

function Onboarding() {
  const { session } = Route.useSearch();
  const navigate = useNavigate();
  const {
    phase,
    songs,
    draft,
    setDraft,
    busy,
    reactions,
    nextLabels,
    refined,
    sessionId,
    pairing,
    pendingSongId,
    pendingSkip,
    flowError,
    resultError,
    resultVersion,
    shareBusy,
    round,
    maxRounds,
    nextPrompt,
    reactedRounds,
    reactionReply,
    entries,
    synthesis,
    kept,
    counters,
    slotAnchorRef,
    pairingAnchorRef,
    doneAnchorRef,
    bootError,
    booting,
    submitSlot,
    pick,
    reactToRead,
    shareRead,
    skip,
    loadFinalRead,
  } = useInterview(session);
  if (booting)
    return (
      <>
        <HomeLogo />
        <main className="mx-auto max-w-2xl px-5 pt-28">
          <p role="status" className="font-serif text-xl text-muted-foreground">
            Opening your interview…
          </p>
        </main>
      </>
    );

  if (bootError) {
    return (
      <>
        <HomeLogo />
        <main className="mx-auto max-w-2xl px-6 pt-24 text-center space-y-4">
          <p className="eyebrow">can't start a session</p>
          <p role="alert" className="font-serif text-xl text-muted-foreground">
            {bootError}
          </p>
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-sm border hairline-strong px-5 py-3 text-sm"
          >
            Try again
          </Button>
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
              <p className="eyebrow">YOUR SONGS · 1 / 3</p>
              <h1 className="display text-4xl md:text-5xl leading-[1.05] tracking-normal">
                What's your greatest song of all time?
                <br />
                <span className="italic text-muted-foreground">Don't be shy...</span>
              </h1>
              <p className="text-sm text-muted-foreground max-w-md text-center sm:text-left">
                First song. No committee. Just you.
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
              <Button
                onClick={submitSlot}
                disabled={busy || draft.trim().length < 2}
                className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Reading…" : <>Continue <ArrowRight /></>}
              </Button>
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
      <main className="mx-auto max-w-4xl px-5 pt-24 pb-16 space-y-6 sm:px-6">
        <h1 className="sr-only">Your MusicDNA interview</h1>
        {(phase === "slot2" || phase === "slot3") && (
          <section className="max-w-2xl space-y-5">
            <p className="eyebrow">Your songs · {songs.length + 1} / 3</p>
            <p className="font-mono text-sm text-muted-foreground">#{songs.length} · {songs.at(-1)}</p>
            {reactions.at(-1) && <p className="font-serif text-3xl leading-snug">{reactions.at(-1)}</p>}
            <details className="text-sm text-muted-foreground">
              <summary className="min-h-11 cursor-pointer py-3">Your opening songs</summary>
              <ol className="space-y-2">{songs.map((song, i) => <li key={`${i}:${song}`}>#{i + 1} · {song}</li>)}</ol>
            </details>
          </section>
        )}

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
              <Button
                onClick={submitSlot}
                disabled={busy || draft.trim().length < 2}
                className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Reading…" : <>Continue <ArrowRight /></>}
              </Button>
            </div>
          </section>
        )}

        {phase === "playing" && (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <p className="eyebrow">The interview</p>
              <div className="flex items-center gap-3" aria-label={`${entries.length} of up to ${maxRounds} choices answered`}>
                <span className="font-mono text-xs text-muted-foreground">{pairing ? `Round ${round} / ${maxRounds}` : `${entries.length} / ${maxRounds}`}</span>
                <div className="flex gap-1.5" aria-hidden="true">{Array.from({ length: maxRounds }, (_, i) => <span key={i} className={`h-1.5 w-4 rounded-sm ${i < entries.length ? "bg-gold" : "bg-muted"}`} />)}</div>
              </div>
            </header>
            {entries.length === 0 && refined && <p className="max-w-2xl font-serif text-2xl leading-snug">{refined.observation || refined.hypothesis}</p>}
            <InterviewHistory entries={entries} openerSongs={songs} allowReactions={!!pairing} reactedRounds={reactedRounds}
              reactionReply={reactionReply} busy={busy || pendingSongId !== null || pendingSkip !== null} onReact={(kind) => void reactToRead(kind)} />
          </>
        )}

        {/* Current pairing */}
        {pairing && phase === "playing" && (
          <section ref={pairingAnchorRef} className="space-y-4 pt-2">
            <p className="font-serif text-2xl md:text-3xl">
              {entries.length === 0
                ? "Pick one. First instinct."
                : nextPrompt || "Which one would you keep?"}
            </p>
            <SongChoices
              songs={[pairing.song_a, pairing.song_b]}
              selectedId={pendingSongId}
              busy={busy || pendingSkip !== null}
              onChoose={(id) => void pick(id)}
            />
            {busy && (
              <p role="status" className="text-sm text-muted-foreground">
                Saving your choice…
              </p>
            )}
            {flowError && (
              <p role="alert" className="text-sm leading-relaxed text-foreground">
                {flowError}
              </p>
            )}
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                disabled={busy || pendingSongId !== null}
                onClick={skip}
                className="min-h-11 px-3 py-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {pendingSkip ? "Retry this skip" : "Skip — I don’t know these"}
              </Button>
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
            {resultError ? (
              <div className="space-y-4">
                <p role="alert" className="text-sm">
                  {resultError}
                </p>
                <Button
                  type="button"
                  onClick={() => void loadFinalRead()}
                  className="min-h-11 rounded-sm border hairline-strong px-5 py-3"
                >
                  Retry saved reading
                </Button>
              </div>
            ) : (
              <ReadingResult
                content={{
                  synthesis: synthesis ?? "",
                  kept_choosing: kept,
                  counter_reads: counters,
                  result_version: resultVersion,
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    disabled={resultVersion == null}
                    onClick={() =>
                      navigate({
                        to: "/me",
                        search: {
                          session: sessionId ?? undefined,
                          version: resultVersion ?? undefined,
                        },
                      })
                    }
                    className="min-h-11 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    <MessageCircle /> Argue with me
                  </Button>
                  <Button
                    type="button"
                    disabled={shareBusy || resultVersion == null}
                    onClick={() => void shareRead()}
                    className="min-h-11 rounded-sm border hairline-strong px-5 py-3 text-sm disabled:opacity-50"
                  >
                    <Share2 /> {shareBusy ? "Preparing share…" : "Share this read"}
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Sharing publishes this reading only. Your conversation stays private.
                </p>
              </ReadingResult>
            )}
          </section>
        )}
      </main>
    </>
  );
}
