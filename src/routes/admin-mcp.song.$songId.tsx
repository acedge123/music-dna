import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { readCatalogSong } from "@/lib/mcp/admin.functions";
export const Route = createFileRoute("/admin-mcp/song/$songId")({
  ssr: false,
  component: CatalogSong,
});
function CatalogSong() {
  const { songId } = Route.useParams(),
    read = useServerFn(readCatalogSong);
  const q = useQuery({
    queryKey: ["mcp", "song", songId],
    queryFn: () => read({ data: { id: songId } }),
    retry: false,
  });
  return (
    <main className="max-w-4xl p-8 mx-auto space-y-4">
      <h1 className="text-2xl">MusicDNA catalog record</h1>
      <p>
        Operator access required. This is the current catalog record; saved reading evidence remains
        versioned separately.
      </p>
      {q.isPending ? (
        <p>Checking access…</p>
      ) : q.isError ? (
        <p role="alert">Record unavailable. Sign in with a permitted catalog account.</p>
      ) : (
        <pre className="text-sm whitespace-pre-wrap break-words">{q.data.json}</pre>
      )}
      <Link to="/auth">Sign in</Link>
    </main>
  );
}
