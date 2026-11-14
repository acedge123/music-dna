import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Format = "story" | "square";

async function svgToPng(url: string, name: string): Promise<File> {
  const svg = await (await fetch(url)).text();
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"),
  );
  return new File([blob], name, { type: "image/png" });
}

// Images are prepared on page load: iPhones only open the share sheet if it is
// called straight from the tap, with no waiting in between.
export function ShareToInstagram({ token }: { token: string }) {
  const [files, setFiles] = useState<Partial<Record<Format, File>>>({});
  useEffect(() => {
    let live = true;
    (["story", "square"] as const).forEach((f) =>
      svgToPng(`/api/v1/share/${encodeURIComponent(token)}/card?format=${f}`, `musicdna-${f}.png`)
        .then((file) => live && setFiles((p) => ({ ...p, [f]: file })))
        .catch(() => {}),
    );
    return () => { live = false; };
  }, [token]);

  const run = (format: Format) => {
    const file = files[format];
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          toast.error("Couldn't open sharing. Downloading the image instead.");
        if (!(e instanceof DOMException && e.name === "AbortError")) download(file);
      });
    } else {
      download(file);
      toast.success("Image saved. Open Instagram and add it to your Story.");
    }
  };
  const ready = (f: Format) => Boolean(files[f]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <Button disabled={!ready("story")} onClick={() => run("story")}>Share to Instagram Story</Button>
        <Button disabled={!ready("square")} variant="outline" onClick={() => run("square")}>Square post image</Button>
      </div>
      <p className="text-xs text-muted-foreground">Pick Instagram in the share menu. If it isn't listed, choose Save Image, then post it from Instagram.</p>
    </div>
  );
}

function download(file: File) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
