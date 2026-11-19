import { createHash } from "node:crypto";
import { z } from "zod";
import { McpError } from "./access";
export const pageSchema = {
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().max(5000).optional(),
};
const cursorSchema = z
  .object({
    v: z.literal(1),
    owner: z.string().uuid(),
    query: z.string(),
    last: z.string().uuid(),
    snapshot: z.string().datetime(),
    total: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();
export function queryHash(value: unknown) {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(sort(value)))
    .digest("hex");
}
export function pageCursor(cursor: string | undefined, owner: string, filters: unknown) {
  const query = queryHash(filters);
  if (!cursor)
    return {
      query,
      snapshot: new Date().toISOString(),
      last: undefined,
      total: undefined as number | null | undefined,
    };
  try {
    const value = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (
      value.owner !== owner ||
      value.query !== query ||
      Date.now() - Date.parse(value.snapshot) > 3600000 ||
      Date.parse(value.snapshot) > Date.now() + 1000
    )
      throw new Error();
    return value;
  } catch {
    throw new McpError("INVALID_CURSOR");
  }
}
export function nextCursor(
  owner: string,
  state: { query: string; snapshot: string; total?: number | null },
  last: string,
) {
  return Buffer.from(JSON.stringify({ v: 1, owner, ...state, last })).toString("base64url");
}
/** Escape PostgREST LIKE patterns: caller input can never become an OR expression. */
export function safeSearch(text: string) {
  return text
    .replace(/[%,()\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reduce a page at record boundaries; the cursor always follows the last returned record. */
export function boundedRows<T>(rows: T[], limit: number, budget = 18000): T[] {
  const page: T[] = [];
  let bytes = 0;
  for (const row of rows.slice(0, limit)) {
    const n = Buffer.byteLength(JSON.stringify(row));
    if (bytes + n > budget) {
      if (!page.length) throw new McpError("RECORD_REQUIRES_EXPORT");
      break;
    }
    page.push(row);
    bytes += n;
  }
  return page;
}
