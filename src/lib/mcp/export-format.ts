import type { ExportSnapshot } from "./admin.functions";
/** CSV remains complete: nested records are JSON cells. Prefix spreadsheet formulas. JSON is lossless. */
export function csvCell(value: unknown): string {
  let text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function formatExport(snapshot: ExportSnapshot) {
  if (
    snapshot.export_count !== snapshot.records.length ||
    snapshot.total_record_count !== snapshot.records.length
  )
    throw new Error("EXPORT_COUNT_MISMATCH");
  if (snapshot.format === "json")
    return { mime: "application/json", extension: "json", text: JSON.stringify(snapshot, null, 2) };
  const meta = {
    schema_version: snapshot.schema_version,
    generation_timestamp: snapshot.generation_timestamp,
    total_record_count: snapshot.total_record_count,
    export_count: snapshot.export_count,
  };
  const cols = [
    ...Object.keys(meta),
    "explanation",
    "version",
    "song",
    "attribute",
    "availability",
  ];
  return {
    mime: "text/csv;charset=utf-8",
    extension: "csv",
    text: [
      cols.map(csvCell).join(","),
      ...snapshot.records.map((row) =>
        cols.map((key) => csvCell(({ ...meta, ...row } as Record<string, unknown>)[key])).join(","),
      ),
    ].join("\r\n"),
  };
}
