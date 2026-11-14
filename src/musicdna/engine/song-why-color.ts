import { z } from "zod";

/** Recording description only: never contributes a vote or claim. */
export const SongWhyColor = z.object({
  id: z.string(),
  song_id: z.string(),
  axis: z.string(),
  score_at_write: z.number().finite(),
  audible_evidence: z.string().min(10).max(300),
  scoring_version: z.string().nullable(),
});
export type SongWhyColor = z.infer<typeof SongWhyColor>;

export function selectSongWhyColor(
  rows: unknown[],
  song: Record<string, unknown>,
  tests: readonly string[],
): SongWhyColor[] {
  return rows
    .flatMap((row) => {
      if (!row || typeof row !== "object" || !("status" in row) || row.status !== "approved")
        return [];
      const parsed = SongWhyColor.safeParse(row);
      if (!parsed.success) return [];
      const why = parsed.data;
      return why.song_id === song.id &&
        tests.includes(why.axis) &&
        song[why.axis] === why.score_at_write
        ? [why]
        : [];
    })
    .sort((a, b) => a.axis.localeCompare(b.axis) || a.id.localeCompare(b.id));
}
