import type { DnaSummary } from "@/musicdna/engine/dna-summary";
import { useEffect, useRef, useState } from "react";
import type { Hunch } from "@/musicdna/engine/critic-fillers";
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
  prepareReads,
  reactToRead as reactToReadFn,
} from "@/lib/musicdna.functions";
import { setShared } from "@/lib/share-publish.functions";
import { getOnboardingOpener, type OnboardingOpener } from "@/lib/onboarding-openers.functions";
import { ensureAnonSession } from "@/lib/anon-auth";
import { toast } from "sonner";
import type { CurrentReadResult } from "@/musicdna/engine/read";
import type { Phase, Refined, Pairing, Entry } from "@/lib/interview-model";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { shouldResumeInterview } from "@/musicdna/engine/reading-support";
import { withRequestDeadline } from "@/lib/request-deadline";
import { getInterviewFlow } from "@/lib/interview-flow.functions";
import { checkpointIndex, type InterviewFlow } from "@/musicdna/engine/checkpoints";

type NextResult = {
  pairing: Pairing | null;
  round: number;
  done: boolean;
  max_rounds?: number;
  selection_reason?: unknown;
  prompt?: string;
};
export type Checkpoint = {
  index: 1 | 2;
  /** Saved Critic read text; null while it failed and can be retried. */
  thesis: string | null;
  next: NextResult;
};
const QUIP_HOLD_MS = 2500;

