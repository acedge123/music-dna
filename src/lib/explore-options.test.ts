import { expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { readFileSync } from "fs";

it("decade runs list only includes explore children, never refine (null decade)", () => {
  const src = readFileSync("src/lib/explore.functions.ts", "utf8");
  const block = src.slice(src.indexOf('.eq("parent_session_id", rootId)'), src.indexOf("decades: coverage"));
  expect(block).toContain('.eq("mode", "explore")');
});
