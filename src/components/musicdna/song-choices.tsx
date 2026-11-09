import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SongCover } from "./song-cover";

export type ChoiceSong = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  artwork?: { image_url: string; album_title: string | null } | null;
};

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
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5"
      aria-label="Choose a song"
      aria-busy={busy}
    >
      {songs.map((song) => {
        const selected = selectedId === song.id;
        return (
          <Button
            key={song.id}
            type="button"
            aria-pressed={selected}
            disabled={busy || (!!selectedId && !selected)}
            onClick={() => onChoose(song.id)}
            variant="outline"
            className={`group relative grid h-auto min-h-36 min-w-0 grid-cols-[5rem_1fr] items-center gap-4 overflow-hidden whitespace-normal rounded-sm border-border-strong p-4 text-left sm:grid-cols-1 sm:gap-5 sm:p-6 ${selected ? "bg-accent ring-2 ring-inset ring-gold" : selectedId ? "bg-surface opacity-50" : "bg-surface hover:border-gold"}`}
          >
            <SongCover imageUrl={song.artwork?.image_url} albumTitle={song.artwork?.album_title} />
            <span className="block min-w-0 sm:w-full">
              <span className="mb-2 flex min-h-4 items-center justify-between font-mono text-xs text-muted-foreground">
                {selected ? "✓ Your choice" : (song.year ?? "Song")}
                {selected ? (
                  <Check aria-hidden="true" />
                ) : (
                  <ArrowUpRight aria-hidden="true" className="text-gold" />
                )}
              </span>
              <span className="mb-2 block break-words font-serif text-2xl leading-tight md:text-3xl">
                {song.title}
              </span>
              <span className="block text-sm text-muted-foreground">{song.artist}</span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