export function useInterview(requestedSession?: string, fresh?: string) {
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
  const prepareFn = useServerFn(prepareReads);
  const flowFn = useServerFn(getInterviewFlow);
  const [flow, setFlow] = useState<InterviewFlow>("per_pick");
  const flowRef = useRef<InterviewFlow>("per_pick");
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);

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
  const [reactionReply, setReactionReply] = useState<{ round: number; message: string } | null>(
    null,
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stageHunch, setStageHunch] = useState<Hunch | null>(null);
  const [skipNote, setSkipNote] = useState<{
    songs: Array<{ artist: string; year?: number | null }>;
    index: number;
  } | null>(null);
  const skipCount = useRef(0);
  const [reveal, setReveal] = useState<{
    answered: number;
    twist: string | null;
    challenge: string;
  }>();
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [dnaSummary, setDnaSummary] = useState<DnaSummary | null>(null);
  const [signature, setSignature] = useState<{ name: string; hook: string } | null>(null);
  const [auditText, setAuditText] = useState<string | undefined>();
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
  const [openedFresh, setOpenedFresh] = useState<string | undefined>();
  const pinnedSession = useRef<string | null>(null);
  const bootGeneration = useRef(0);
  useEffect(() => {
    // Pinning a newly-created ID in the address bar must not reboot its live state.
    if (requestedSession && requestedSession === pinnedSession.current) return;
    pinnedSession.current = null;
    const generation = ++bootGeneration.current;
    let cancelled = false;
    setBooting(true);
    setBootError(null);
    setPhase("slot1");
    setEntries([]);
    setReveal(undefined);
    setDnaSummary(null);
    setSignature(null);
    setSongs([]);
    setReactions([]);
    setRefined(null);
    setPairing(null);
    setSessionId(null);
    setPendingSongId(null);
    setPendingSkip(null);
    setSynthesis(null);
    setResultVersion(null);
    setReactionReply(null);
    setReactedRounds([]);
    setCheckpoint(null);
    playStartedRef.current = false;
    const opening = (async () => {
      await ensureAnonSession();
      const f = await flowFn().catch(() => ({ flow: "per_pick" as InterviewFlow }));
      flowRef.current = f.flow;
      setFlow(f.flow);
      const o = (await getOpenerFn()) as OnboardingOpener;
      if (cancelled) return;
      setOpener(o);
      track({ event_type: "onboarding_viewed", variant: o.variant_key });

      // Resume an unfinished interview with its full conversation.
      const resumed = shouldResumeInterview({ session: requestedSession, fresh })
        ? await resumeFn({ data: { sessionId: requestedSession } })
        : null;
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
      if (restored.length === 0 && !requestedSession) return;
      playStartedRef.current = true;
      setEntries(restored);
      // Resume has session-frozen exchanges, but its opener comes from the
      // mutable account profile. Never present that as this interview's read.
      setPhase("playing");
      if (resumed.completed) {
        // Finished reading (e.g. browser Back from chat): show the result.
        await loadFinalRead(resumed.sessionId);
        if (cancelled) return;
        setSessionId(resumed.sessionId);
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
        if (cancelled) return;
        setSessionId(resumed.sessionId);
        setPhase("done");
        return;
      }
      const resumeCp = flowRef.current === "checkpoints" ? checkpointIndex(restored.length) : null;
      const lastThesis = restored.at(-1)?.thesis;
      if (resumeCp && lastThesis) {
        // Back on the checkpoint screen with its saved read; the next pair stays hidden.
        setCheckpoint({ index: resumeCp, thesis: lastThesis, next: nx as NextResult });
        setSessionId(resumed.sessionId);
        return;
      }
      setPairing(nx.pairing);
      setSessionId(resumed.sessionId);
      setRound(nx.round);
      startedAt.current = Date.now();
      toast("Picked up where you left off.");
    })();
    void withRequestDeadline(opening, "Interview opening timed out")
      .catch(() => {
        if (!cancelled) {
          setBootError(
            "We couldn’t restore this interview. Try again, or return home to start a reading.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOpenedFresh(fresh);
          setBooting(false);
        }
        cancelled = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSession, fresh]);

  // While the listener decides, the Critic drafts (and reviews) its reaction to
  // either pick so the chosen one is ready on tap. Best-effort: failures just
  // mean the normal path writes the reaction after the pick.
  const pairingId = pairing?.id ?? null;
  useEffect(() => {
    if (!sessionId || !pairingId || phase !== "playing") return;
    prepareFn({ data: { sessionId, pairingId } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, pairingId, phase]);

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
        pinnedSession.current = sessionId;
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
            props: {
              round,
              tests: (pairing as unknown as Pairing).tests,
              selection_reason,
              exposure_id: (pairing as unknown as Pairing).exposure_id,
            },
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
      pairingAnchorRef.current.closest("main")?.scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "start",
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
    setStageHunch(null);
    setBusy(true);
    const ms = Math.min(600000, Date.now() - startedAt.current);
    const currentPairing = pairing;
    const currentRound = round;
    try {
      const { verdict, why, dim, delta, hunch } = (await chooseFn({
        data: { sessionId, pairingId: currentPairing.id, chosenSongId: songId, msToDecide: ms },
      })) as { verdict: string; why: string; dim: string; delta: number; hunch?: Hunch };
      setStageHunch(hunch ?? "early");
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

      const answeredNow = entries.length + 1;
      const cpFlow = flowRef.current === "checkpoints";
      const cpIndex = cpFlow ? checkpointIndex(answeredNow) : null;
      // Checkpoint flow: picks between checkpoints get a quip only, no Critic write.
      const writeRead = !cpFlow || cpIndex !== null || answeredNow >= 6;
      const quipHold = cpFlow && !writeRead ? new Promise((r) => setTimeout(r, QUIP_HOLD_MS)) : null;
      let readFailed = false;
      let thesis = cpFlow && cpIndex === null ? "" : "I'll come back to that one.";
      let hook = "";
      let topDim: string | null = null;
      // The running read now comes with its own tier / direction / open
      // question, derived from the real choices — no client-side guessing
      // from "did the top axis change".
      let tier: Entry["tier"] = "observation";
      let direction: Entry["direction"] = "forming";
      let question = "";
      let revision: CurrentReadResult["revision"] = null;
      if (writeRead && !(cpFlow && answeredNow >= 6)) try {
        const r = await Promise.race([
          readFn({ data: { sessionId } }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("read_timeout")), 20000),
          ),
        ]);
        thesis = r.thesis;
        hook = r.hook ?? "";
        topDim = r.topDim;
        tier = r.tier;
        direction = r.direction;
        question = r.question ?? "";
        revision = r.revision;
      } catch {
        readFailed = true;
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
      setReactionReply(null);
      setPairing(null);

      const {
        pairing: nxt,
        round: nr,
        done: isDone,
        max_rounds,
        selection_reason,
        prompt,
      } = (await nextFn({ data: { sessionId } })) as NextResult;
      if (quipHold) await quipHold;
      if (max_rounds) setMaxRounds(max_rounds);
      if (cpIndex && !(isDone && cpIndex === 1 && !nxt)) {
        // Critic gets its own screen; the next pair waits behind Continue.
        setCheckpoint({
          index: cpIndex,
          thesis: readFailed ? null : thesis,
          next: { pairing: nxt, round: nr, done: isDone, max_rounds, selection_reason, prompt },
        });
        setPendingSongId(null);
        setBusy(false);
        return;
      }
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
      // Read and next pairing arrive together; no extra click.
      setPendingSongId(null);
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
          exposure_id: (nxt as unknown as Pairing).exposure_id,
        },
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
  async function loadFinalRead(sidOverride?: string, finishEarly = false) {
    const generation = bootGeneration.current;
    const sid = sidOverride ?? sessionId;
    if (!sid) return;
    setResultError(null);
    try {
      // Bounded wait: the server keeps writing and saves the reading, so a
      // timeout only offers a retry that replays the saved result.
      const r = (await withRequestDeadline(
        (async () => {
          await finalizeFn({ data: { sessionId: sid, finishEarly } });
          return synthFn({ data: { sessionId: sid } });
        })(),
        "Reading still being written",
      )) as {
        result_version?: number | null;
        reveal?: { answered: number; twist: string | null; challenge: string };
        synthesis: string;
        audit_text?: string;
        kept_choosing: Array<{
          tradeoff: string;
          examples: string[];
          supporting: number;
          tested: number;
        }>;
        counter_reads: Array<{ claim: string; notes: string }>;
        narration_status?: string;
        dna_summary?: DnaSummary;
        signature?: { name: string; hook: string } | null;
      };
      if (!r.synthesis) throw new Error("Reading not saved yet");
      if (generation !== bootGeneration.current) return;
      if (r.result_version == null) {
        // Unsaved safety text: show it, but invite a retry for the real reading.
        setReveal(r.reveal);
        setSynthesis(r.synthesis);
        setKept(r.kept_choosing ?? []);
        setCounters((r.counter_reads ?? []).map((c) => ({ claim: c.claim, notes: c.notes })));
        setResultError("The Critic is still finishing your full reading — retry in a moment.");
        return;
      }
      if (generation !== bootGeneration.current) return;
      setResultVersion(r.result_version);
      setReveal(r.reveal);
      setSynthesis(r.synthesis);
      setDnaSummary(r.dna_summary ?? null);
      setSignature(r.signature ?? null);
      setAuditText(r.audit_text);
      setKept(r.kept_choosing ?? []);
      setCounters((r.counter_reads ?? []).map((c) => ({ claim: c.claim, notes: c.notes })));
    } catch (e) {
      if (generation !== bootGeneration.current) return;
      setResultError(
        "Still writing your reading. Your choices are saved — retry in a moment to see it.",
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
      setReactionReply({ round: currentRound, message: r.message });
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't switch that up.");
    } finally {
      actionRef.current = false;
      setBusy(false);
    }
  }

  // Checkpoint buttons. Continue reveals the held pair; finish asks for the four-choice reading.
  function continueFromCheckpoint() {
    const cp = checkpoint;
    if (!cp || !sessionId) return;
    if (cp.next.done || !cp.next.pairing) {
      void finishFromCheckpoint();
      return;
    }
    setCheckpoint(null);
    setPairing(cp.next.pairing);
    setRound(cp.next.round);
    if (cp.next.prompt) setNextPrompt(cp.next.prompt);
    startedAt.current = Date.now();
    track({
      event_type: "pairing_shown",
      session_id: sessionId,
      pairing_id: cp.next.pairing.id,
      props: {
        round: cp.next.round,
        tests: cp.next.pairing.tests,
        selection_reason: cp.next.selection_reason,
        exposure_id: cp.next.pairing.exposure_id,
        after_checkpoint: cp.index,
      },
    });
  }
  async function finishFromCheckpoint() {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      track({ event_type: "session_completed", session_id: sessionId, props: { rounds: entries.length, early: true } });
      await loadFinalRead(sessionId, true);
      setCheckpoint(null);
      setPhase("done");
    } finally {
      setBusy(false);
    }
  }
  async function retryCheckpointRead() {
    if (!checkpoint || !sessionId || busy) return;
    setBusy(true);
    try {
      const r = await withRequestDeadline(readFn({ data: { sessionId } }), "read_timeout");
      setCheckpoint((cp) => (cp ? { ...cp, thesis: r.thesis } : cp));
      setEntries((prev) =>
        prev.map((e, i) => (i === prev.length - 1 ? { ...e, thesis: r.thesis, tier: r.tier, direction: r.direction } : e)),
      );
    } catch {
      toast.error("The Critic is still thinking. You can keep going.");
    } finally {
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
      setSkipNote({
        songs: [currentPairing.song_a, currentPairing.song_b],
        index: skipCount.current++,
      });
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
      setSkipNote(null);
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
          exposure_id: (nxt as unknown as Pairing).exposure_id,
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
    reactionReply,
    entries,
    stageHunch,
    skipNote,
    reveal,
    synthesis,
    dnaSummary,
    signature,
    auditText,
    kept,
    counters,
    slotAnchorRef,
    pairingAnchorRef,
    doneAnchorRef,
    bootError,
    booting,
    openedFresh,
    submitSlot,
    pick,
    reactToRead,
    shareRead,
    skip,
    loadFinalRead,
    flow,
    checkpoint,
    continueFromCheckpoint,
    finishFromCheckpoint,
    retryCheckpointRead,
  };
}
