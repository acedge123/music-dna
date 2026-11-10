# Summarizes critic-speed-experiment output and writes a blind A/B sheet.
import json, glob, random, re, statistics as st, sys
d = sys.argv[1] if len(sys.argv) > 1 else "/tmp/critic-exp"
out = sys.argv[2] if len(sys.argv) > 2 else d
rows = [r for f in sorted(glob.glob(f"{d}/scenario-*.json")) for r in json.load(open(f))]
def pct(xs, p):
    xs = sorted(xs); return xs[min(len(xs)-1, int(round(p*(len(xs)-1))))] if xs else 0
def grams(t, n=4):
    w = re.findall(r"[a-z']+", (t or "").lower()); return {tuple(w[i:i+n]) for i in range(len(w)-n+1)}
lines = ["# Critic speed experiment: Current vs Faster", "", f"Scenarios: {len({r['session'] for r in rows})}, stage runs: {len(rows)}", ""]
lines += ["| Arm | Stage | Runs | First-pass accepted | Accepted at all | Fallback | Unsupported-claim rejections | Median s | p95 s | Writer median s | Reviewer median s | Avg words | Repeated 4-grams vs own earlier replies |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
for arm in ["current", "faster"]:
    for kind in ["read", "chat"]:
        rs = [r for r in rows if r["arm"] == arm and r["kind"] == kind]
        if not rs: continue
        n = len(rs); fp = sum(r["first_pass"] for r in rs); ok = sum(r["status"] == "ok" for r in rs)
        uns = sum(1 for r in rs for a in r["rejections"] if a["reason"] not in ("invalid_json",))
        t = [r["total_ms"]/1000 for r in rs]
        w = [c["ms"]/1000 for r in rs for c in r["calls"] if c["phase"] == "writer"]
        v = [c["ms"]/1000 for r in rs for c in r["calls"] if c["phase"] == "reviewer"]
        words = [len((r["text"] or "").split()) for r in rs if r["text"]]
        rep = []
        for s in {r["session"] for r in rs}:
            seen = set()
            for r in [x for x in rs if x["session"] == s]:
                g = grams(r["text"]);
                if g: rep.append(len(g & seen) / len(g)); seen |= g
        lines.append(f"| {arm} | {kind} | {n} | {fp/n:.0%} | {ok/n:.0%} | {(n-ok)/n:.0%} | {uns} | {st.median(t):.1f} | {pct(t,.95):.1f} | {st.median(w):.1f} | {st.median(v):.1f} | {st.mean(words) if words else 0:.0f} | {st.mean(rep) if rep else 0:.0%} |")
open(f"{out}/critic-speed-summary.md", "w").write("\n".join(lines) + "\n")
# Blind sheet: same stage, both arms, randomized A/B. Key kept separately.
random.seed(7); sheet = ["# Blind critic comparison", "Score each: groundedness, musical specificity, originality, relevance, entertainment (1-5), and which you'd rather keep talking to.", ""]; key = []
by = {}
for r in rows: by.setdefault((r["session"], r.get("pick"), r.get("chat")), {})[r["arm"]] = r
for i, (k, v) in enumerate(by.items()):
    if "current" not in v or "faster" not in v: continue
    arms = ["current", "faster"]; random.shuffle(arms)
    sheet += [f"## Item {i+1} ({'chat: ' + k[2] if k[2] else 'after pick ' + str(k[1])})", f"**A:** {v[arms[0]]['text'] or '(fallback)'}", "", f"**B:** {v[arms[1]]['text'] or '(fallback)'}", ""]
    key.append(f"Item {i+1}: A={arms[0]} B={arms[1]}")
open(f"{out}/critic-blind-sheet.md", "w").write("\n".join(sheet)); open(f"{out}/critic-blind-key.txt", "w").write("\n".join(key))
print("\n".join(lines))
