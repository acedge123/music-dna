// Summarize critic-moves-experiment results; blind model-judged originality (A/B shuffled).
// Usage: bun tools/musicdna/critic-moves-report.ts /tmp/critic-moves /mnt/documents/critic-moves-test
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const [dir = "/tmp/critic-moves", out = dir] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
type R = { session: string; pick: number; rep: number; arm: string; total_ms: number; calls: Array<{ phase: string; ms: number }>; status: string; first_pass: boolean; rejections: Array<{ reason: string; failed: Array<{ check: string; span: string }> | null }>; text: string | null; transport_error: string | null };
const all = JSON.parse(readFileSync(`${dir}/results.json`, "utf8")) as R[];
const rows = all.filter((r) => !r.transport_error);
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))] : 0; };

async function judge(a: string, b: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6.1-terra", reasoning_effort: "low",
      messages: [{ role: "user", content: `Two music-critic reactions to the same listener pick. Score each 1-5 for ORIGINALITY/WIT (fresh, surprising, personality; not safe or formulaic) and pick which one you'd rather keep talking to. Return JSON.\nA: ${a}\nB: ${b}` }],
      response_format: { type: "json_schema", json_schema: { name: "judge", strict: true, schema: { type: "object", additionalProperties: false, required: ["a", "b", "prefer"], properties: { a: { type: "integer" }, b: { type: "integer" }, prefer: { type: "string", enum: ["A", "B"] } } } } },
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return JSON.parse(j.choices[0].message.content) as { a: number; b: number; prefer: "A" | "B" };
}

const lines = ["# Critic \"three moves\" experiment", "", `Previously rejected after-pick moments rerun: ${new Set(rows.map((r) => `${r.session}:${r.pick}`)).size}; scored runs: ${rows.length} (excluded ${all.length - rows.length} that failed to reach the model)`, "",
  "| Arm | Runs | First-pass accepted | Accepted at all | Fallback | Median s | p95 s | Avg words | Ends with a question | Reviewer flags (motive / other) |", "|---|---|---|---|---|---|---|---|---|---|"];
for (const arm of ["current", "moves"]) {
  const rs = rows.filter((r) => r.arm === arm); const n = rs.length || 1;
  const t = rs.map((r) => r.total_ms / 1000); const ok = rs.filter((r) => r.text);
  const flags = rs.flatMap((r) => r.rejections.flatMap((a) => a.failed ?? []));
  const motive = flags.filter((f) => f.check === "unsupported_motive").length;
  lines.push(`| ${arm} | ${rs.length} | ${Math.round(100 * rs.filter((r) => r.first_pass).length / n)}% | ${Math.round(100 * ok.length / n)}% | ${Math.round(100 * (rs.length - ok.length) / n)}% | ${q(t, 0.5).toFixed(1)} | ${q(t, 0.95).toFixed(1)} | ${ok.length ? Math.round(ok.reduce((s, r) => s + r.text!.split(/\s+/).length, 0) / ok.length) : 0} | ${ok.length ? Math.round(100 * ok.filter((r) => r.text!.trim().endsWith("?")).length / ok.length) : 0}% | ${motive} / ${flags.length - motive} |`);
}
// Blind judging: pair current vs moves for the same moment and rep.
const sheet = ["# Blind sheet (A/B shuffled; key in critic-moves-key.txt)", ""]; const key: string[] = [];
let sa = 0, sb = 0, pref = 0, judged = 0, i = 0;
const scores = { current: [] as number[], moves: [] as number[] };
for (const c of rows.filter((r) => r.arm === "current" && r.text)) {
  const m = rows.find((r) => r.arm === "moves" && r.text && r.session === c.session && r.pick === c.pick && r.rep === c.rep);
  if (!m) continue;
  i++; const flip = Math.random() < 0.5; const A = flip ? m : c; const B = flip ? c : m;
  sheet.push(`## Item ${i}`, `**A:** ${A.text}`, "", `**B:** ${B.text}`, ""); key.push(`Item ${i}: A=${A.arm} B=${B.arm}`);
  const j = await judge(A.text!, B.text!); if (!j) continue;
  judged++; scores[A.arm as "current" | "moves"].push(j.a); scores[B.arm as "current" | "moves"].push(j.b);
  if ((j.prefer === "A" ? A : B).arm === "moves") pref++;
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0).toFixed(2);
lines.push("", `Blind originality/wit (independent model judge, 1-5, ${judged} pairs): current ${avg(scores.current)}, moves ${avg(scores.moves)}; judge preferred "moves" in ${pref}/${judged}.`);
lines.push("", "Example moves replies:", ...rows.filter((r) => r.arm === "moves" && r.text).slice(0, 6).map((r) => `- ${r.text!.replace(/\n+/g, " ")}`));
writeFileSync(`${out}/critic-moves-summary.md`, lines.join("\n") + "\n");
writeFileSync(`${out}/critic-moves-blind-sheet.md`, sheet.join("\n"));
writeFileSync(`${out}/critic-moves-key.txt`, key.join("\n"));
console.log(lines.join("\n"));
