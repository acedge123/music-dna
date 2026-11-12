import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DIM_LABEL } from "@/musicdna/engine/axes";
import {
  listArchetypeProfiles,
  reviewArchetypeProfile,
  songExplanationCoverage,
} from "@/lib/archetype-profiles.functions";

function pole(axis: string, w: number) {
  const l = DIM_LABEL[axis];
  return `${w > 0 ? l?.hi : l?.lo} (${Math.abs(w).toFixed(1)})`;
}

export function ArchetypeProfilesPanel() {
  const list = useServerFn(listArchetypeProfiles);
  const review = useServerFn(reviewArchetypeProfile);
  const coverage = useServerFn(songExplanationCoverage);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "archetype-profiles"], queryFn: () => list() });
  const cov = useQuery({ queryKey: ["admin", "song-explanations"], queryFn: () => coverage() });
  const set = async (id: string, status: "draft" | "approved" | "retired") => {
    try {
      await review({ data: { id, status } });
      toast.success(status === "approved" ? "Profile approved" : "Profile updated");
      void qc.invalidateQueries({ queryKey: ["admin", "archetype-profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading profiles…</p>;
  if (q.isError) return <p className="text-sm text-destructive">Couldn't load profiles.</p>;
  const approved = q.data.filter((p) => p.status === "approved").length;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Archetype profiles on today's 10 traits. {approved} of {q.data.length} approved. Readings
        use them only after approval and when the archetype v2 switch is on; until then every
        reading shows an emerging signature.
      </p>
      {cov.data && (
        <p className="text-sm text-muted-foreground">
          Song "why this score" explanations: {cov.data.approved_songs} approved,{" "}
          {cov.data.pending_songs} pending, of {cov.data.active_songs} active songs.
        </p>
      )}
      <ul className="space-y-4">
        {q.data.map((p) => (
          <li key={p.id} className="space-y-2 border hairline rounded-sm p-4">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-serif text-xl">
                {p.name} <span className="font-mono text-xs text-muted-foreground">v{p.version}</span>
              </h3>
              <span className="font-mono text-xs uppercase">{p.status}</span>
            </div>
            <p className="text-sm">
              Core: {Object.entries(p.core).map(([a, w]) => pole(a, w)).join(" · ")}
            </p>
            {p.distinguishers && <p className="text-sm text-muted-foreground">{p.distinguishers}</p>}
            {p.thematic_note && (
              <p className="text-sm text-muted-foreground">Thematic: {p.thematic_note}</p>
            )}
            <div className="flex gap-2">
              {p.status !== "approved" && (
                <Button size="sm" onClick={() => void set(p.id, "approved")}>
                  Approve
                </Button>
              )}
              {p.status === "approved" && (
                <Button size="sm" variant="outline" onClick={() => void set(p.id, "draft")}>
                  Back to draft
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
