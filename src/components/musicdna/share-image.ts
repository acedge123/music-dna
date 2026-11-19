import { CARD_SIZE, type CardFormat } from "@/musicdna/engine/share-card";

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Preparation cancelled", "AbortError"));
    if (signal.aborted) {
      work.catch(() => {});
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

/** Public card only. No auth changes, publication writes, or hidden retries. */
export async function loadShareImage(
  token: string,
  format: CardFormat,
  signal: AbortSignal,
): Promise<File> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 15000);
  let objectUrl: string | undefined;
  try {
    const response = await fetch(
      `/api/v1/share/${encodeURIComponent(token)}/card?format=${format}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (
      !response.ok ||
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/svg+xml"
    ) {
      throw new Error("Card unavailable");
    }
    const svg = await response.blob();
    if (controller.signal.aborted) throw new DOMException("Preparation cancelled", "AbortError");
    objectUrl = URL.createObjectURL(svg);
    const img = new Image();
    img.src = objectUrl;
    await abortable(img.decode(), controller.signal);
    const [width, height] = CARD_SIZE[format];
    if (img.naturalWidth !== width || img.naturalHeight !== height)
      throw new Error("Invalid card size");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image conversion unavailable");
    context.drawImage(img, 0, 0);
    const png = await abortable(
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Image conversion failed"))),
          "image/png",
        );
      }),
      controller.signal,
    );
    return new File([png], `musicdna-${format}.png`, { type: "image/png" });
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function downloadShareImage(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  try {
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
  } finally {
    a.remove();
    // Keep the URL alive long enough for the browser to consume the click.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Called directly from the click, before any await, to preserve iOS activation. */
export async function shareImage(
  file: File,
): Promise<"shared" | "cancelled" | "downloaded" | "fallback"> {
  let canShare: boolean;
  try {
    canShare = Boolean(
      typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }),
    );
  } catch {
    downloadShareImage(file);
    return "fallback";
  }
  if (canShare) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError")
        return "cancelled";
    }
    downloadShareImage(file);
    return "fallback";
  }
  downloadShareImage(file);
  return "downloaded";
}
