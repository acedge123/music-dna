import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { draftTimeline } from "@/lib/critic-quality.functions";

const secs = (a: string | null, b: string | null) =>
  a && b ? `${((Date.parse(b) - Date.parse(a)) / 1000).toFixed(1)}s` : "—";

export function DraftTimelinePanel() {
  const [sid, setSid] = useState("");
  const fn = useServerFn(draftTimeline);
  const m = useMutation({ mutationFn: (sessionId: string) => fn({ data: { sessionId } }) });
  return (
    <section className="space-y-3 border-t hairline pt-4">
      <h3 className="display text-2xl">Background draft timeline</h3>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); m.mutate(sid.trim()); }}>
        <Input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="Session ID" />
        <Button type="submit" disabled={m.isPending}>Load</Button>
      </form>
      {m.isError && <p className="text-sm text-destructive">{(m.error as Error).message}</p>}
      {m.data && (
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th>Pick</th><th>Kind</th><th>Song</th><th>Status</th><th>Draft took</th><th>Ready vs tap</th><th>Outcome</th><th>Pick waited</th>
          </tr></thead>
          <tbody>
            {m.data.rows.map((r) => (
              <tr key={`${r.answered}-${r.pairing_id}-${r.chosen_song_id}`} className="border-t hairline">
                <td>{Math.abs(r.answered)}</td>
                <td>{r.answered < 0 ? "reveal" : "reaction"}</td>
                <td title={r.chosen_song_id}>{r.chosen_song_id.slice(0, 8)}</td>
                <td>{r.status}</td>
                <td>{secs(r.started_at, r.finished_at)}</td>
                <td>{r.requested_at && r.finished_at ? secs(r.requested_at, r.finished_at) : "—"}</td>
                <td>{r.outcome ?? "unused"}</td>
                <td>{r.wait_ms != null ? `${(r.wait_ms / 1000).toFixed(1)}s` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
