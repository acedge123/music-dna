import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resumeLatestSession } from "@/lib/resume.functions";
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
  reactToRead as reactToReadFn,
} from "@/lib/musicdna.functions";
import { setShared } from "@/lib/share-publish.functions";
import { getOnboardingOpener, type OnboardingOpener } from "@/lib/onboarding-openers.functions";
import { ensureAnonSession } from "@/lib/anon-auth";
import { toast } from "sonner";
import type { CurrentReadResult } from "@/musicdna/engine/read";
import type { Phase, Refined, Pairing, Entry } from "@/lib/interview-model";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export function useInterview(requestedSession?: string) {
  const reducedMotion = usePrefersReducedMotion();
  const reactOneFn = useServerFn(reactToOne);
  const commitFn = useServerFn(commitOpeningThree);
  const logEvent = useServerFn(recordEvent);
  const getOpenerFn = useServerFn(getOnboardingOpener);
  const startFn = useServerFn(startSession);
  const nextFn = useServerFn(nextPairing);
  const reactFn = useServerFn(reactToReadFn);
  const shareFn = useServerFn(setShared);
  const resumeFn = useServerFn(resumeLatestSession);
  const chooseFn = useServerFn(recordChoice);
  const skipFn = useServerFn(skipPairing);
  const finalizeFn = useServerFn(finalizeSession);
  const synthFn = useServerFn(finalSynthesis);
  const readFn = useServerFn(currentRead);

  type EventInput = {
    event_type:
      | "onboarding_viewed"
      | "onboarding_slot_submitted"
      | "onboarding_three_submitted"
      | "onboarding_classified"
      | "pairing_shown"
      | "choice_made"
      | "reveal_shown"
      | "reveal_continued"
      | "session_completed"
      | "result_viewed"
      | "result_shared"
      | "session_quit"
      | "read_reaction";
    session_id?: string | null;
    pairing_id?: string | null;
    choice_id?: string | null;
    response_time_ms?: number | null;
    props?: Record<string, unknown>;
    variant?: string;
  };
  const track = (e: EventInput) => {
    logEvent({ data: e } as never).catch(() => {});
  };

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
  const [pendingSkip, setPendingSkip] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultVersion, setResultVersion] = useState<number | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const actionRef = useRef(false);
  const shareRef = useRef(false);
  const [round, setRound] = useState(0);
  // The engine owns the completion policy; the screen just displays what it
  // reports instead of enforcing its own cap.
  const [maxRounds, setMaxRounds] = useState(6);
  const [nextPrompt, setNextPrompt] = useState<string | null>(null);
  const [reactedRounds, setReactedRounds] = useState<number[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [kept, setKept] = useState<
    Array<{ tradeoff: string; examples: string[]; supporting: number; tested: number }>
  >([]);
  const [counters, setCounters] = useState<Array<{ claim: string; notes: string }>>([]);
  const startedAt = useRef<number>(Date.now());
  const playStartedRef = useRef(false);
  const prevTopDim = useRef<string | null>(null);
  const slotAnchorRef = useRef<HTMLDivElement | null>(null);
  const pairingAnchorRef = useRef<HTMLDivElement | null>(null);
  const doneAnchorRef = useRef<HTMLDivElement | null>(null);

  // boot
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setBooting(true);
    setBootError(null);
    setPhase("slot1");
    setEntries([]);
    setSongs([]);
    setReactions([]);
    setRefined(null);
    setPairing(null);
    setSessionId(null);
    setPendingSongId(null);
    setPendingSkip(null);
    setSynthesis(null);
    setResultVersion(null);
    playStartedRef.current = false;
    (async () => {
      try {
        await ensureAnonSession();
        const o = (await getOpenerFn()) as OnboardingOpener;
        if (cancelled) return;
        setOpener(o);
        track({ event_type: "onboarding_viewed", variant: o.variant_key });

        // Resume an unfinished interview with its full conversation.
        const resumed = await resumeFn({ data: { sessionId: requestedSession } });
        if (cancelled || !resumed) return;
        const ex = resumed.exchanges;
        const restored: Entry[] = [];
        ex.forEach((e, i) => {
          if (e.type !== "choice" || !e.pairing || !e.chosen) return;
          const after = ex.slice(i + 1);
          const nextChoice = after.findIndex((x) => x.type === "choice");
          const r = (nextChoice === -1 ? after : after.slice(0, nextChoice)).find(
            (x) => x.type === "read",
          );
          const rr = r && r.type === "read" ? r : null;
          restored.push({
            round: restored.length + 1,
            pairing: {
              ...e.pairing,
              hypothesis: null,
              why_good: null,
              song_a: { ...e.pairing.song_a, lane: e.pairing.song_a.lane ?? "" },
              song_b: { ...e.pairing.song_b, lane: e.pairing.song_b.lane ?? "" },
            } as Pairing,
            chosenSongId: e.chosen.id,
            reaction: e.feedback
              ? e.feedback.why
                ? `${e.feedback.verdict}\n${e.feedback.why}`
                : e.feedback.verdict
              : `${e.chosen.title}.`,
            thesis: rr?.thesis ?? "",
            hook: "",
            direction: (rr?.direction as Entry["direction"]) ?? "forming",
            topDim: null,
            tier: (rr?.tier as Entry["tier"]) ?? "observation",
            question: "",
            revision: rr?.revision as CurrentReadResult["revision"],
          });
        });
        if (restored.length === 0) return;
        playStartedRef.current = true;
        setSessionId(resumed.sessionId);
        setEntries(restored);
        if (!resumed.completed && resumed.opener?.hypothesis) {
          setRefined({
            hypothesis: resumed.opener.hypothesis,
            lane: resumed.opener.lane,
            confidence: 0,
          });
        }
        setPhase("playing");
        if (resumed.completed) {
          // Finished reading (e.g. browser Back from chat): show the result.
          await loadFinalRead(resumed.sessionId);
          setPhase("done");
          return;
        }
        const nx = (await nextFn({ data: { sessionId: resumed.sessionId } })) as {
          pairing: Pairing | null;
          round: number;
          done: boolean;
          max_rounds?: number;
          prompt?: string;
        };
        if (cancelled) return;
        if (nx.max_rounds) setMaxRounds(nx.max_rounds);
        if (nx.prompt) setNextPrompt(nx.prompt);
        if (nx.done || !nx.pairing) {
          await loadFinalRead(resumed.sessionId);
          setPhase("done");
          return;
        }
        setPairing(nx.pairing);
        setRound(nx.round);
        startedAt.current = Date.now();
        toast("Picked up where you left off.");
      } catch (e) {
        setBootError(
          "We couldn’t restore this interview. Try again, or return home to start a reading.",
        );
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSession]);

  // reveal-final choreography (after slot 3)
  useEffect(() => {
    if (!refined) return;
    if (reducedMotion) {
      setR5Step(2);
      return;
    }
    setR5Step(0);
    const t1 = setTimeout(() => setR5Step(1), 350);
    const t2 = setTimeout(() => setR5Step(2), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [refined, reducedMotion]);

  // After reveal lands, auto-start the side-by-sides
  useEffect(() => {
    if (r5Step !== 2 || phase !== "playing" || playStartedRef.current) return;
    playStartedRef.current = true;
    (async () => {
      try {
        const { sessionId } = await startFn({});
        setSessionId(sessionId);
        const { pairing, round, selection_reason, done, prompt, max_rounds } = (await nextFn({
          data: { sessionId },
        })) as {
          pairing: Pairing | null;
          round: number;
          selection_reason?: unknown;
          done?: boolean;
          prompt?: string;
          max_rounds?: number;
        };
        if (max_rounds) setMaxRounds(max_rounds);
        setNextPrompt(prompt ?? null);
        if (done || !pairing) {
          await loadFinalRead(sessionId);
          setPhase("done");
          return;
        }
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
      const timer = setTimeout(
        () =>
          slotAnchorRef.current?.scrollIntoView({
            behavior: reducedMotion ? "instant" : "smooth",
            block: "center",
          }),
        250,
      );
      return () => clearTimeout(timer);
    }
  }, [phase, reducedMotion]);
  useEffect(() => {
    if (pairing && pairingAnchorRef.current) {
      pairingAnchorRef.current.scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "center",
      });
    }
  }, [pairing, reducedMotion]);
  useEffect(() => {
    if (phase === "done" && doneAnchorRef.current) {
      doneAnchorRef.current.scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "start",
      });
    }
  }, [phase, reducedMotion]);

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
        track({
          event_type: "onboarding_three_submitted",
          variant: opener?.variant_key ?? "fallback",
        });
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
    if (!pairing || !sessionId || busy || actionRef.current || pendingSkip) return;
    if (pendingSongId && pendingSongId !== songId) return;
    actionRef.current = true;
    setFlowError(null);
    setPendingSongId(songId);
    setBusy(true);
    const ms = Math.min(600000, Date.now() - startedAt.current);
    const currentPairing = pairing;
    const currentRound = round;
    try {
      const { verdict, why, dim, delta } = await chooseFn({
        data: { sessionId, pairingId: currentPairing.id, chosenSongId: songId, msToDecide: ms },
      });
      const rejectedSongId =
        songId === currentPairing.song_a.id ? currentPairing.song_b.id : currentPairing.song_a.id;
      track({
        event_type: "choice_made",
        session_id: sessionId,
        pairing_id: currentPairing.id,
        response_time_ms: ms,
        props: {
          chosen_song_id: songId,
          rejected_song_id: rejectedSongId,
          top_dim: dim,
          delta,
          tests: currentPairing.tests,
        },
      });

      let thesis = "Reading you now.";
      let hook = "";
      let topDim: string | null = null;
      // The running read now comes with its own tier / direction / open
      // question, derived from the real choices — no client-side guessing
      // from "did the top axis change".
      let tier: Entry["tier"] = "observation";
      let direction: Entry["direction"] = "forming";
      let question = "";
      let revision: CurrentReadResult["revision"] = null;
      try {
        const r = await readFn({ data: { sessionId } });
        thesis = r.thesis;
        hook = r.hook ?? "";
        topDim = r.topDim;
        tier = r.tier;
        direction = r.direction;
        question = r.question ?? "";
        revision = r.revision;
      } catch {
        /* keep default */
      }
      prevTopDim.current = topDim ?? prevTopDim.current;
      setNextPrompt(hook || null);

      const reaction = why ? `${verdict}\n${why}` : verdict;
      const entry: Entry = {
        round: currentRound,
        pairing: currentPairing,
        chosenSongId: songId,
        reaction,
        thesis,
        hook,
        direction,
        topDim,
        tier,
        question,
        revision,
      };
      setEntries((prev) =>
        prev.some((saved) => saved.pairing.id === currentPairing.id) ? prev : [...prev, entry],
      );
      setPairing(null);

      const {
        pairing: nxt,
        round: nr,
        done: isDone,
        max_rounds,
        selection_reason,
        prompt,
      } = (await nextFn({ data: { sessionId } })) as {
        pairing: Pairing | null;
        round: number;
        done: boolean;
        max_rounds?: number;
        selection_reason?: unknown;
        prompt?: string;
      };
      if (max_rounds) setMaxRounds(max_rounds);
      // The prompt comes from the pairing actually selected, so it always
      // matches what the next matchup tests.
      if (prompt) setNextPrompt(prompt);
      if (isDone || !nxt) {
        track({ event_type: "session_completed", session_id: sessionId, props: { rounds: nr } });
        await loadFinalRead(sessionId);
        setPhase("done");
        setBusy(false);
        return;
      }
      setPairing(nxt as unknown as Pairing);
      setPendingSongId(null);
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
      setPairing(currentPairing);
      setFlowError("Couldn't finish this choice. Your selection is kept; retry the same song.");
      setBusy(false);
    } finally {
      actionRef.current = false;
    }
  }

  // Pulling the closing read is shared by the choice path and the
  // repeated-skip path — a skipped-out session still gets an honest result.
  async function loadFinalRead(sidOverride?: string) {
    const sid = sidOverride ?? sessionId;
    if (!sid) return;
    setResultError(null);
    try {
      await finalizeFn({ data: { sessionId: sid } });
      const r = (await synthFn({ data: { sessionId: sid } })) as {
        result_version?: number | null;
        synthesis: string;
        kept_choosing: Array<{
          tradeoff: string;
          examples: string[];
          supporting: number;
          tested: number;
        }>;
        counter_reads: Array<{ claim: string; notes: string }>;
      };
      if (!r.synthesis || r.result_version == null) throw new Error("Reading not saved yet");
      setResultVersion(r.result_version);
      setSynthesis(r.synthesis);
      setKept(r.kept_choosing ?? []);
      setCounters((r.counter_reads ?? []).map((c) => ({ claim: c.claim, notes: c.notes })));
    } catch (e) {
      setResultError(
        "Your choices are saved, but the reading isn’t ready yet. Retry to finish it.",
      );
    }
  }

  // Reaction row. "That's me" is acknowledgement only. The other two change
  // what gets asked next — they never touch the scores.
  async function reactToRead(kind: "thats_me" | "not_quite" | "harder") {
    if (!sessionId || busy || actionRef.current || pendingSongId || pendingSkip) return;
    actionRef.current = true;
    const currentRound = entries.at(-1)?.round ?? round;
    track({
      event_type: "read_reaction",
      session_id: sessionId,
      props: { kind, round: currentRound },
    });
    setBusy(true);
    try {
      const r = (await reactFn({
        data: {
          sessionId,
          kind,
          pairingId: pairing?.id ?? null,
          mutationId: `${sessionId}:${currentRound}:${kind}`,
        },
      })) as {
        effect: string;
        message: string;
        next: {
          pairing: Pairing | null;
          round: number;
          done: boolean;
          max_rounds?: number;
          prompt?: string;
        } | null;
      };
      setReactedRounds((prev) => [...prev, currentRound]);
      const nx = r.next;
      if (nx?.max_rounds) setMaxRounds(nx.max_rounds);
      if (nx?.done) {
        await loadFinalRead(sessionId);
        setPhase("done");
        return;
      }
      if (nx && !nx.done && nx.pairing) {
        setPairing(nx.pairing as unknown as Pairing);
        setRound(nx.round);
        startedAt.current = Date.now();
      }
      setNextPrompt(nx?.prompt ?? null);
      toast(r.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't switch that up.");
    } finally {
      actionRef.current = false;
      setBusy(false);
    }
  }

  // Share the read, not the conversation: /s/:id renders the public card and
  // invites the recipient to start an independent reading (TGA-312 is separate).
  async function shareRead() {
    if (!sessionId || resultVersion == null || shareRef.current) return;
    shareRef.current = true;
    setShareBusy(true);
    try {
      const publication = await shareFn({ data: { sessionId, publish: true, resultVersion } });
      if (!publication.share_token || publication.result_version !== resultVersion)
        throw new Error("Publication version mismatch");
      const url = `${window.location.origin}/s/${publication.share_token}`;
      if (navigator.share) await navigator.share({ title: "My MusicDNA read", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Reading link copied. Your conversation stays private.");
      }
      track({ event_type: "result_shared", session_id: sessionId });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error("Couldn't share this reading. Please try again.");
    } finally {
      shareRef.current = false;
      setShareBusy(false);
    }
  }

  async function skip() {
    if (!pairing || !sessionId || busy || actionRef.current || pendingSongId) return;
    setPendingSkip(pairing.id);
    setFlowError(null);
    actionRef.current = true;
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
      const {
        pairing: nxt,
        round: nr,
        done: isDone,
        max_rounds,
        selection_reason,
      } = (await nextFn({ data: { sessionId } })) as {
        pairing: Pairing | null;
        round: number;
        done: boolean;
        max_rounds?: number;
        selection_reason?: unknown;
      };
      if (max_rounds) setMaxRounds(max_rounds);
      if (isDone || !nxt) {
        await loadFinalRead();
        setPhase("done");
        setBusy(false);
        return;
      }
      setPairing(nxt as unknown as Pairing);
      setPendingSkip(null);
      setRound(nr);
      startedAt.current = Date.now();
      track({
        event_type: "pairing_shown",
        session_id: sessionId,
        pairing_id: (nxt as unknown as Pairing).id,
        props: {
          round: nr,
          tests: (nxt as unknown as Pairing).tests,
          selection_reason,
          after_skip: true,
        },
      });
      setBusy(false);
    } catch (err) {
      setPairing(currentPairing);
      setFlowError("Couldn’t confirm the skip. Retry skipping this pair before choosing again.");
      setBusy(false);
    } finally {
      actionRef.current = false;
    }
  }

  return {
    phase,
    songs,
    draft,
    setDraft,
    busy,
    reactions,
    nextLabels,
    refined,
    r5Step,
    setR5Step,
    opener,
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
  };
}
