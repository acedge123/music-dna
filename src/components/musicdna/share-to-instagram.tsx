import { useState } from "react";
import { Button } from "@/components/ui/button";

async function svgToPng(url: string): Promise<Blob> {
  const svg = await (await fetch(url)).text();
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}

export function ShareToInstagram({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const run = async (format: "story" | "square") => {
    setBusy(true);
    try {
      const blob = await svgToPng(`/api/v1/share/${encodeURIComponent(token)}/card?format=${format}`);
      const file = new File([blob], `musicdna-${format}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My MusicDNA reading", url: window.location.href }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file); a.download = file.name; a.click();
        URL.revokeObjectURL(a.href);
      }
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap gap-3">
      <Button disabled={busy} onClick={() => run("story")}>Share to Instagram Story</Button>
      <Button disabled={busy} variant="outline" onClick={() => run("square")}>Square post image</Button>
    </div>
  );
}
