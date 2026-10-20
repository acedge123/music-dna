import { useEffect, useRef } from "react";

export function OpeningSongInput({
  rank,
  label,
  value,
  placeholder,
  onChange,
  onEnter,
  autoFocus,
}: {
  rank: number;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 items-baseline">
      <div className="text-right">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          #{rank}
        </p>
      </div>
      <div className="min-w-0">
        <label
          htmlFor={`opening-song-${rank}`}
          className="mb-1 block font-mono text-xs text-muted-foreground"
        >
          {label}
        </label>
        <div className="border-b-2 hairline-strong focus-within:border-primary transition-colors pb-1">
          <input
            ref={ref}
            id={`opening-song-${rank}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onEnter) {
                e.preventDefault();
                onEnter();
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-xl md:text-2xl font-serif italic py-2 placeholder:text-muted-foreground/40 placeholder:not-italic placeholder:font-serif focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
