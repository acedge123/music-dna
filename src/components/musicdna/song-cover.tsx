import { useState } from "react";
import fallback from "@/assets/music-dna-cover.jpg";

export function SongCover({
  imageUrl,
  albumTitle,
}: {
  imageUrl?: string | null;
  albumTitle?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const available = Boolean(imageUrl && imageUrl !== failedUrl);
  return (
    <img
      src={available ? imageUrl ?? fallback : fallback}
      alt={available ? `Cover: ${albumTitle ?? "album"}` : "Music DNA album cover"}
      width={1024}
      height={1024}
      loading="lazy"
      onError={() => { if (imageUrl && available) setFailedUrl(imageUrl); }}
      className="aspect-square w-20 rounded-sm object-cover sm:mx-auto sm:w-36 md:w-44"
    />
  );
}