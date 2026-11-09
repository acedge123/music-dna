export type ArtistCredit = { name?: string; artist?: { name?: string } };
export type Release = {
  id: string;
  title: string;
  status?: string;
  date?: string;
  "artist-credit"?: ArtistCredit[];
  "release-group"?: { "primary-type"?: string; "secondary-types"?: string[] };
};
export type Recording = {
  id: string;
  title: string;
  score?: number;
  disambiguation?: string;
  "artist-credit"?: ArtistCredit[];
  releases?: Release[];
};
export function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function creditMatches(credits: ArtistCredit[] | undefined, artist: string) {
  return (
    normalize((credits ?? []).map((c) => c.name ?? c.artist?.name ?? "").join("")) ===
    normalize(artist)
  );
}
// Search relevance alone is insufficient: bootlegs often also score 100.
export function releaseCandidates(
  song: { title: string; artist: string; year?: number | null },
  recordings: Recording[],
) {
  const candidates: { recording: Recording; release: Release }[] = [];
  for (const recording of recordings) {
    if (
      normalize(recording.title) !== normalize(song.title) ||
      !creditMatches(recording["artist-credit"], song.artist)
    )
      continue;
    if (/live|remix|karaoke|instrumental|demo|cover|acoustic/i.test(recording.disambiguation ?? ""))
      continue;
    for (const release of recording.releases ?? []) {
      const group = release["release-group"];
      if (release.status !== "Official" || !creditMatches(release["artist-credit"], song.artist))
        continue;
      if (!["Album", "Single", "EP"].includes(group?.["primary-type"] ?? "")) continue;
      if (
        (group?.["secondary-types"] ?? []).some((t) =>
          ["Live", "Compilation", "Remix", "DJ-mix"].includes(t),
        )
      )
        continue;
      candidates.push({ recording, release });
    }
  }
  const distance = (release: Release) => {
    const year = Number(release.date?.slice(0, 4));
    return year && song.year ? Math.abs(year - song.year) : 9999;
  };
  return candidates.sort(
    (a, b) =>
      distance(a.release) - distance(b.release) ||
      (a.release.date ?? "9999").localeCompare(b.release.date ?? "9999"),
  );
}
