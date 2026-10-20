// Local Vite review tool. Uses the production presentation components and frozen
// shared fixtures; it is not a production route or deployed behavior evidence.
import React, { useEffect, useState } from "react";
import "../../src/styles.css";
import suite from "../../fixtures/musicdna/product-parity-v1.json";
import { buildLedger, type LedgerChoice } from "../../src/musicdna/engine/evidence";
import { projectRead } from "../../src/musicdna/engine/read";
import { OpeningSongInput } from "../../src/components/musicdna/opening-song-input";
import { SongChoices } from "../../src/components/musicdna/song-choices";
import { ReadMoment } from "../../src/components/musicdna/read-moment";
import { ReadingResult } from "../../src/components/musicdna/reading-result";
import { InterviewExchange } from "../../src/components/musicdna/interview-history";
import { ReadingConversation } from "../../src/components/musicdna/reading-conversation";
import type { Entry, Pairing } from "../../src/lib/interview-model";

const labels = { scale: { hi: "larger-scale arrangements", lo: "smaller-scale arrangements" } };
const states = [
  "opener",
  "selected",
  "feedback",
  "theory",
  "revision",
  "result",
  "pushback",
  "public-share",
];
const pairing = suite.catalog[0];
const long = suite.sessions.long_titles.choices[0];
const songs = [long.chosen, long.rejected];
const theory = projectRead(
  buildLedger(suite.sessions.stable.choices.slice(0, 2) as LedgerChoice[], suite.dims),
  labels,
);
const revision = projectRead(
  buildLedger(suite.sessions.reversal.choices as LedgerChoice[], suite.dims),
  labels,
  { axis: "scale", direction: "hi", tier: "theory", thesis: theory.thesis },
);
const cached = suite.responses.stable.result;
const result = {
  synthesis: cached.headline,
  kept_choosing: cached.supporting_choices,
  counter_reads: [],
  result_version: cached.result_version,
};
const feedback: Entry = {
  round: 1,
  pairing: { ...pairing, hypothesis: null, why_good: null } as Pairing,
  chosenSongId: pairing.song_a.id,
  reaction: `${pairing.song_a.title} over ${pairing.song_b.title}.\nChoice noted. A pattern needs independent evidence.`,
  thesis: "",
  hook: "",
  direction: "forming",
  topDim: null,
  tier: "observation",
  question: "",
};
export function Reference() {
  const params = new URLSearchParams(location.search);
  const state = states.includes(params.get("state") ?? "") ? params.get("state")! : "opener";
  const capture = params.get("capture") === "1";
  const largeText = params.get("text") === "200";
  useEffect(() => {
    const original = document.documentElement.style.fontSize;
    if (largeText) document.documentElement.style.fontSize = "200%";
    return () => {
      document.documentElement.style.fontSize = original;
    };
  }, [largeText]);

  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string | null>(
    state === "selected" ? songs[0].id : null,
  );
  const [message, setMessage] = useState(
    "The reading fits some choices, but I don't always want a bigger sound.",
  );
  return (
    <>
      {!capture && (
        <aside
          style={{
            padding: 16,
            borderBottom: "1px solid var(--border-strong)",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
          }}
        >
          <strong>TGA-314 · review fixtures</strong>
          <p style={{ margin: "8px 0" }}>
            Same production components; synthetic fixture content, not live endpoint evidence.
            Choose a state, then use your browser’s Back button to return.
          </p>
          <nav aria-label="Reference states" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {states.map((s) => (
              <a
                key={s}
                href={`/reference?state=${s}`}
                aria-current={s === state ? "page" : undefined}
              >
                {s === state ? "● " : ""}
                {s}
              </a>
            ))}
          </nav>
        </aside>
      )}
      {!capture ? (
        <iframe
          title="Phone reference preview"
          src={`/reference?state=${state}&capture=1`}
          style={{
            display: "block",
            width: 390,
            maxWidth: "100%",
            height: 844,
            margin: "24px auto",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
          }}
        />
      ) : (
        <main
          id="reference-canvas"
          className="mx-auto min-h-dvh max-w-2xl space-y-8 px-5 pb-16 pt-6 sm:px-6"
        >
          {state !== "opener" && <h1 className="sr-only">MusicDNA {state}</h1>}
          <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b hairline pb-4">
            <a href="/" aria-label="MusicDNA home">
              <img src="/music-dna-logo.png" alt="MusicDNA" className="h-12 w-auto" />
            </a>
            <span className="font-mono text-xs text-muted-foreground">
              {state === "public-share" ? "A shared reading" : "The interview"}
            </span>
          </header>
          {state === "opener" && (
            <section className="space-y-8">
              <header className="space-y-4">
                <p className="eyebrow">Your songs · ranked</p>
                <h1 className="display text-4xl leading-tight">
                  What's YOUR greatest song of all time?
                  <br />
                  <span className="italic text-muted-foreground">Don't be shy...</span>
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Three opening songs, then up to six answered choices. You can skip songs you don’t
                  know.
                </p>
              </header>
              <OpeningSongInput
                rank={1}
                label="The one at the top"
                value={draft}
                placeholder="Ceremony — New Order"
                onChange={setDraft}
              />
              <button
                type="button"
                className="min-h-11 rounded-sm bg-primary px-6 py-3 text-sm text-primary-foreground"
                disabled={!draft.trim()}
              >
                Continue →
              </button>
            </section>
          )}
          {state === "selected" && (
            <section className="space-y-5">
              <p className="eyebrow">Round 01 / 6</p>
              <p className="font-serif text-xl">Pick one. First instinct.</p>
              <SongChoices songs={songs} selectedId={selected} busy={true} onChoose={setSelected} />
              <p role="status" className="text-sm text-muted-foreground">
                Saving your choice…
              </p>
            </section>
          )}
          {state === "feedback" && <InterviewExchange entry={feedback} />}
          {state === "theory" && <ReadMoment read={theory} />}
          {state === "revision" && <ReadMoment read={revision} />}
          {(state === "result" || state === "public-share") && (
            <ReadingResult
              content={result}
              label={state === "public-share" ? "A shared MusicDNA reading" : "The read"}
            >
              {state === "result" ? (
                <div className="flex flex-col gap-3">
                  <a
                    href="/reference?state=pushback&capture=1"
                    className="min-h-11 rounded-sm bg-primary px-5 py-3 text-center text-sm text-primary-foreground"
                  >
                    Push back on this →
                  </a>
                  <a
                    href="/reference?state=public-share&capture=1"
                    className="min-h-11 rounded-sm border hairline-strong px-5 py-3 text-center text-sm"
                  >
                    Share this read
                  </a>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Sharing publishes this reading only. Your conversation stays private.
                  </p>
                </div>
              ) : (
                <a
                  href="/onboarding"
                  className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 py-3 text-sm text-primary-foreground"
                >
                  Get your own reading →
                </a>
              )}
            </ReadingResult>
          )}
          {state === "pushback" && (
            <ReadingConversation
              messages={[
                {
                  id: "fixture-1",
                  role: "user",
                  content: "I like intimate songs too. Does that change the reading?",
                  created_at: "2026-10-10T12:01:00Z",
                  mutation_id: "fixture-turn",
                },
                {
                  id: "fixture-2",
                  role: "assistant",
                  content:
                    "That adds context to the scale preference in these choices. The original reading stays saved; your own account belongs to a separate interpretation.",
                  created_at: "2026-10-10T12:01:01Z",
                  mutation_id: "fixture-turn:reply",
                },
              ]}
              draft={message}
              onDraft={setMessage}
              onSend={() => {}}
              pending={null}
              busy={false}
              error={null}
              hasOlder={false}
              onOlder={() => {}}
            />
          )}
        </main>
      )}
    </>
  );
}
