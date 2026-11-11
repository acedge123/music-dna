import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { Accuracy } from "@/lib/reading-feedback";
const ACCURACY_LABELS = {
  accurate: "Accurate",
  mixed: "Mixed",
  not_accurate: "Not accurate",
} as const;
export function ReadingFeedbackForm({
  version,
  selection,
  status,
  error,
  onSelect,
  onSubmit,
  onReload,
}: {
  version: number;
  selection: Accuracy | null;
  status: "loading" | "ready" | "saving" | "saved" | "uncertain" | "unavailable";
  error: string | null;
  onSelect: (value: Accuracy) => void;
  onSubmit: () => void;
  onReload: () => void;
}) {
  const id = useId(),
    locked = status !== "ready";
  return (
    <section className="space-y-4 border-t hairline pt-6" aria-label="Reading accuracy">
      <div>
        <h2 className="font-serif text-xl">How accurate is this reading?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional · for saved reading version {version}
        </p>
      </div>
      {status === "loading" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Checking your saved rating…
        </p>
      ) : status === "unavailable" ? (
        <>
          <p role="alert" className="text-sm">
            {error}
          </p>
          <Button type="button" variant="outline" onClick={onReload} className="min-h-11">
            Retry loading rating
          </Button>
        </>
      ) : (
        <>
          <fieldset
            disabled={locked}
            className="flex flex-col gap-2 sm:flex-row"
            aria-label="Accuracy rating"
          >
            <legend className="sr-only">Choose one accuracy rating</legend>
            {(Object.entries(ACCURACY_LABELS) as [Accuracy, string][]).map(([value, label]) => (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-4 py-3 text-sm ${selection === value ? "border-primary bg-primary/10" : "hairline-strong"}`}
              >
                <input
                  type="radio"
                  name={id}
                  value={value}
                  checked={selection === value}
                  onChange={() => onSelect(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {status === "saved" && selection ? (
            <p role="status" className="text-sm">
              Saved: {ACCURACY_LABELS[selection]} · reading version {version}
            </p>
          ) : (
            <>
              {error && (
                <p role="alert" className="text-sm">
                  {error}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={onSubmit}
                disabled={!selection || status === "saving"}
                className="min-h-11 rounded-sm"
              >
                {status === "saving"
                  ? "Saving rating…"
                  : status === "uncertain"
                    ? "Retry this rating"
                    : "Save rating"}
              </Button>
              {status === "uncertain" && (
                <Button type="button" variant="ghost" onClick={onReload} className="min-h-11">
                  Check saved rating
                </Button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
