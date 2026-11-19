import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loadShareImage, shareImage } from "./share-image";
import type { CardFormat } from "@/musicdna/engine/share-card";

type Prepared = { token: string; attempt: number } & (
  { status: "ready"; file: File } | { status: "loading" | "error" }
);

function ImageAction({ token, format }: { token: string; format: CardFormat }) {
  const [attempt, setAttempt] = useState(0);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared>({ token, attempt: 0, status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    loadShareImage(token, format, controller.signal)
      .then((file) => {
        if (live) setPrepared({ token, attempt, status: "ready", file });
      })
      .catch(() => {
        if (live) setPrepared({ token, attempt, status: "error" });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [token, format, attempt]);
  // Never expose the previous token's prepared file, even before effect cleanup.
  const current = prepared.token === token && prepared.attempt === attempt ? prepared : null;
  const file = current?.status === "ready" ? current.file : null;
  const label = format === "story" ? "Story" : "square";
  const run = () => {
    if (!file) return;
    setDeliveryError(null);
    shareImage(file)
      .then((result) => {
        if (result === "fallback") {
          setDeliveryError(
            "Couldn't open sharing. An image download was started instead. You can try sharing again.",
          );
        }
        if (result === "downloaded")
          toast.success(
            `Image download started. Open Instagram and add it to your ${label === "Story" ? "Story" : "post"}.`,
          );
      })
      .catch(() => setDeliveryError("Couldn't save the image. Please try sharing again."));
  };
  return (
    <div className="space-y-2">
      <Button disabled={!file} variant={format === "story" ? "default" : "outline"} onClick={run}>
        {format === "story" ? "Share to Instagram Story" : "Square post image"}
      </Button>
      {deliveryError && file ? (
        <div>
          <p role="alert" className="text-xs text-muted-foreground">
            {deliveryError}
          </p>
          <Button variant="link" onClick={run}>
            Retry {label} sharing
          </Button>
        </div>
      ) : null}
      {current?.status === "error" ? (
        <div>
          <p role="alert" className="text-xs text-muted-foreground">
            Couldn't prepare the {label} image. Try again; if it still fails, check that this
            reading is shared.
          </p>
          <Button variant="link" onClick={() => setAttempt((n) => n + 1)}>
            Retry {label} image
          </Button>
        </div>
      ) : !file ? (
        <p role="status" className="text-xs text-muted-foreground">
          Preparing {label} image…
        </p>
      ) : null}
    </div>
  );
}

// Prepare before the tap: iPhones need navigator.share called in the gesture.
export function ShareToInstagram({ token }: { token: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <ImageAction key={`${token}:story`} token={token} format="story" />
        <ImageAction key={`${token}:square`} token={token} format="square" />
      </div>
      <p className="text-xs text-muted-foreground">
        Pick Instagram in the share menu. If it isn't listed, choose Save Image, then post it from
        Instagram.
      </p>
    </div>
  );
}
