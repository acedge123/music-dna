import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { halftimePushback } from "@/lib/halftime-pushback.functions";
import { Button } from "@/components/ui/button";

// Optional, skippable pushback at halftime. Self-report only — never a vote.
export function HalftimePushback({ sessionId }: { sessionId: string | null }) {
  const send = useServerFn(halftimePushback);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!sessionId) return null;
  if (reply) return <p className="font-serif text-xl italic leading-relaxed">{reply}</p>;
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
      >
        That's not me — push back
      </button>
    );
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await send({ data: { sessionId, message: text.trim() } });
      setReply(r.reply);
    } catch {
      setError("Couldn't save that. Keep going — your picks still count.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <label htmlFor="halftime-pushback" className="text-sm text-muted-foreground">
        Tell me where I'm wrong. Your picks still decide.
      </label>
      <textarea
        id="halftime-pushback"
        value={text}
        maxLength={500}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-md border border-input bg-background p-3 text-base"
      />
      <Button variant="outline" onClick={() => void submit()} disabled={busy || !text.trim()}>
        {busy ? "Saving…" : "Say it"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
