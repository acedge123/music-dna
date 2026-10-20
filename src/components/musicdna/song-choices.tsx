export type ChoiceSong = { id: string; title: string; artist: string; year: number | null };

export function SongChoices({
  songs,
  selectedId,
  busy,
  onChoose,
}: {
  songs: ChoiceSong[];
  selectedId: string | null;
  busy: boolean;
  onChoose: (id: string) => void;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-px overflow-hidden rounded-sm bg-border md:grid-cols-2"
      aria-label="Choose a song"
      aria-busy={busy}
    >
      {songs.map((song) => {
        const selected = selectedId === song.id;
        return (
          <button
            key={song.id}
            type="button"
            aria-pressed={selected}
            disabled={busy || (!!selectedId && !selected)}
            onClick={() => onChoose(song.id)}
            className={`min-h-36 min-w-0 break-words p-6 text-left transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-gold md:p-10 ${selected ? "bg-background ring-2 ring-inset ring-gold" : selectedId ? "bg-surface opacity-50" : "bg-surface hover:bg-background"}`}
          >
            <span className="mb-3 block min-h-4 font-mono text-xs text-muted-foreground">
              {selected ? "✓ Your choice" : (song.year ?? "Song")}
            </span>
            <span className="mb-2 block font-serif text-2xl leading-tight md:text-3xl">
              {song.title}
            </span>
            <span className="block text-sm text-muted-foreground">{song.artist}</span>
          </button>
        );
      })}
    </div>
  );
}
