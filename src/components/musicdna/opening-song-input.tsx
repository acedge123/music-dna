import { useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  SONG_SEARCH_MIN_CHARS,
  normalizeQuery,
  suggestionLabel,
  type SongSuggestion,
} from "@/musicdna/engine/song-search";
import { currentSongSearch, type SongSearchState } from "@/musicdna/engine/song-search-state";

// Opener input with catalog autocomplete. Suggestions only confirm identity;
// the submitted value stays the plain "Title — Artist" string.
export function OpeningSongInput({
  rank,
  label,
  value,
  placeholder,
  onChange,
  onEnter,
  autoFocus,
}: {
  rank: number;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const [search, setSearch] = useState<SongSearchState>({
    query: "",
    status: "success",
    results: [],
  });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<SongSuggestion | null>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const confirmed = picked && suggestionLabel(picked) === value ? picked : null;
  const current = currentSongSearch(search, value.trim());
  const results = current.results;

  useEffect(() => {
    const q = value.trim();
    if (confirmed || normalizeQuery(q).length < SONG_SEARCH_MIN_CHARS) {
      setSearch({ query: q, status: "success", results: [] });
      return;
    }
    const ctrl = new AbortController();
    setSearch({ query: q, status: "pending", results: [] });
    setActive(-1);
    const t = setTimeout(() => {
      fetch(`/api/v1/songs/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => {
          if (!r.ok) throw new Error("Search unavailable");
          return r.json();
        })
        .then((d: { results?: SongSuggestion[] }) => {
          if (ctrl.signal.aborted) return;
          setSearch({ query: q, status: "success", results: d.results ?? [] });
          setActive(-1);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setSearch({ query: q, status: "error", results: [] });
        });
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, confirmed]);

  const choose = (s: SongSuggestion) => {
    setPicked(s);
    onChange(suggestionLabel(s));
    setOpen(false);
    setSearch({ query: suggestionLabel(s), status: "success", results: [] });
  };
  const showList = open && results.length > 0 && !confirmed;
  const showMiss =
    open &&
    !confirmed &&
    current.status === "success" &&
    results.length === 0 &&
    normalizeQuery(value).length >= 4;

  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 items-baseline">
      <div className="text-right">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          #{rank}
        </p>
      </div>
      <div className="min-w-0 relative">
        <label
          htmlFor={`opening-song-${rank}`}
          className="mb-1 block font-mono text-xs text-muted-foreground"
        >
          {label}
        </label>
        <div className="border-b-2 hairline-strong focus-within:border-primary transition-colors pb-1">
          <input
            ref={ref}
            id={`opening-song-${rank}`}
            value={value}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-busy={current.status === "pending"}
            autoComplete="off"
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => {
              onChange(e.target.value);
              setPicked(null);
              setActive(-1);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (showList && e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(results.length - 1, i + 1));
              } else if (showList && e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(-1, i - 1));
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                const hit = showList && active >= 0 ? results[active] : undefined;
                if (hit) choose(hit);
                else onEnter?.();
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-xl md:text-2xl font-serif italic py-2 placeholder:text-muted-foreground/40 placeholder:not-italic placeholder:font-serif focus:outline-none"
          />
        </div>
        {confirmed && (
          <p
            role="status"
            className="mt-2 flex items-center gap-1.5 font-mono text-xs text-primary"
          >
            <Check aria-hidden="true" className="size-3.5" />
            Got it: {confirmed.title} — {confirmed.artist}
            {confirmed.year ? `, ${confirmed.year}` : ""}
          </p>
        )}
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-sm border bg-popover text-popover-foreground shadow-md"
          >
            <li className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Which one?
            </li>
            {results.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                className={`flex min-h-11 cursor-pointer items-baseline justify-between gap-3 px-3 py-2 ${i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}
              >
                <span className="min-w-0 truncate">
                  <span className="font-serif italic">{s.title}</span>
                  <span className="text-muted-foreground"> — {s.artist}</span>
                </span>
                {s.year && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.year}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {showMiss && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Not in my crates yet — I'll take it as typed. Add the artist so I get it right.
          </p>
        )}
        {open && !confirmed && current.status === "error" && (
          <p role="status" className="mt-2 font-mono text-xs text-muted-foreground">
            Song search is unavailable — I'll take it as typed. Add the artist so I get it right.
          </p>
        )}
      </div>
    </div>
  );
}
