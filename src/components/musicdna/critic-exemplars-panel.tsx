import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCriticExemplars, saveCriticExemplar, setCriticExemplarStatus } from "@/lib/critic-exemplars.functions";

export function CriticExemplarsPanel() {
  const list = useServerFn(listCriticExemplars);
  const save = useServerFn(saveCriticExemplar);
  const setStatus = useServerFn(setCriticExemplarStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["critic-exemplars"], queryFn: () => list() });
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [tags, setTags] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["critic-exemplars"] });
  const add = async (t: string, extra: { sessionId?: string; attemptId?: string } = {}) => {
    await save({ data: { text: t, why: why || undefined, tags: tags.split(",").map((s) => s.trim()).filter(Boolean), ...extra } });
    setText(""); setWhy(""); setTags(""); refresh();
  };
  const savedTexts = new Set((q.data?.saved ?? []).map((s: any) => s.text));
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Approved lines become style examples for the final reading writer when <code>MUSICDNA_CRITIC_EXEMPLARS_V1=1</code>. They teach craft only — never copied, never evidence.
      </p>
      <section className="space-y-2 max-w-2xl">
        <p className="eyebrow">Add a line</p>
        <Input placeholder="The line" value={text} onChange={(e) => setText(e.target.value)} />
        <Input placeholder="Why it works (optional)" value={why} onChange={(e) => setWhy(e.target.value)} />
        <Input placeholder="Tags, comma separated: payoff, twist, praise-with-teeth" value={tags} onChange={(e) => setTags(e.target.value)} />
        <Button disabled={text.trim().length < 8} onClick={() => add(text.trim())}>Save as candidate</Button>
      </section>
      <section>
        <p className="eyebrow mb-3">Saved lines</p>
        <ul className="space-y-3">
          {(q.data?.saved ?? []).map((e: any) => (
            <li key={e.id} className="border hairline rounded-sm p-3">
              <p className="font-serif text-lg">“{e.text}”</p>
              {e.why_it_works && <p className="text-sm text-muted-foreground mt-1">{e.why_it_works}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-mono uppercase">
                <span className="text-primary">{e.status}</span>
                {e.tags?.map((t: string) => <span key={t} className="border hairline px-1.5">{t}</span>)}
                {(["approved", "candidate", "retired"] as const).filter((s) => s !== e.status).map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={async () => { await setStatus({ data: { id: e.id, status: s } }); refresh(); }}>
                    {s === "approved" ? "Approve" : s === "retired" ? "Retire" : "Back to candidate"}
                  </Button>
                ))}
              </div>
            </li>
          ))}
          {q.data && q.data.saved.length === 0 && <li className="text-sm text-muted-foreground">No saved lines yet.</li>}
        </ul>
      </section>
      <section>
        <p className="eyebrow mb-3">Recent accepted Critic writing</p>
        <ul className="space-y-3">
          {(q.data?.recent ?? []).map((r: any) => (
            <li key={r.id} className="border-l-2 border-primary pl-3">
              <p className="text-xs font-mono uppercase text-muted-foreground">{r.stage} · {new Date(r.created_at).toLocaleString()}</p>
              {String(r.output_text).split(/(?<=[.!?])\s+/).filter((s) => s.length >= 8).slice(0, 12).map((line: string, i: number) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <button aria-label="Save line" disabled={savedTexts.has(line)} onClick={() => add(line, { sessionId: r.session_id, attemptId: r.id })}
                    className="mt-1 text-muted-foreground hover:text-primary disabled:text-primary">
                    <Star className="h-4 w-4" />
                  </button>
                  <span className="text-sm">{line}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
