import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { GuestSaveForm } from "@/components/musicdna/guest-reading-save";

export const Route = createFileRoute("/save-reading")({
  ssr: false,
  validateSearch: (search) => z.object({ session: z.string().uuid().optional() }).parse(search),
  head: () => ({ meta: [
    { title: "Keep your reading — MusicDNA" },
    { name: "description", content: "Keep your private MusicDNA reading with a verified account." },
    { property: "og:title", content: "Keep your reading — MusicDNA" },
    { property: "og:description", content: "Preserve access to your private MusicDNA reading." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SaveReading,
});
function SaveReading() {
  const { session } = Route.useSearch();
  return <main className="mx-auto max-w-lg px-6 py-16 space-y-8"><Link to="/onboarding" search={{ session }} className="text-sm text-muted-foreground">← Back to my reading</Link><h1 className="font-serif text-4xl">Keep your reading.</h1><GuestSaveForm sessionId={session} /></main>;
}