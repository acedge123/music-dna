export function OpeningContext({
  songs,
  reactions,
  observation,
  compact,
  starting,
}: {
  songs: string[];
  reactions: string[];
  observation?: string | null;
  compact: boolean;
  starting: boolean;
}) {
  const content = (
    <div className="space-y-5">
      <ol className="space-y-4" aria-label="Your opening songs">
        {songs.map((song, i) => (
          <li key={i} className="space-y-1">
            <p className="font-serif text-xl break-words">
              <span className="mr-3 font-mono text-xs text-muted-foreground">#{i + 1}</span>
              {song}
            </p>
            {reactions[i] && i < 2 && (
              <p className="text-sm text-muted-foreground">{reactions[i]}</p>
            )}
          </li>
        ))}
      </ol>
      {observation && (
        <div className="space-y-2">
          <p className="eyebrow">From your opening songs</p>
          <p className="font-serif text-xl leading-snug">{observation}</p>
          {!compact && (
            <p className="text-sm text-muted-foreground">
              Next, choose the song you prefer in each matchup. Skip any you don't know.
            </p>
          )}
        </div>
      )}
      {starting && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading your first matchup…
        </p>
      )}
    </div>
  );
  return compact ? (
    <details className="border-y hairline py-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm">Your opening songs</summary>
      <div className="pb-4 pt-2">{content}</div>
    </details>
  ) : (
    <section aria-label="Your opening songs and introduction">{content}</section>
  );
}
