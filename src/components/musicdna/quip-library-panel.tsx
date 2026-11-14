import { useMemo, useState } from "react";
import { ArrowDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FILLER_DECADE, FILLER_REACTION, FILLER_SKIP, SKIP_YOUNG, SKIP_OLD } from "@/musicdna/engine/critic-fillers";
import { NEUTRAL_QUIP_GROUPS, PERSON_QUIP_GROUPS, eraQuipGroups, type QuipGroup } from "@/lib/quip-sequences";

type LibraryGroup = QuipGroup & { category: string; condition?: string };
const groups: LibraryGroup[] = [
  ...NEUTRAL_QUIP_GROUPS.map((g) => ({ ...g, category: "Neutral" })),
  ...PERSON_QUIP_GROUPS.map((g) => ({ ...g, category: "Personality" })),
  ...Object.entries(FILLER_REACTION).flatMap(([hunch, lines]) => lines.map((line, index) => ({
    id: `reaction-${hunch}-${index}`, tone: "reaction" as const, lines: [line], category: "Reaction",
    condition: hunch === "against" ? "Contradicts the prior lean" : hunch === "with" ? "Supports the prior lean" : "Early / unsettled read",
    incompatibleWith: hunch === "early" ? [] : ["Unrelated praise", "Opposite prediction"],
  }))),
  ...Object.keys(FILLER_DECADE).flatMap((decade) => eraQuipGroups(decade).map((g) => ({ ...g, category: decade, condition: "Both songs share this decade" }))),
  ...FILLER_SKIP.map((line, index) => ({ id: `skip-${index}`, tone: "neutral" as const, lines: [line], category: "Skip", condition: "Skipped matchup; {artist} comes from the songs shown", incompatibleWith: [] })),
  { id: "skip-young", tone: "neutral", lines: [SKIP_YOUNG], category: "Skip", condition: "Both skipped songs before 2000; never an age inference", incompatibleWith: [] },
  { id: "skip-recent", tone: "neutral", lines: [SKIP_OLD], category: "Skip", condition: "Both skipped songs from 2020 onward", incompatibleWith: [] },
];
const categories = ["All", "Personality", "Neutral", "Reaction", "Skip", ...Object.keys(FILLER_DECADE)];
const tones: Record<QuipGroup["tone"], string> = { neutral: "Neutral", praise: "Praise + dry wit", "dry-authority": "Dry authority", era: "Era humour", reaction: "Conditional reaction" };

export function QuipLibraryPanel() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const shown = useMemo(() => groups.filter((group) =>
    (category === "All" || group.category === category) &&
    `${group.lines.join(" ")} ${group.condition ?? ""} ${tones[group.tone]}`.toLowerCase().includes(search.toLowerCase()),
  ), [category, search]);
  return (
    <section className="space-y-6" aria-label="Quip library">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-serif text-3xl">Quips</h2>
        <p className="font-mono text-xs text-muted-foreground">Read-only · {groups.reduce((n, g) => n + g.lines.length, 0)} lines · {groups.length} groups</p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input aria-label="Search quips" placeholder="Search quips…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select aria-label="Quip category" value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-10 rounded border border-input bg-background px-3 text-sm">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <p className="font-mono text-xs text-muted-foreground">{shown.length} groups</p>
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((group) => (
          <article key={group.id} className="min-w-0 rounded border border-border p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{group.category}</span><span>·</span><span>{tones[group.tone]}</span>
              <span className="ml-auto border border-border rounded px-2 py-1">{group.lines.length > 1 ? "Linked · fixed order" : "Standalone"}</span>
            </div>
            <ol className="space-y-3">
              {group.lines.map((line, index) => <li key={line} className="space-y-2">
                {index > 0 && <ArrowDown aria-label="Then" className="size-4 text-primary" />}
                <p className="text-xs font-mono text-muted-foreground">{group.lines.length > 1 ? `${index + 1} · ${index === 0 ? "Setup" : "Punchline"}` : "Single beat"}</p>
                <p className="font-serif text-xl italic leading-snug break-words">{line}</p>
              </li>)}
            </ol>
            {group.condition && <p className="border-t border-border pt-3 text-xs text-muted-foreground">Only when · {group.condition}</p>}
            <details className="border-t border-border pt-3 text-sm">
              <summary className="cursor-pointer min-h-8 text-muted-foreground">Relationships</summary>
              <dl className="space-y-3 pt-3 text-xs">
                <div><dt className="font-medium">Order</dt><dd className="text-muted-foreground">{group.lines.length > 1 ? "Setup → punchline. Keep together; never shuffle or orphan the second line." : "No required predecessor."}</dd></div>
                <div><dt className="font-medium">Works between</dt><dd className="text-muted-foreground">Neutral or same-era beats; not a new evidence claim.</dd></div>
                {group.tone === "praise" && <div><dt className="font-medium">Avoid stacking</dt><dd className="text-muted-foreground">Another unrelated praise group directly afterward.</dd></div>}
                <div><dt className="font-medium">Excluded from this queue</dt><dd className="text-muted-foreground">{group.incompatibleWith.length ? group.incompatibleWith.map((id) => id === "reaction-with" ? "Confident prediction" : id === "reaction-against" ? "Unexpected-choice prediction" : id).join(" · ") : "No explicit exclusions"}</dd></div>
                <div><dt className="font-medium">Reference</dt><dd className="font-mono text-muted-foreground break-all">{group.id}</dd></div>
              </dl>
            </details>
          </article>
        ))}
      </div>
      {shown.length === 0 && <p className="py-12 text-center text-muted-foreground">No matching quips.</p>}
    </section>
  );
}