import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDecadeCoverage } from "@/lib/explore.functions";
import {
  cellStatus,
  DECADE_LABEL,
  READY_MIN_PAIRINGS,
  READY_MIN_TRAITS,
  type Decade,
} from "@/musicdna/engine/decades";

const CELL = {
  ready: "bg-primary/20 text-foreground",
  thin: "bg-muted text-foreground",
  empty: "text-muted-foreground",
} as const;

export function DecadeCoveragePanel() {
  const fn = useServerFn(getDecadeCoverage);
  const q = useQuery({ queryKey: ["admin", "decade-coverage"], queryFn: () => fn() });
  if (q.isLoading)
    return <p className="text-sm text-muted-foreground">Counting playable matchups…</p>;
  if (q.error || !q.data)
    return (
      <p role="alert" className="text-sm text-destructive">
        Couldn't load coverage.
      </p>
    );
  const { dims, coverage } = q.data;
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Live matchups by decade × trait (both songs in the decade, one year early leeway, genre-era
        rules applied). A decade unlocks for listeners at {READY_MIN_PAIRINGS}+ matchups covering{" "}
        {READY_MIN_TRAITS}+ traits. Cells: 3+ ready, 1–2 thin, 0 empty.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3 font-mono text-xs uppercase">Decade</th>
              <th className="py-2 pr-3 font-mono text-xs uppercase">Matchups</th>
              <th className="py-2 pr-3 font-mono text-xs uppercase">Traits</th>
              {dims.map((d) => (
                <th key={d} className="py-2 px-1 font-mono text-[10px] uppercase">
                  {d}
                </th>
              ))}
              <th className="py-2 pl-3 font-mono text-xs uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((c) => (
              <tr key={c.decade} className="border-t hairline">
                <td className="py-2 pr-3 font-medium">{DECADE_LABEL[c.decade as Decade]}</td>
                <td className="py-2 pr-3">{c.pairings}</td>
                <td className="py-2 pr-3">
                  {c.traits_covered}/{dims.length}
                </td>
                {dims.map((d) => {
                  const n = c.by_trait[d] ?? 0;
                  return (
                    <td key={d} className={`py-2 px-1 text-center ${CELL[cellStatus(n)]}`}>
                      {n}
                    </td>
                  );
                })}
                <td className="py-2 pl-3">{c.ready ? "Live" : "Hidden"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
