import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DIMS, DIM_LABEL } from "@/musicdna/engine/axes";
import { distinctiveTraits, explanationIsCurrent } from "@/musicdna/engine/song-whys";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export const WHY_BATCH = 10;
const SONG_COLS = `id,title,artist,year,primary_lane,scoring_version,${DIMS.join(",")}`;

/** Active songs ordered by how often listeners picked them, still missing explanations. */
async function nextSongs(db: any, limit: number) {
  const [{ data: songs }, { data: picks }, { data: done }] = await Promise.all([
    db.from("songs").select(SONG_COLS).eq("active", true).limit(5000),
    db.from("choices").select("chosen_song_id,rejected_song_id").limit(20000),
    db.from("song_trait_explanations").select("song_id,axis,score_at_write,status").limit(20000),
  ]);
  const count = new Map<string, number>();
  for (const c of picks ?? []) for (const id of [c.chosen_song_id, c.rejected_song_id]) if (id) count.set(id, (count.get(id) ?? 0) + 1);
  const covered = new Set(
    (done ?? []).filter((d: any) => d.status !== "rejected").map((d: any) => `${d.song_id}|${d.axis}|${d.score_at_write}`),
  );
  return (songs ?? [])
    .map((s: any) => ({ s, traits: distinctiveTraits(s).filter((t) => !covered.has(`${s.id}|${t.axis}|${t.score}`)) }))
    .filter((x: any) => x.traits.length)
    .sort((a: any, b: any) => (count.get(b.s.id) ?? 0) - (count.get(a.s.id) ?? 0) || a.s.title.localeCompare(b.s.title))
    .slice(0, limit);
}

export const songWhysOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const remaining = await nextSongs(context.supabase, 100000);
    const { data } = await context.supabase.from("song_trait_explanations").select("status").limit(20000);
    const totals: Record<string, number> = {};
    for (const r of data ?? []) totals[r.status] = (totals[r.status] ?? 0) + 1;
    return {
      totals,
      songs_remaining: remaining.length,
      next_batch: remaining.slice(0, WHY_BATCH).map((x: any) => `${x.s.title} — ${x.s.artist}`),
      // Writer + reviewer per song.
      next_batch_calls: Math.min(WHY_BATCH, remaining.length) * 2,
    };
  });

const WRITER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["axis", "audible_evidence", "interpretation"],
        properties: {
          axis: { type: "string" },
          audible_evidence: { type: "string" },
          interpretation: { type: "string" },
        },
      },
    },
  },
};
const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["axis", "verdict", "note"],
        properties: {
          axis: { type: "string" },
          verdict: { type: "string", enum: ["pass", "fail"] },
          note: { type: "string" },
        },
      },
    },
  },
};

export const draftSongWhys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { callLovableAi } = await import("@/musicdna/adapters/llm-gateway");
    const batch = await nextSongs(context.supabase, WHY_BATCH);
    let drafted = 0, rejected = 0, failed = 0;
    await Promise.all(
      batch.map(async ({ s, traits }: any) => {
        const traitLines = traits
          .map((t: any) => {
            const l = DIM_LABEL[t.axis];
            return `- ${t.axis}: ${t.score}/100 (100 = ${l.hi}, 0 = ${l.lo}; this song leans ${t.score > 50 ? l.hi : l.lo})`;
          })
          .join("\n");
        const song = `"${s.title}" by ${s.artist}${s.year ? ` (${s.year})` : ""}, ${s.primary_lane}`;
        try {
          const written = JSON.parse(
            await callLovableAi(
              [
                {
                  role: "user",
                  content: `You are a sharp, musically literate critic. For ${song}, explain WHY it scores as it does on each trait below.
${traitLines}
For each trait: audible_evidence = what a listener can actually hear (production, arrangement, rhythm, vocal delivery, dynamics), concrete and specific to THIS recording, max 160 chars. interpretation = one short line on what that sound means for the trait, max 140 chars.
No chart facts, dates, personnel or trivia. If you are not confident about the recording, write audible_evidence "UNSURE". Use the trait keys exactly.`,
                },
              ],
              { role: "writer", stage: "chat", jsonSchema: { name: "song_whys", schema: WRITER_SCHEMA } },
            ),
          ) as { items: { axis: string; audible_evidence: string; interpretation: string }[] };
          const items = written.items.filter(
            (i) => traits.some((t: any) => t.axis === i.axis) && !/UNSURE/i.test(i.audible_evidence),
          );
          if (!items.length) return;
          const review = JSON.parse(
            await callLovableAi(
              [
                {
                  role: "user",
                  content: `Independent music reviewer. Check each explanation for ${song} against what this recording actually sounds like.
Fail it if it describes a sound the recording does not have, is generic enough to fit most songs, includes invented facts (personnel, chart, dates), or doesn't support the score direction.
Scores:\n${traitLines}\nExplanations:\n${JSON.stringify(items)}`,
                },
              ],
              { role: "reviewer", stage: "chat", jsonSchema: { name: "song_whys_review", schema: REVIEW_SCHEMA } },
            ),
          ) as { items: { axis: string; verdict: string; note: string }[] };
          for (const i of items) {
            const v = review.items.find((r) => r.axis === i.axis);
            if (v?.verdict !== "pass") {
              rejected++;
              continue;
            }
            const t = traits.find((x: any) => x.axis === i.axis);
            const { error } = await context.supabase.from("song_trait_explanations").insert({
              song_id: s.id,
              axis: i.axis,
              score_at_write: t.score,
              audible_evidence: i.audible_evidence.trim().slice(0, 300),
              interpretation: i.interpretation.trim().slice(0, 300),
              scoring_version: s.scoring_version,
              drafted_by: "sol",
              review_note: v.note.slice(0, 300),
            });
            if (error) failed++;
            else drafted++;
          }
        } catch {
          failed++;
        }
      }),
    );
    return { songs: batch.length, drafted, rejected, failed };
  });

export const listSongWhys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["pending_review", "approved", "rejected"]), page: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error, count } = await context.supabase
      .from("song_trait_explanations")
      .select(`id,axis,score_at_write,audible_evidence,interpretation,status,review_note,songs(title,artist,year,primary_lane,${DIMS.join(",")})`, { count: "exact" })
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .range(data.page * 50, data.page * 50 + 49);
    if (error) throw new Error(error.message);
    return {
      count: count ?? 0,
      rows: (rows ?? []).map((r: any) => ({
        id: r.id as string,
        axis: r.axis as string,
        score: r.score_at_write as number,
        stale: r.songs ? !explanationIsCurrent(r, Number(r.songs[r.axis])) : false,
        audible_evidence: r.audible_evidence as string,
        interpretation: r.interpretation as string,
        review_note: r.review_note as string | null,
        song: r.songs ? `${r.songs.title} — ${r.songs.artist}` : "",
        lane: r.songs?.primary_lane ?? "",
        year: r.songs?.year ?? null,
      })),
    };
  });

export const reviewSongWhy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "pending_review"]),
        audible_evidence: z.string().trim().min(10).max(300).optional(),
        interpretation: z.string().trim().min(10).max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = {
      status: data.status,
      confidence: data.status === "approved" ? "reviewed" : "pending_review",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    };
    if (data.audible_evidence) patch.audible_evidence = data.audible_evidence;
    if (data.interpretation) patch.interpretation = data.interpretation;
    const { error } = await context.supabase.from("song_trait_explanations").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
