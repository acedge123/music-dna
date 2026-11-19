import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { downloadWhyExport } from "@/lib/mcp/admin.functions";
import { formatExport } from "@/lib/mcp/export-format";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/admin-mcp/export/$jobId")({
  ssr: false,
  component: Download,
});
function Download() {
  const { jobId } = Route.useParams();
  const download = useServerFn(downloadWhyExport);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      "Sign in with the same MusicDNA account that requested this export. Downloads expire after ten minutes.",
    );
  async function save() {
    setBusy(true);
    try {
      const snapshot = await download({ data: { id: jobId, offset: 0 } });
      let next = snapshot.next_offset;
      while (next !== null) {
        const page = await download({ data: { id: jobId, offset: next } });
        if (
          page.id !== snapshot.id ||
          page.offset !== next ||
          page.total_record_count !== snapshot.total_record_count
        )
          throw new Error("EXPORT_PAGE_MISMATCH");
        snapshot.records.push(...page.records);
        next = page.next_offset;
        setMessage(
          `Preparing download: ${snapshot.records.length} of ${snapshot.total_record_count} records.`,
        );
      }
      const output = formatExport(snapshot);
      const url = URL.createObjectURL(new Blob([output.text], { type: output.mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `musicdna-song-whys-${snapshot.id}.${output.extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Downloaded ${snapshot.export_count} complete records.`);
    } catch {
      setMessage(
        "Download unavailable. Check that you are signed in as the export owner, have catalog access, and the export is ready and has not expired. Request a fresh export if needed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-xl mx-auto p-8 space-y-5">
      <h1 className="text-2xl">MusicDNA Song Why export</h1>
      <p role="status">{message}</p>
      <Button disabled={busy} onClick={() => void save()}>
        {busy ? "Checking access…" : "Download export"}
      </Button>
      <p>
        <Link to="/auth">Sign in to MusicDNA</Link>
      </p>
    </main>
  );
}
