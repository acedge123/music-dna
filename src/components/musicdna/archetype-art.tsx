const NAMES = new Set(["believer", "atmospherist", "romantic", "anthemist", "transformer", "hedonist", "witness"]);

export function archetypeArt(name?: string | null): string | null {
  if (!name) return null;
  const key = name.toLowerCase().replace(/^the\s+/, "").trim();
  return NAMES.has(key) ? `/archetypes/${key}.jpg` : null;
}

export function ArchetypeArt({ name, className = "" }: { name?: string | null; className?: string }) {
  const src = archetypeArt(name);
  if (!src) return null;
  return <img src={src} alt={`Ink illustration for ${name}`} className={`h-auto w-full max-w-sm rounded-sm border border-border ${className}`} />;
}
