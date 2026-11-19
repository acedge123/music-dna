import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseSongWhyReview, reviewStorageFields } from "./song-why-review";

it("stores failed score advice durably while preserving the 95 catalog score and historical evidence", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.songs (id integer PRIMARY KEY, confidence integer);
      CREATE TABLE public.choices (evidence jsonb);
      CREATE TABLE public.song_trait_explanations (id integer PRIMARY KEY, status text, review_note text);
      INSERT INTO public.songs VALUES (1,95);
      INSERT INTO public.choices VALUES ('{"confidence":95}');
      INSERT INTO public.song_trait_explanations VALUES (1,'approved','Historical review');
    `);
    await db.exec(
      readFileSync(
        new URL(
          "../../../supabase/migrations/20261119050947_3adcdaba-b292-4647-98ae-c258095cd09f.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const [review] = parseSongWhyReview(
      {
        items: [
          {
            axis: "confidence",
            verdict: "fail",
            note: "Not command.",
            score_disputed: true,
            suggested_score: 25,
            reason: "Restraint is mistaken for defiance.",
          },
        ],
      },
      ["confidence"],
    );
    if (!review) throw new Error("Missing review");
    const fields = reviewStorageFields(review);
    await db.query(
      "INSERT INTO public.song_trait_explanations (id,status,review_note,model_review_verdict,score_disputed,suggested_score,score_dispute_reason) VALUES (2,$1,$2,$3,$4,$5,$6)",
      [
        fields.status,
        fields.review_note,
        fields.model_review_verdict,
        fields.score_disputed,
        fields.suggested_score,
        fields.score_dispute_reason,
      ],
    );
    expect(
      (
        await db.query(
          "SELECT status,score_disputed,suggested_score,score_dispute_reason FROM public.song_trait_explanations WHERE id=2",
        )
      ).rows,
    ).toEqual([
      {
        status: "pending_review",
        score_disputed: true,
        suggested_score: 25,
        score_dispute_reason: "Restraint is mistaken for defiance.",
      },
    ]);
    expect((await db.query("SELECT confidence FROM public.songs")).rows).toEqual([
      { confidence: 95 },
    ]);
    expect((await db.query("SELECT evidence FROM public.choices")).rows).toEqual([
      { evidence: { confidence: 95 } },
    ]);
    expect(
      (
        await db.query(
          "SELECT status,model_review_verdict,score_disputed FROM public.song_trait_explanations WHERE id=1",
        )
      ).rows,
    ).toEqual([{ status: "approved", model_review_verdict: null, score_disputed: false }]);
    await expect(
      db.exec("UPDATE public.song_trait_explanations SET suggested_score=101 WHERE id=2"),
    ).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 30_000);
