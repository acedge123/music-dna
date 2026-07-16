import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { getMyResult, recordEvent, submitFeedback, getMyFeedback } from "@/lib/musicdna.functions";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your reading — MusicDNA" }] }),
  errorComponent: ({ error }) => (
    <div className="px-6 py-20 text-muted-foreground">Couldn't load: {error.message}</div>
  ),
  component: () => (
    <Suspense fallback={<div className="px-6 py-20 text-muted-foreground">Loading…</div>}>
      <ProfilePage />
    </Suspense>
  ),
});

// Canonical 10-axis taxonomy. Matches DIMS in src/lib/musicdna.functions.ts.
const DIMS = [
  "movement","atmosphere","immersion","scale","community",
  "perspective","confidence","tension","texture","transformation",
];

type Claim = {
  dimension: string;
  preferred?: string;
  opposed?: string;
  supporting_choices: number;
  tested_total: number;
  confidence: number;
  examples?: Array<{ chosen: string; rejected: string; delta: number }>;
  tradeoff: string;
};
type Counter = { claim: string; impact: "low" | "medium" | "high"; notes: string };
type Reasoning = { allowed_claims: Claim[]; blocked_claims: Claim[]; counterarguments: Counter[]; patterns: Claim[] };

function ProfilePage() {
  const fn = useServerFn(getMyResult);
  const logEvent = useServerFn(recordEvent);
  const sendFeedback = useServerFn(submitFeedback);
  const fetchFeedback = useServerFn(getMyFeedback);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["myResult"], queryFn: () => fn({}) }),
  );
  const [copied, setCopied] = useState(false);
  const latest = data.sessions[0];
  const reasoning = data.reasoning as Reasoning | null;
  const vector = (latest?.vector ?? {}) as Record<string, number>;

  const max = Math.max(20, ...DIMS.map((d) => Math.abs(vector[d] ?? 0)));
  const chartData = DIMS.map((d) => ({
    dim: d.replace(/_/g, " "),
    value: ((vector[d] ?? 0) + max) / (2 * max) * 100,
  }));

  // Fire result_viewed once per session view
  useEffect(() => {
    if (!latest?.id) return;
    logEvent({
      data: { event_type: "result_viewed", session_id: latest.id, props: { archetype: latest.archetype?.name ?? null } },
    } as never).catch(() => { /* swallow */ });
  }, [latest?.id, latest?.archetype?.name, logEvent]);

  // Existing feedback for this session
  const feedbackQ = useQuery({
    queryKey: ["feedback", latest?.id],
    queryFn: () => fetchFeedback({ data: { session_id: latest!.id } }),
    enabled: !!latest?.id,
  });
  const existing = (feedbackQ.data?.feedback ?? []).find((f) => f.target == null);
  const [accuracy, setAccuracy] = useState<"accurate" | "not_accurate" | "mixed" | null>(null);
  const [rating, setRating] = useState<-1 | 1 | null>(null);
  const [comment, setComment] = useState("");
  const [mostAccurate, setMostAccurate] = useState("");
  const [leastAccurate, setLeastAccurate] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  useEffect(() => {
    if (!existing) return;
    setAccuracy((existing.accuracy as "accurate" | "not_accurate" | "mixed" | null) ?? null);
    setRating(((existing.rating as -1 | 1 | null) ?? null));
    setComment(existing.comment ?? "");
    setMostAccurate(((existing as { most_accurate_sentence?: string | null }).most_accurate_sentence) ?? "");
    setLeastAccurate(((existing as { least_accurate_sentence?: string | null }).least_accurate_sentence) ?? "");
  }, [existing]);

  async function saveFeedback(next: {
    accuracy?: typeof accuracy;
    rating?: typeof rating;
    comment?: string;
    most_accurate_sentence?: string;
    least_accurate_sentence?: string;
  }) {
    if (!latest?.id) return;
    const payload = {
      accuracy: next.accuracy !== undefined ? next.accuracy : accuracy,
      rating: next.rating !== undefined ? next.rating : rating,
      comment: next.comment !== undefined ? next.comment : comment,
      most_accurate_sentence: next.most_accurate_sentence !== undefined ? next.most_accurate_sentence : mostAccurate,
      least_accurate_sentence: next.least_accurate_sentence !== undefined ? next.least_accurate_sentence : leastAccurate,
    };
    setFeedbackSaving(true);
    try {
      await sendFeedback({ data: { session_id: latest.id, ...payload } });
      feedbackQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save feedback");
    } finally {
      setFeedbackSaving(false);
    }
  }

  async function share() {
    if (!latest) return;
    const slug = (latest as { share_token?: string }).share_token ?? latest.id;
    const url = `${window.location.origin}/s/${slug}`;
    const title = `MusicDNA: ${latest.archetype?.name ?? "A reading"}`;
    const text = latest.archetype?.tagline
      ? `${title} — ${latest.archetype.tagline}`
      : title;
    logEvent({
      data: { event_type: "result_shared", session_id: latest.id, props: { has_native_share: !!navigator.share } },
    } as never).catch(() => { /* swallow */ });
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
        toast.success("Share link copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied");
      } catch {
        toast.error("Could not copy");
      }
    }
  }


  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {!latest ? (
        <div>
          <p className="eyebrow mb-6">No readings yet</p>
          <p className="font-serif text-3xl">Complete a round of matchups to see your DNA.</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-6 mb-10">
            <div>
              <p className="eyebrow mb-6">Your latest reading</p>
              {latest.archetype && (
                <>
                  <h1 className="display text-5xl md:text-6xl mb-3">{latest.archetype.name}</h1>
                  {latest.archetype.tagline && (
                    <p className="text-lg text-muted-foreground italic">{latest.archetype.tagline}</p>
                  )}
                </>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <button
                onClick={share}
                className="border hairline-strong rounded-sm px-4 py-2 text-xs font-medium hover:bg-surface"
              >
                {copied ? "Copied" : "Share / challenge a friend"}
              </button>
              <a
                href={`/s/${(latest as { share_token?: string }).share_token ?? latest.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                Preview share card →
              </a>
            </div>

          </div>

          <ClaimDnaBanner />


          {latest.interpretation && (
            <blockquote className="border-l-2 border-primary pl-6 my-12 max-w-2xl">
              <p className="font-serif text-2xl leading-snug text-foreground">{latest.interpretation}</p>
            </blockquote>
          )}

          {/* ---- Feedback strip ---- */}
          <section className="mt-6 mb-12 border hairline-strong rounded-sm bg-surface px-5 py-4 max-w-2xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="eyebrow">Was this accurate?</p>
              <div className="flex items-center gap-2">
                {(["accurate", "mixed", "not_accurate"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAccuracy(a); saveFeedback({ accuracy: a }); }}
                    disabled={feedbackSaving}
                    className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                      accuracy === a
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hairline-strong hover:bg-background"
                    }`}
                  >
                    {a === "accurate" ? "Nailed it" : a === "mixed" ? "Mixed" : "Way off"}
                  </button>
                ))}
                <div className="w-px h-5 bg-border mx-1" />
                <button
                  onClick={() => { const v = rating === 1 ? null : 1; setRating(v); saveFeedback({ rating: v }); }}
                  disabled={feedbackSaving}
                  className={`text-xs px-2.5 py-1.5 rounded-sm border transition-colors ${
                    rating === 1 ? "border-primary bg-primary text-primary-foreground" : "hairline-strong hover:bg-background"
                  }`}
                  aria-label="Thumbs up"
                >👍</button>
                <button
                  onClick={() => { const v = rating === -1 ? null : -1; setRating(v); saveFeedback({ rating: v }); }}
                  disabled={feedbackSaving}
                  className={`text-xs px-2.5 py-1.5 rounded-sm border transition-colors ${
                    rating === -1 ? "border-primary bg-primary text-primary-foreground" : "hairline-strong hover:bg-background"
                  }`}
                  aria-label="Thumbs down"
                >👎</button>
                <button
                  onClick={() => setFeedbackOpen((v) => !v)}
                  className="text-xs px-3 py-1.5 rounded-sm border hairline-strong hover:bg-background"
                >
                  {feedbackOpen ? "Close" : "Note"}
                </button>
              </div>
            </div>
            {feedbackOpen && (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onBlur={() => saveFeedback({ comment })}
                  placeholder="What did we miss? What landed?"
                  rows={3}
                  maxLength={2000}
                  className="w-full bg-background border hairline rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  {feedbackSaving ? "Saving…" : existing ? "Saved" : "Autosaves on blur"}
                </p>
              </div>
            )}
          </section>


          {data.definingChoices?.length ? (
            <section className="mt-12 mb-12">
              <p className="eyebrow mb-5">Defining choices</p>
              <ul className="divide-y divide-border border hairline-strong rounded-sm bg-surface">
                {data.definingChoices.slice(0, 5).map((c, i) => (
                  <li key={i} className="px-5 py-4 flex items-baseline gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-serif text-lg leading-snug">
                        <span className="text-foreground">{c.chosen}</span>
                        <span className="text-muted-foreground"> over </span>
                        <span className="text-muted-foreground line-through decoration-1">{c.rejected}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.chosenArtist} vs {c.rejectedArtist}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(() => {
            const impactRank = { high: 3, medium: 2, low: 1 } as const;
            const counters = [...(reasoning?.counterarguments ?? [])].sort(
              (a, b) => (impactRank[b.impact] ?? 0) - (impactRank[a.impact] ?? 0),
            );
            const topCounter = counters[0];
            const restCounters = counters.slice(1);
            const claims = [...(reasoning?.allowed_claims ?? [])].sort(
              (a, b) => b.confidence - a.confidence,
            );

            return (
              <>
                {topCounter ? (
                  <section className="mt-10 mb-10">
                    <p className="eyebrow mb-3">Strongest counter-read</p>
                    <div className="border-l-2 border-primary bg-surface px-5 py-4">
                      <div className="flex items-baseline justify-between gap-4 mb-1.5">
                        <p className="font-serif text-xl leading-snug text-foreground">{topCounter.claim}</p>
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary shrink-0">
                          {topCounter.impact} impact
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{topCounter.notes}</p>
                    </div>
                  </section>
                ) : null}

                {claims.length ? (
                  <section className="mt-12 mb-12">
                    <p className="eyebrow mb-5">The receipts</p>
                    <ul className="divide-y divide-border border hairline-strong rounded-sm bg-surface">
                      {claims.map((c, i) => {
                        const ratio = c.tested_total > 0 ? c.supporting_choices / c.tested_total : 0;
                        return (
                          <li key={i} className="px-5 py-5">
                            <div className="flex items-baseline justify-between gap-4 mb-2">
                              <p className="font-serif text-lg leading-snug">
                                <span className="text-foreground">{c.preferred}</span>
                                <span className="text-muted-foreground"> over </span>
                                <span className="text-muted-foreground">{c.opposed}</span>
                              </p>
                              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
                                {c.supporting_choices}/{c.tested_total} picks · {Math.round(c.confidence * 100)}% conf
                              </span>
                            </div>
                            <div className="h-1 w-full bg-border/60 rounded-sm overflow-hidden mb-2">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.round(ratio * 100)}%` }}
                              />
                            </div>
                            {c.examples?.length ? (
                              <ul className="mt-2 space-y-1">
                                {c.examples.slice(0, 3).map((e, j) => (
                                  <li key={j} className="text-xs text-muted-foreground">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] mr-2 opacity-60">→</span>
                                    <span className="text-foreground">{e.chosen}</span>
                                    <span> over </span>
                                    <span className="line-through decoration-1">{e.rejected}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}

                {restCounters.length ? (
                  <section className="mt-8 mb-12">
                    <p className="eyebrow mb-3">Other ways to read this</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {restCounters.map((c, i) => (
                        <li key={i} className="border-l-2 border-border pl-4">
                          <span className="font-mono text-[10px] uppercase tracking-[0.22em] mr-2 opacity-60">
                            {c.impact}
                          </span>
                          <span className="text-foreground">{c.claim}</span>{" "}
                          <span className="opacity-70">— {c.notes}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            );
          })()}


          <div className="border hairline-strong rounded-sm bg-surface p-6 mt-10">
            <p className="eyebrow mb-4">10-axis radar</p>
            <div style={{ width: "100%", height: 460 }}>
              <ResponsiveContainer>
                <RadarChart data={chartData}>
                  <PolarGrid stroke="oklch(1 0 0 / 0.1)" />
                  <PolarAngleAxis dataKey="dim" tick={{ fill: "oklch(0.715 0.010 240)", fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar dataKey="value" stroke="oklch(0.617 0.205 261)" fill="oklch(0.617 0.205 261)" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {(() => {
            const past = data.sessions.slice(1).filter((s) => s.completed_at);
            if (!past.length) return null;
            return (
              <section className="mt-16">
                <p className="eyebrow mb-4">Past readings · {past.length}</p>
                <ul className="space-y-3">
                  {past.map((s) => (
                    <li key={s.id} className="border hairline rounded-sm bg-surface px-5 py-4 flex items-center justify-between gap-4 hover:border-primary/40 transition-colors">
                      <a href={`/s/${(s as { share_token?: string }).share_token ?? s.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 group">
                        <div className="flex items-baseline gap-3 mb-1">
                          <p className="font-serif text-lg truncate group-hover:underline">
                            {s.archetype?.name ?? "Unassigned"}
                          </p>
                          {"lane" in s && (s as { lane?: string }).lane && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
                              {String((s as { lane?: string }).lane).replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{s.interpretation ?? "—"}</p>
                      </a>
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
                        {new Date(s.completed_at ?? s.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}

        </>
      )}
    </main>
  );
}

function ClaimDnaBanner() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!user || !user.is_anonymous || done) return null;

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Attach email first (may trigger confirmation), then password.
      const { error: emailErr } = await supabase.auth.updateUser({ email });
      if (emailErr) throw emailErr;
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;
      setDone(true);
      toast.success("Saved. Check your email to confirm — then you can sign in anywhere.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your DNA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-10 border hairline-strong rounded-sm bg-surface px-5 py-5 max-w-2xl">
      <p className="eyebrow mb-2">Save your DNA · Free · 10 seconds</p>
      <p className="font-serif text-lg leading-snug mb-4">
        Right now this reading lives on this device. Drop an email and password to keep it forever and pull it up on your phone.
      </p>
      <form onSubmit={claim} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email" required placeholder="you@somewhere.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-background border hairline-strong rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary"
        />
        <input
          type="password" required minLength={6} placeholder="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex-1 bg-background border hairline-strong rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary"
        />
        <button
          type="submit" disabled={busy}
          className="bg-primary text-primary-foreground rounded-sm px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "Save it"}
        </button>
      </form>
    </section>
  );
}
