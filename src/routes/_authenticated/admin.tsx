import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  adminCheck,
  adminList,
  adminUpsert,
  adminDelete,
  adminSetDiagnosticWeight,
  adminResidualQueue,
  adminOntology,
  adminDiagnostics,
} from "@/lib/admin.functions";
import {
  listDecadePrompts,
  updateDecadePromptText,
  setActiveDecadePrompt,
  createDecadePrompt,
  deleteDecadePrompt,
  DECADES,
  type Decade,
  type DecadePrompt,
} from "@/lib/decade-prompts.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MusicDNA" }] }),
  component: AdminPage,
});

type Entity = "songs" | "pairings" | "archetypes";
type Tab = Entity | "decade_prompts" | "residuals" | "ontology" | "diagnostics";
const ENTITIES: { key: Tab; label: string }[] = [
  { key: "songs", label: "Songs" },
  { key: "pairings", label: "Pairings" },
  { key: "archetypes", label: "Archetypes" },
  { key: "decade_prompts", label: "Decade Prompts" },
  { key: "ontology", label: "Ontology" },
  { key: "residuals", label: "Residuals" },
  { key: "diagnostics", label: "Diagnostics" },
];

type Row = Record<string, unknown> & { id: string };

function AdminPage() {
  const check = useServerFn(adminCheck);
  // Component-level gate. Retry a few times because the first server-fn call
  // after hydration can race the bearer-token attacher reading the session.
  const gate = useQuery({
    queryKey: ["admin", "check"],
    queryFn: () => check(),
    retry: 3,
    retryDelay: (attempt) => 300 * (attempt + 1),
    staleTime: 60_000,
  });
  const [tab, setTab] = useState<Tab>("songs");
  const [editing, setEditing] = useState<{ row: Row | null } | null>(null);

  if (gate.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">
        Checking credentials…
      </main>
    );
  }
  if (gate.isError || !gate.data?.isAdmin) {
    const errMsg = gate.error instanceof Error ? gate.error.message : null;
    const looksUnauth = errMsg?.toLowerCase().includes("unauth");
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="eyebrow mb-3">{looksUnauth ? "401" : "403"}</p>
        <h1 className="display text-3xl mb-3">
          {looksUnauth ? "Session didn't reach the door." : "Not your room."}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {looksUnauth
            ? "Your bearer token didn't make it to the server. Usually a stale session — refetch, or sign out and back in."
            : "This page is admin-only. If you think that's wrong, sign out and back in — sometimes the session takes a beat to catch up."}
        </p>
        {errMsg && (
          <pre className="mb-6 max-w-full overflow-x-auto rounded border hairline bg-muted/40 p-3 text-[11px] font-mono text-muted-foreground">
            {errMsg}
          </pre>
        )}
        {!errMsg && gate.data && (
          <pre className="mb-6 max-w-full overflow-x-auto rounded border hairline bg-muted/40 p-3 text-[11px] font-mono text-muted-foreground">
            {`server saw userId: ${gate.data.userId}\nreason: ${gate.data.reason ?? "unknown"}`}
          </pre>
        )}

        <div className="flex gap-3 items-center">
          <button
            onClick={() => gate.refetch()}
            className="bg-primary text-primary-foreground rounded-sm px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Try again
          </button>
          <Link to="/profile" className="text-sm underline">
            Back to profile
          </Link>
        </div>
      </main>
    );
  }


  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
        <div>
          <p className="eyebrow mb-3">Admin</p>
          <h1 className="display text-4xl">Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit songs, pairings, and archetypes. Changes go live immediately.
          </p>
        </div>
        {tab !== "decade_prompts" && tab !== "residuals" && tab !== "ontology" && tab !== "diagnostics" && (
          <button
            onClick={() => setEditing({ row: null })}
            className="rounded-sm bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + New {tab.replace(/s$/, "")}
          </button>
        )}
      </div>

      <nav className="flex gap-1 border-b hairline mb-6 flex-wrap">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            onClick={() => setTab(e.key)}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-[0.18em] border-b-2 -mb-px ${
              tab === e.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {e.label}
          </button>
        ))}
      </nav>

      {tab === "decade_prompts" ? (
        <DecadePromptsEditor />
      ) : tab === "residuals" ? (
        <ResidualsPanel />
      ) : tab === "ontology" ? (
        <OntologyPanel />
      ) : tab === "diagnostics" ? (
        <DiagnosticsPanel />
      ) : (
        <EntityTable
          key={tab}
          entity={tab as Exclude<Entity, "decade_prompts">}
          onEdit={(row) => setEditing({ row })}
        />
      )}

      {editing && tab !== "decade_prompts" && tab !== "residuals" && tab !== "ontology" && tab !== "diagnostics" && (
        <EditDrawer
          entity={tab as Exclude<Entity, "decade_prompts">}
          row={editing.row}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}

function EntityTable({ entity, onEdit }: { entity: Entity; onEdit: (row: Row) => void }) {
  const qc = useQueryClient();
  const list = useServerFn(adminList);
  const del = useServerFn(adminDelete);
  const setWeight = useServerFn(adminSetDiagnosticWeight);
  const [search, setSearch] = useState("");
  const [lane, setLane] = useState("");

  const query = useQuery({
    queryKey: ["admin", entity, search, lane],
    queryFn: () => list({ data: { table: entity, search: search || undefined, lane: lane || undefined } }),
  });

  const columns = useMemo(() => columnsFor(entity), [entity]);

  return (
    <div>
      <div className="flex gap-3 items-center mb-3 flex-wrap">
        {entity !== "archetypes" && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={entity === "songs" ? "Search title or artist…" : "Search…"}
            className="border hairline rounded-sm bg-background px-3 py-1.5 text-sm w-64"
          />
        )}
        {(entity === "songs" || entity === "pairings") && (
          <select
            value={lane}
            onChange={(e) => setLane(e.target.value)}
            className="border hairline rounded-sm bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All lanes</option>
            {["alternative", "pop", "hip_hop", "electronic", "classic_rock", "metal", "country", "r_and_b", "general"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {query.data?.rows.length ?? 0} rows{query.isFetching ? " · loading…" : ""}
        </span>
      </div>

      <div className="border hairline-strong rounded-sm overflow-x-auto bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/50">
            <tr>
              {columns.map((c) => (
                <th key={c} className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-3 py-2">
                  {c}
                </th>
              ))}
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows as Row[] | undefined)?.map((r) => (
              <tr key={r.id} className="border-t hairline align-top">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 max-w-[280px] truncate">
                    {entity === "pairings" && c === "diagnostic_weight" ? (
                      <input
                        type="number"
                        defaultValue={Number(r[c] ?? 0)}
                        min={0}
                        max={100}
                        onBlur={async (e) => {
                          const v = parseInt(e.target.value, 10);
                          if (Number.isNaN(v) || v === Number(r[c])) return;
                          try {
                            await setWeight({ data: { id: r.id, diagnostic_weight: v } });
                            toast.success("Weight updated");
                            qc.invalidateQueries({ queryKey: ["admin", entity] });
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                        className="w-16 border hairline rounded-sm bg-background px-2 py-1 text-xs"
                      />
                    ) : entity === "pairings" && c === "active" ? (
                      <input
                        type="checkbox"
                        defaultChecked={!!r[c]}
                        onChange={async (e) => {
                          try {
                            await setWeight({ data: { id: r.id, diagnostic_weight: Number(r.diagnostic_weight ?? 0), active: e.target.checked } });
                            qc.invalidateQueries({ queryKey: ["admin", entity] });
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      />
                    ) : entity === "pairings" && c === "is_bootstrap" ? (
                      <input
                        type="checkbox"
                        defaultChecked={!!r[c]}
                        title="Serve in the first 2 rounds of a general-lane session to promote the session to a real lane."
                        onChange={async (e) => {
                          try {
                            await setWeight({ data: { id: r.id, diagnostic_weight: Number(r.diagnostic_weight ?? 0), is_bootstrap: e.target.checked } });
                            toast.success(e.target.checked ? "Marked bootstrap" : "Unmarked");
                            qc.invalidateQueries({ queryKey: ["admin", entity] });
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      />
                    ) : (

                      formatCell(r[c])
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => onEdit(r)}
                    className="text-xs underline mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this row? This cannot be undone.")) return;
                      try {
                        await del({ data: { table: entity, id: r.id } });
                        toast.success("Deleted");
                        qc.invalidateQueries({ queryKey: ["admin", entity] });
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                    className="text-xs text-destructive underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!query.isLoading && (query.data?.rows.length ?? 0) === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function columnsFor(e: Entity): string[] {
  if (e === "songs") return ["title", "artist", "year", "primary_lane", "diagnostic_power", "canon_score", "curator_count"];
  if (e === "pairings") return ["user_facing_tradeoff", "hypothesis", "song_a_id", "song_b_id", "lane", "difficulty", "diagnostic_weight", "active"];
  return ["name", "tagline", "description"];
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 117) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  } catch {
    return String(v);
  }
}

// ============ Edit drawer ============
function EditDrawer({
  entity,
  row,
  onClose,
}: {
  entity: Entity;
  row: Row | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsert);
  const fields = useMemo(() => fieldsFor(entity), [entity]);
  const initial = useMemo(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      const v = row?.[f.key];
      init[f.key] = v == null ? "" : typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
    }
    return init;
  }, [fields, row]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        const raw = values[f.key]?.trim() ?? "";
        if (raw === "" && f.optional) continue;
        if (raw === "" && !f.optional) {
          throw new Error(`Missing required field: ${f.key}`);
        }
        if (f.type === "number") {
          const n = Number(raw);
          if (Number.isNaN(n)) throw new Error(`${f.key} must be a number`);
          payload[f.key] = n;
        } else if (f.type === "boolean") {
          payload[f.key] = raw === "true";
        } else if (f.type === "json") {
          try {
            payload[f.key] = raw === "" ? null : JSON.parse(raw);
          } catch {
            throw new Error(`${f.key} must be valid JSON`);
          }
        } else {
          payload[f.key] = raw;
        }
      }
      await upsert({ data: { table: entity, id: row?.id ?? null, row: payload } });
      toast.success(row ? "Saved" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", entity] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-stretch justify-end">
      <div className="w-full max-w-xl bg-background border-l hairline-strong overflow-y-auto">
        <div className="p-6 border-b hairline flex items-center justify-between">
          <div>
            <p className="eyebrow">{row ? "Edit" : "New"}</p>
            <h2 className="font-serif text-2xl mt-1">{entity.replace(/s$/, "")}</h2>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <div className="p-6 space-y-4">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="block text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1">
                {f.key}{f.optional ? "" : " *"}
              </span>
              {f.type === "json" || f.long ? (
                <textarea
                  rows={f.type === "json" ? 6 : 3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="w-full border hairline rounded-sm bg-background px-3 py-2 text-sm font-mono"
                />
              ) : (
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  placeholder={f.hint}
                  className="w-full border hairline rounded-sm bg-background px-3 py-2 text-sm"
                />
              )}
            </label>
          ))}
        </div>
        <div className="p-6 border-t hairline flex justify-end gap-2 sticky bottom-0 bg-background">
          <button onClick={onClose} className="text-sm px-4 py-2 border hairline-strong rounded-sm">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Field = { key: string; type: "text" | "number" | "boolean" | "json"; optional?: boolean; long?: boolean; hint?: string };

function fieldsFor(e: Entity): Field[] {
  if (e === "songs") {
    const dims = [
      "movement","atmosphere","groove","darkness","hope","nostalgia","transformation",
      "complexity","melody","verbal_cleverness","authenticity","romanticism","energy",
      "dreaminess","community",
    ];
    return [
      { key: "title", type: "text" },
      { key: "artist", type: "text" },
      { key: "year", type: "number", optional: true },
      { key: "primary_lane", type: "text", hint: "alternative · pop · hip_hop · electronic · classic_rock · metal · country · r_and_b · general" },
      { key: "lane", type: "text", hint: "granular sub-lane, e.g. post_punk_new_wave" },
      // --- Diagnostic Power Score (DPS): six components, sum = diagnostic_power ---
      { key: "polarization", type: "number", optional: true, hint: "0–25 — splits the room. 0=everyone agrees · 25=fistfight in the comments" },
      { key: "tradeoff_richness", type: "number", optional: true, hint: "0–20 — how many real tradeoffs this song surfaces" },
      { key: "pairing_density", type: "number", optional: true, hint: "0–15 — how many sharp same-lane opponents exist" },
      { key: "identity_signaling", type: "number", optional: true, hint: "0–15 — picking this says something about you" },
      { key: "longevity", type: "number", optional: true, hint: "0–10 — still revealing five years from now?" },
      { key: "cross_genre_mapping", type: "number", optional: true, hint: "0–15 — maps cleanly to opponents in other lanes" },
      { key: "canon_score", type: "number", optional: true, hint: "0–100 — cultural weight. Billie Jean=99, deep cut=20" },
      { key: "curator_count", type: "number", optional: true, hint: "how many curators have scored this (drives confidence)" },
      { key: "diagnostic_power_confidence", type: "number", optional: true, hint: "0.00–1.00 — how much we trust the score" },
      ...dims.map((d) => ({ key: d, type: "number" as const, optional: true, hint: "-10 to +10" })),
    ];
  }
  if (e === "pairings") {
    return [
      { key: "song_a_id", type: "text", hint: "uuid of song A" },
      { key: "song_b_id", type: "text", hint: "uuid of song B" },
      { key: "user_facing_tradeoff", type: "text", long: true, optional: true, hint: 'Plain-language tradeoff. Must pass the Friend Test, e.g. "Do you disappear into a song, or bring it into the room with you?"' },
      { key: "hypothesis", type: "text", long: true, hint: "internal critic-speak — what dimensions this tests" },
      { key: "why_good", type: "text", long: true, optional: true },
      { key: "tests", type: "json", optional: true, hint: '["movement","darkness"]' },
      { key: "lane", type: "text", optional: true, hint: "default: alternative" },
      { key: "difficulty", type: "number", optional: true, hint: "1=obvious · 2=moderate · 3=painful" },
      { key: "diagnostic_weight", type: "number", hint: "0–100" },
      { key: "active", type: "boolean", hint: "true / false" },
    ];
  }
  return [
    { key: "name", type: "text" },
    { key: "tagline", type: "text", optional: true },
    { key: "description", type: "text", long: true, optional: true },
    { key: "signature_axes", type: "json", optional: true, hint: '{"movement":5,"darkness":-3}' },
    { key: "signature_signals", type: "json", optional: true, hint: '["…"]' },
  ];
}

// ============ Decade Opening Prompts editor ============
function DecadePromptsEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDecadePrompts);
  const updateTextFn = useServerFn(updateDecadePromptText);
  const setActiveFn = useServerFn(setActiveDecadePrompt);
  const createFn = useServerFn(createDecadePrompt);
  const deleteFn = useServerFn(deleteDecadePrompt);

  const query = useQuery({
    queryKey: ["admin", "decade_prompts"],
    queryFn: () => listFn(),
  });

  const grouped = useMemo(() => {
    const map: Record<Decade, DecadePrompt[]> = {
      "70s": [], "80s": [], "90s": [], "00s": [], "10s": [],
    };
    for (const r of query.data?.rows ?? []) map[r.decade]?.push(r);
    return map;
  }, [query.data]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "decade_prompts"] });
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-muted-foreground max-w-2xl">
        The opening question shown as song #1 on each decade's onboarding page. One per decade is marked <span className="text-foreground font-medium">active</span> — that's the one users see. Edit text inline (press Enter or blur to save). Promote a different option by clicking its radio.
      </p>

      {DECADES.map((decade) => (
        <section key={decade} className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display text-2xl">{decade}</h2>
            <NewPromptInline
              onCreate={async (text) => {
                try {
                  await createFn({ data: { decade, text } });
                  toast.success(`Added to ${decade}`);
                  invalidate();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          </div>
          <ul className="border hairline-strong rounded-sm bg-surface divide-y hairline">
            {grouped[decade].map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-3">
                <label className="pt-2 cursor-pointer" title="Make this the active prompt">
                  <input
                    type="radio"
                    name={`active-${decade}`}
                    checked={p.is_active}
                    onChange={async () => {
                      try {
                        await setActiveFn({ data: { id: p.id } });
                        toast.success(`${decade} active prompt set`);
                        invalidate();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  />
                </label>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground pt-2 w-8">
                  {String(p.position).padStart(2, "0")}
                </span>
                <PromptTextField
                  initial={p.text}
                  onSave={async (text) => {
                    if (text === p.text) return;
                    try {
                      await updateTextFn({ data: { id: p.id, text } });
                      toast.success("Saved");
                      invalidate();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (p.is_active) {
                      toast.error("Promote a different prompt first.");
                      return;
                    }
                    if (!confirm("Delete this prompt?")) return;
                    try {
                      await deleteFn({ data: { id: p.id } });
                      toast.success("Deleted");
                      invalidate();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  className="text-xs text-destructive underline mt-2 whitespace-nowrap"
                >
                  Delete
                </button>
              </li>
            ))}
            {grouped[decade].length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">
                No prompts for {decade} yet.
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PromptTextField({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (text: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="flex-1 bg-transparent border-b hairline focus:border-primary focus:outline-none px-1 py-2 text-base font-serif"
    />
  );
}

function NewPromptInline({ onCreate }: { onCreate: (text: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        + add option
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="New prompt text…"
        className="border hairline rounded-sm bg-background px-2 py-1 text-sm w-80"
        autoFocus
      />
      <button
        onClick={async () => {
          const t = text.trim();
          if (t.length < 3) return;
          await onCreate(t);
          setText("");
          setOpen(false);
        }}
        className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-sm"
      >
        Add
      </button>
      <button
        onClick={() => { setText(""); setOpen(false); }}
        className="text-xs text-muted-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------- Residuals: sessions the current archetype set couldn't confidently place ----------------
function ResidualsPanel() {
  const load = useServerFn(adminResidualQueue);
  const [reason, setReason] = useState<"any" | "low_score" | "ambiguous" | "no_archetypes">("any");
  const [lane, setLane] = useState("");

  const q = useQuery({
    queryKey: ["admin", "residuals", reason, lane],
    queryFn: () => load({ data: { limit: 100, reason, lane: lane || undefined } }),
  });

  const total = q.data?.total ?? 0;
  const flagged = q.data?.flagged ?? 0;
  const rate = total > 0 ? Math.round((flagged / total) * 1000) / 10 : 0;
  const reasons = q.data?.reasons ?? { low_score: 0, ambiguous: 0, no_archetypes: 0 };

  return (
    <div>
      <div className="mb-6 rounded-sm border hairline bg-muted/20 p-4">
        <p className="eyebrow mb-2">Residual review</p>
        <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
          Sessions the current archetype set couldn't confidently place. When the same shape keeps
          showing up here — same lane, same near-tied top 3, same "no fit" — that's the signal that
          a new archetype may need to be born. Not before.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <Stat label="Completed" value={total.toLocaleString()} />
          <Stat label="Flagged" value={flagged.toLocaleString()} />
          <Stat label="Residual rate" value={`${rate}%`} />
          <Stat label="Low score" value={reasons.low_score.toLocaleString()} tone="warn" />
          <Stat label="Ambiguous" value={reasons.ambiguous.toLocaleString()} tone="warn" />
        </div>
      </div>

      <div className="flex gap-3 items-center mb-3 flex-wrap">
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as typeof reason)}
          className="border hairline rounded-sm bg-background px-3 py-1.5 text-sm"
        >
          <option value="any">All reasons</option>
          <option value="low_score">Low score (best cosine below floor)</option>
          <option value="ambiguous">Ambiguous (top 2 near-tied)</option>
          <option value="no_archetypes">No archetypes matched</option>
        </select>
        <select
          value={lane}
          onChange={(e) => setLane(e.target.value)}
          className="border hairline rounded-sm bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All lanes</option>
          {["alternative", "pop", "hip_hop", "electronic", "classic_rock", "metal", "country", "r_and_b", "general"].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {q.data?.rows.length ?? 0} rows{q.isFetching ? " · loading…" : ""}
        </span>
      </div>

      {q.isError && (
        <p className="text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : "Failed to load residuals."}
        </p>
      )}

      <div className="border hairline rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Completed</th>
              <th className="text-left px-3 py-2">Lane</th>
              <th className="text-left px-3 py-2">Reason</th>
              <th className="text-left px-3 py-2">Score</th>
              <th className="text-left px-3 py-2">Margin</th>
              <th className="text-left px-3 py-2">Top 3</th>
              <th className="text-left px-3 py-2">Session</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.rows ?? []).map((row) => {
              const r = row as Record<string, unknown>;
              const top3 = (r.archetype_top3 as Array<{ name: string; score: number }> | null) ?? [];
              const share = r.share_token as string | null;
              const completed = r.completed_at as string | null;
              return (
                <tr key={r.id as string} className="border-t hairline">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {completed ? new Date(completed).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">{(r.lane as string) || "—"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-sm bg-amber-500/10 text-amber-500 px-2 py-0.5 text-xs font-mono">
                      {r.archetype_flag_reason as string}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{(r.archetype_score as number | null)?.toFixed(3) ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{(r.archetype_margin as number | null)?.toFixed(3) ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {top3.length
                      ? top3.map((t) => `${t.name} (${t.score.toFixed(2)})`).join(" · ")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {share ? (
                      <Link to="/s/$sessionId" params={{ sessionId: share }} className="underline text-xs">
                        view
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">no share</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!q.isLoading && (q.data?.rows.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nothing flagged. Either every listener fit an archetype, or nobody's finished a session yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-mono ${tone === "warn" ? "text-amber-500" : ""}`}>{value}</p>
    </div>
  );
}

// ---------------- Ontology dashboard: catalog shape, real-session heatmap, pairing/song health ----------------
type OntologySection = "coverage" | "heatmap" | "pairings" | "songs";

function OntologyPanel() {
  const load = useServerFn(adminOntology);
  const [section, setSection] = useState<OntologySection>("coverage");
  const [laneFilter, setLaneFilter] = useState("");

  const q = useQuery({
    queryKey: ["admin", "ontology"],
    queryFn: () => load(),
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground">Aggregating catalog + sessions…</p>;
  }
  if (q.isError || !q.data) {
    return (
      <p className="text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : "Failed to load ontology."}
      </p>
    );
  }
  const d = q.data;

  return (
    <div>
      <div className="mb-6 rounded-sm border hairline bg-muted/20 p-4">
        <p className="eyebrow mb-2">Ontology</p>
        <p className="text-sm text-muted-foreground max-w-3xl mb-4">
          Not for users. For you. Catalog shape, where listeners actually land, and which pairings
          and songs are earning their keep. Move the bottom bars.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <Stat label="Songs" value={`${d.totals.active_songs}/${d.totals.songs}`} />
          <Stat label="Pairings" value={`${d.totals.active_pairings}/${d.totals.pairings}`} />
          <Stat label="Archetypes" value={d.totals.archetypes.toLocaleString()} />
          <Stat label="Sessions" value={d.totals.sessions_sampled.toLocaleString()} />
          <Stat label="Choices" value={d.totals.choices_sampled.toLocaleString()} />
          <Stat label="Unassigned" value={d.unassigned_sessions.toLocaleString()} tone={d.unassigned_sessions > 0 ? "warn" : undefined} />
        </div>
      </div>

      <div className="flex gap-1 border-b hairline mb-4 flex-wrap">
        {(["coverage", "heatmap", "pairings", "songs"] as OntologySection[]).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-[0.18em] border-b-2 -mb-px ${
              section === s ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={laneFilter}
            onChange={(e) => setLaneFilter(e.target.value)}
            className="border hairline rounded-sm bg-background px-3 py-1.5 text-xs"
          >
            <option value="">All lanes</option>
            {d.lanes.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {section === "coverage" && <CoverageView d={d} laneFilter={laneFilter} />}
      {section === "heatmap" && <HeatmapView d={d} laneFilter={laneFilter} />}
      {section === "pairings" && <PairingHealthView d={d} laneFilter={laneFilter} />}
      {section === "songs" && <SongHealthView d={d} laneFilter={laneFilter} />}
    </div>
  );
}

type OntologyData = Awaited<ReturnType<typeof adminOntology>>;

function CoverageView({ d, laneFilter }: { d: OntologyData; laneFilter: string }) {
  const lanes = laneFilter ? [laneFilter] : d.lanes;
  const maxLaneSongs = Math.max(1, ...Object.values(d.lane_song_count));
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-3">Songs per lane</p>
        <div className="space-y-1.5">
          {d.lanes.slice().sort((a, b) => (d.lane_song_count[b] ?? 0) - (d.lane_song_count[a] ?? 0)).map((lane) => {
            const n = d.lane_song_count[lane] ?? 0;
            return (
              <div key={lane} className="flex items-center gap-3 text-xs">
                <div className="w-32 font-mono text-muted-foreground">{lane}</div>
                <div className="flex-1 bg-muted/30 rounded-sm h-4 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(n / maxLaneSongs) * 100}%` }} />
                </div>
                <div className="w-12 text-right font-mono">{n}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3">Coverage by archetype signal (per lane)</p>
        <p className="text-xs text-muted-foreground mb-3">
          Counts songs whose <code>archetype_signals</code> tag each archetype. Empty rows show where the catalog is thin.
        </p>
        <div className="space-y-6">
          {lanes.map((lane) => {
            const buckets = d.coverage[lane] ?? {};
            const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
            const max = Math.max(1, ...entries.map(([, n]) => n));
            return (
              <div key={lane}>
                <p className="text-sm font-mono uppercase tracking-wider mb-2">{lane} <span className="text-muted-foreground">· {d.lane_song_count[lane] ?? 0} songs</span></p>
                {entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No archetype signals tagged in this lane.</p>
                ) : (
                  <div className="space-y-1">
                    {entries.map(([name, n]) => (
                      <div key={name} className="flex items-center gap-3 text-xs">
                        <div className="w-40 text-muted-foreground truncate">{name}</div>
                        <div className="flex-1 bg-muted/30 rounded-sm h-3 overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
                        </div>
                        <div className="w-10 text-right font-mono">{n}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeatmapView({ d, laneFilter }: { d: OntologyData; laneFilter: string }) {
  const lanes = (laneFilter ? [laneFilter] : d.lanes).filter((l) => d.heatmap[l]);
  const archetypeCols = d.archetype_names;
  // Global max for consistent shading across the table.
  let globalMax = 1;
  for (const l of lanes) for (const a of archetypeCols) globalMax = Math.max(globalMax, d.heatmap[l]?.[a] ?? 0);

  if (lanes.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed sessions yet in {laneFilter || "any lane"}.</p>;
  }

  return (
    <div>
      <p className="eyebrow mb-2">Lane × winning archetype (real sessions)</p>
      <p className="text-xs text-muted-foreground mb-3">
        Where listeners actually land. Sparse columns are archetypes nobody's earning; dense off-lane cells hint at cross-lane taste.
      </p>
      <div className="overflow-x-auto border hairline rounded-sm">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1.5 font-mono uppercase tracking-wider sticky left-0 bg-muted/30">Lane</th>
              {archetypeCols.map((a) => (
                <th key={a} className="text-left px-2 py-1.5 font-mono uppercase tracking-wider">{a}</th>
              ))}
              <th className="text-right px-2 py-1.5 font-mono uppercase tracking-wider">Σ</th>
            </tr>
          </thead>
          <tbody>
            {lanes.map((lane) => {
              const row = d.heatmap[lane] ?? {};
              const total = Object.values(row).reduce((a, b) => a + b, 0);
              return (
                <tr key={lane} className="border-t hairline">
                  <td className="px-2 py-1.5 font-mono sticky left-0 bg-background">{lane}</td>
                  {archetypeCols.map((a) => {
                    const n = row[a] ?? 0;
                    const intensity = n === 0 ? 0 : 0.15 + (n / globalMax) * 0.65;
                    return (
                      <td key={a} className="px-2 py-1.5 font-mono" style={{ backgroundColor: n ? `rgba(99, 102, 241, ${intensity})` : undefined }}>
                        {n || "·"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PairingHealthView({ d, laneFilter }: { d: OntologyData; laneFilter: string }) {
  const [sort, setSort] = useState<"total" | "info_gain" | "avg_ms">("total");
  const rows = d.pairing_health
    .filter((p) => !laneFilter || p.lane === laneFilter)
    .slice()
    .sort((a, b) => {
      if (sort === "info_gain") return (b.info_gain ?? -1) - (a.info_gain ?? -1);
      if (sort === "avg_ms") return (b.avg_ms ?? 0) - (a.avg_ms ?? 0);
      return b.total - a.total;
    })
    .slice(0, 100);

  const [copied, setCopied] = useState(false);

  const exportRows = d.pairing_health
    .filter((p) => !laneFilter || p.lane === laneFilter);

  const buildJson = () => JSON.stringify(exportRows, null, 2);
  const buildCsv = () => {
    const cols = [
      "id", "lane", "difficulty", "user_facing_tradeoff", "hypothesis",
      "a_title", "b_title", "picks_a", "picks_b", "total", "split_a_pct",
      "avg_ms", "info_gain", "diagnostic_weight", "expected_split", "active",
    ] as const;
    const esc = (v: unknown) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = cols.join(",");
    const body = exportRows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(",")).join("\n");
    return `${header}\n${body}`;
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(buildJson());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const downloadCsv = () => {
    const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pairings-${laneFilter || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="eyebrow">Pairing health · {exportRows.length} pairings{laneFilter ? ` in ${laneFilter}` : ""}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={copyJson}
            className="border hairline rounded-sm px-3 py-1.5 text-xs hover:bg-muted transition"
          >
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            onClick={downloadCsv}
            className="border hairline rounded-sm px-3 py-1.5 text-xs hover:bg-muted transition"
          >
            Download CSV
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="border hairline rounded-sm bg-background px-3 py-1.5 text-xs"
          >
            <option value="total">Most tested</option>
            <option value="info_gain">Highest info gain</option>
            <option value="avg_ms">Longest hesitation</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Info gain rewards balanced splits (a 96/4 blowout teaches you nothing). Retire low info gain + low hesitation pairings. Export includes tradeoff copy, hypothesis, and difficulty for every pairing (respects lane filter).
      </p>
      <div className="border hairline rounded-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1.5">Pairing</th>
              <th className="text-left px-2 py-1.5">Lane</th>
              <th className="text-right px-2 py-1.5">Split</th>
              <th className="text-right px-2 py-1.5">Tests</th>
              <th className="text-right px-2 py-1.5">Avg ms</th>
              <th className="text-right px-2 py-1.5">Info gain</th>
              <th className="text-right px-2 py-1.5">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t hairline">
                <td className="px-2 py-1.5">
                  <div className="truncate max-w-md">{p.a_title} <span className="text-muted-foreground">vs</span> {p.b_title}</div>
                </td>
                <td className="px-2 py-1.5 font-mono text-muted-foreground">{p.lane}</td>
                <td className="px-2 py-1.5 text-right font-mono">{p.split_a_pct != null ? `${p.split_a_pct}/${100 - p.split_a_pct}` : "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono">{p.total}</td>
                <td className="px-2 py-1.5 text-right font-mono">{p.avg_ms ?? "—"}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${p.info_gain != null && p.info_gain < 30 ? "text-amber-500" : ""}`}>
                  {p.info_gain ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{p.diagnostic_weight ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No pairings match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SongHealthView({ d, laneFilter }: { d: OntologyData; laneFilter: string }) {
  const [sort, setSort] = useState<"appearances" | "info_contribution" | "avg_ms">("appearances");
  const rows = d.song_health
    .filter((s) => !laneFilter || s.lane === laneFilter)
    .slice()
    .sort((a, b) => {
      if (sort === "info_contribution") return (b.info_contribution ?? -1) - (a.info_contribution ?? -1);
      if (sort === "avg_ms") return (b.avg_ms ?? 0) - (a.avg_ms ?? 0);
      return b.appearances - a.appearances;
    })
    .slice(0, 150);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Song health</p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="border hairline rounded-sm bg-background px-3 py-1.5 text-xs"
        >
          <option value="appearances">Most appearances</option>
          <option value="info_contribution">Highest info contribution</option>
          <option value="avg_ms">Longest hesitation</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Diagnostic superstars vs songs that never teach you anything.
      </p>
      <div className="border hairline rounded-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1.5">Song</th>
              <th className="text-left px-2 py-1.5">Lane</th>
              <th className="text-right px-2 py-1.5">Appearances</th>
              <th className="text-right px-2 py-1.5">Chosen %</th>
              <th className="text-right px-2 py-1.5">Avg ms</th>
              <th className="text-right px-2 py-1.5">Info</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t hairline">
                <td className="px-2 py-1.5"><span className="font-medium">{s.title}</span> <span className="text-muted-foreground">— {s.artist}</span></td>
                <td className="px-2 py-1.5 font-mono text-muted-foreground">{s.lane}</td>
                <td className="px-2 py-1.5 text-right font-mono">{s.appearances}</td>
                <td className="px-2 py-1.5 text-right font-mono">{s.chosen_pct}%</td>
                <td className="px-2 py-1.5 text-right font-mono">{s.avg_ms ?? "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono">{s.info_contribution ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No songs match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ============ Diagnostics panel ============
// Reads the read-only diagnostic views (see docs/musicdna/instrumentation.md).
// Every table degrades gracefully when the view is missing (pre-migration),
// showing the reported error rather than blowing up the whole tab.
function DiagnosticsPanel() {
  const fn = useServerFn(adminDiagnostics);
  const q = useQuery({
    queryKey: ["admin", "diagnostics"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading diagnostics…</p>;
  }
  if (q.isError) {
    return <p className="text-sm text-red-600">Failed to load diagnostics: {(q.error as Error).message}</p>;
  }
  const d = q.data!;

  const Card = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="border hairline rounded-sm px-4 py-3 bg-surface">
      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="font-serif text-2xl mt-1">{value}</p>
    </div>
  );

  const Table = ({ title, block }: { title: string; block: { rows: Record<string, unknown>[]; error: string | null } }) => (
    <section className="mt-8">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="eyebrow">{title}</h2>
        <span className="text-[10px] font-mono text-muted-foreground">{block.rows.length} rows</span>
      </div>
      {block.error ? (
        <p className="text-xs font-mono text-amber-600 bg-amber-50 border hairline rounded-sm px-3 py-2">
          view unavailable — {block.error}. Run the instrumentation migration.
        </p>
      ) : block.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No rows yet.</p>
      ) : (
        <div className="overflow-x-auto border hairline rounded-sm">
          <table className="w-full text-xs font-mono">
            <thead className="bg-surface">
              <tr>
                {Object.keys(block.rows[0]).map((k) => (
                  <th key={k} className="text-left px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-t hairline">
                  {Object.keys(block.rows[0]).map((k) => {
                    const v = r[k];
                    const s = v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
                    return <td key={k} className="px-2 py-1.5 max-w-[24ch] truncate" title={s}>{s}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {block.rows.length > 50 && (
            <p className="px-3 py-2 text-[10px] font-mono text-muted-foreground border-t hairline">
              Showing first 50 of {block.rows.length}.
            </p>
          )}
        </div>
      )}
    </section>
  );

  const pct = (n: number | null) => n == null ? "—" : `${Math.round(n * 100)}%`;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4 max-w-2xl">
        Read-only diagnostic views over the instrumentation event log. See{" "}
        <code className="font-mono">docs/musicdna/instrumentation.md</code> for
        each field's contract and the derived-measure definitions.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Sessions final" value={d.headline.sessions_final} />
        <Card label="Residual rate" value={pct(d.headline.residual_rate)} />
        <Card label="Feedback captured" value={d.headline.feedback_captured} />
        <Card label="Human agreement" value={pct(d.headline.accuracy_rate)} />
      </div>

      <Table title="Session stability (winner by round)" block={d.session_stability} />
      <Table title="Axis independence (distinct supporting axes per session)" block={d.axis_independence} />
      <Table title="Contradiction load (evidence pushing against the winner)" block={d.contradiction_load} />
      <Table title="Residual rate (sessions where nobody fit cleanly)" block={d.residual_rate} />
      <Table title="Human agreement (fit tier vs. listener feedback)" block={d.human_agreement} />
    </div>
  );
}
