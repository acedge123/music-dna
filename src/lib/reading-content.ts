import { z } from "zod";

export type ReadingContent = {
  synthesis: string;
  kept_choosing: Array<{
    tradeoff: string;
    examples: string[];
    supporting: number;
    tested: number;
  }>;
  counter_reads: Array<{ claim: string; notes: string }>;
  result_version?: number | null;
};

const ContentSchema = z.object({
  synthesis: z.string(),
  kept_choosing: z.array(
    z.object({
      tradeoff: z.string(),
      examples: z.array(z.string()),
      supporting: z.number(),
      tested: z.number(),
    }),
  ),
  counter_reads: z.array(z.object({ claim: z.string(), notes: z.string() })),
});

export function parseReadingContent(value: unknown): ReadingContent | null {
  const parsed = ContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readingExamples(content: ReadingContent): string[] {
  return [...new Set(content.kept_choosing.flatMap((claim) => claim.examples))].slice(0, 2);
}
