"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Actor,
  Concept,
  CorpusDocument,
  Statement,
  StatementFacets,
  StatementFilter,
  Stance,
} from "@/types/corpus";
import {
  annotateStatement,
  deleteDocument,
  deleteStatement,
  fetchActors,
  fetchConcepts,
  fetchDocuments,
  fetchFacets,
  fetchStatements,
  ingestDocument,
} from "@/lib/corpusClient";
import { DocumentViewer } from "@/components/workspace/DocumentViewer";
import { StatementEditor } from "@/components/workspace/StatementEditor";
import {
  Plus,
  Upload,
  Trash2,
  Pencil,
  Flag,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  FileText,
  Layers,
  Users,
  Calendar,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const STANCE_COLOR: Record<Stance, string> = {
  agree: "#0d9488",
  disagree: "#ef4444",
  neutral: "#3b82f6",
  undefined: "#64748b",
};

export default function WorkspacePage() {
  const [documents, setDocuments] = useState<CorpusDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [facets, setFacets] = useState<StatementFacets | null>(null);
  const [filter, setFilter] = useState<StatementFilter>({});
  const [editor, setEditor] = useState<{
    open: boolean;
    initial?: Partial<Statement>;
    prefill?: { text: string; start: number; end: number };
  }>({ open: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setDocuments(await fetchDocuments());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load corpus");
    }
  }, []);

  const loadMeta = useCallback(async () => {
    const [a, c] = await Promise.all([fetchActors(), fetchConcepts()]);
    setActors(a);
    setConcepts(c);
  }, []);

  useEffect(() => {
    loadDocuments();
    loadMeta();
  }, [loadDocuments, loadMeta]);

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) ?? null,
    [documents, selectedDocId]
  );

  const effectiveFilter: StatementFilter = useMemo(
    () => ({ ...filter, documentId: selectedDocId ?? undefined }),
    [filter, selectedDocId]
  );

  const loadStatementsAndFacets = useCallback(async () => {
    if (!selectedDocId) {
      setStatements([]);
      setFacets(null);
      return;
    }
    try {
      const [stmts, fac] = await Promise.all([
        fetchStatements(effectiveFilter),
        fetchFacets(effectiveFilter),
      ]);
      setStatements(stmts);
      setFacets(fac);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load statements");
    }
  }, [effectiveFilter, selectedDocId]);

  useEffect(() => {
    loadStatementsAndFacets();
  }, [loadStatementsAndFacets]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await ingestDocument(file, { sourceType: "interview" });
      await loadDocuments();
      await loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleCodeSelection = (text: string, start: number, end: number) => {
    setEditor({ open: true, prefill: { text, start, end } });
  };

  const handleSaved = async () => {
    await loadStatementsAndFacets();
    await loadMeta();
    await loadDocuments();
  };

  const handleAnnotate = async (stmt: Statement, status: "accepted" | "rejected" | "flagged") => {
    try {
      await annotateStatement(stmt.id, status, null);
      await loadStatementsAndFacets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Annotation failed");
    }
  };

  const handleDeleteStatement = async (id: number) => {
    if (!confirm("Delete this statement?")) return;
    await deleteStatement(id);
    await loadStatementsAndFacets();
    await loadMeta();
  };

  const handleDeleteDoc = async (id: number) => {
    if (!confirm("Delete this document and all its statements?")) return;
    await deleteDocument(id);
    if (selectedDocId === id) setSelectedDocId(null);
    await loadDocuments();
  };

  return (
    <main className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="text-teal-400" size={18} /> Research Workspace
          </h1>
        </div>
        <Link href="/analyzer" className="text-xs text-slate-400 hover:text-teal-400 transition-colors">
          Quick analysis →
        </Link>
      </header>

      {error && (
        <div className="bg-red-900/30 border-b border-red-800 px-5 py-2 text-red-200 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline">dismiss</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-slate-800 bg-slate-950/50 flex flex-col">
          <div className="p-3 border-b border-slate-800">
            <label className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm cursor-pointer transition-colors">
              <Upload size={15} /> {busy ? "Ingesting…" : "Add document"}
              <input type="file" accept=".txt,.pdf,.csv,.docx" onChange={handleUpload} className="hidden" />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {documents.length === 0 && (
              <p className="text-slate-600 text-xs p-3 text-center">
                No documents yet. Upload one or add a sample to begin coding.
              </p>
            )}
            {documents.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setSelectedDocId(d.id);
                  setFilter({});
                }}
                className={`w-full text-left p-2.5 rounded-lg transition-colors group ${
                  selectedDocId === d.id
                    ? "bg-teal-900/30 border border-teal-700/50"
                    : "hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <div className="flex items-start gap-2">
                  <FileText size={14} className="text-teal-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200 text-xs font-medium truncate">
                      {d.title || d.fileName}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      {d.statementCount ?? 0} coded{d.docDate ? ` · ${d.docDate}` : ""}
                    </p>
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoc(d.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={13} />
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-600">
            Corpus persists locally in <code>data/corpus.db</code>
          </div>
        </aside>

        {!selectedDoc ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
            <FileText size={40} className="mb-3 opacity-40" />
            <p className="text-sm">Select a document to begin coding evidence.</p>
            <p className="text-xs mt-1 max-w-sm text-center">
              Select text in the document to attribute it to an actor, concept, and date.
              Iterate, filter by entity or time window, and compare.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <FilterBar filter={filter} onChange={setFilter} actors={actors} concepts={concepts} />

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 border-r border-slate-800 bg-slate-900/30 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Document</span>
                  <button
                    onClick={() => setEditor({ open: true })}
                    className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300"
                  >
                    <Plus size={13} /> Statement
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <DocumentViewer
                    document={selectedDoc}
                    statements={statements}
                    onCodeSelection={handleCodeSelection}
                  />
                </div>
              </div>

              <div className="w-[440px] flex flex-col bg-slate-950/30 overflow-hidden">
                {facets && <FacetsStrip facets={facets} />}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {statements.length === 0 ? (
                    <p className="text-slate-600 text-xs text-center mt-8">
                      No statements match this filter. Code evidence by selecting text in the document.
                    </p>
                  ) : (
                    statements.map((s) => (
                      <StatementCard
                        key={s.id}
                        statement={s}
                        onAnnotate={handleAnnotate}
                        onEdit={() => setEditor({ open: true, initial: s })}
                        onDelete={() => handleDeleteStatement(s.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {editor.open && selectedDocId && (
        <StatementEditor
          documentId={selectedDocId}
          initial={
            editor.initial
              ? editor.initial
              : editor.prefill
              ? { text: editor.prefill.text, startOffset: editor.prefill.start, endOffset: editor.prefill.end }
              : undefined
          }
          actorNames={actors.map((a) => a.name)}
          conceptNames={concepts.map((c) => c.name)}
          onSaved={handleSaved}
          onClose={() => setEditor({ open: false })}
        />
      )}
    </main>
  );
}

function FilterBar({
  filter,
  onChange,
  actors,
  concepts,
}: {
  filter: StatementFilter;
  onChange: (f: StatementFilter) => void;
  actors: Actor[];
  concepts: Concept[];
}) {
  const set = (patch: Partial<StatementFilter>) => onChange({ ...filter, ...patch });
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/50 flex-wrap">
      <Filter size={14} className="text-slate-500 flex-shrink-0" />
      <select
        value={filter.actorId ?? ""}
        onChange={(e) => set({ actorId: e.target.value ? Number(e.target.value) : undefined })}
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-teal-500 outline-none"
      >
        <option value="">All actors</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
        ))}
      </select>
      <select
        value={filter.conceptId ?? ""}
        onChange={(e) => set({ conceptId: e.target.value ? Number(e.target.value) : undefined })}
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-teal-500 outline-none"
      >
        <option value="">All concepts</option>
        {concepts.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select
        value={filter.stance ?? ""}
        onChange={(e) => set({ stance: (e.target.value || undefined) as Stance | undefined })}
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-teal-500 outline-none"
      >
        <option value="">Any stance</option>
        <option value="agree">Agree</option>
        <option value="disagree">Disagree</option>
        <option value="neutral">Neutral</option>
        <option value="undefined">Undefined</option>
      </select>
      <div className="flex items-center gap-1">
        <Calendar size={13} className="text-slate-500" />
        <input
          type="date"
          value={filter.dateFrom ?? ""}
          onChange={(e) => set({ dateFrom: e.target.value || undefined })}
          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-teal-500 outline-none"
        />
        <span className="text-slate-600 text-xs">→</span>
        <input
          type="date"
          value={filter.dateTo ?? ""}
          onChange={(e) => set({ dateTo: e.target.value || undefined })}
          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-teal-500 outline-none"
        />
      </div>
      <div className="relative flex-1 min-w-[120px]">
        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={filter.search ?? ""}
          onChange={(e) => set({ search: e.target.value || undefined })}
          placeholder="Search text / notes…"
          className="w-full bg-slate-950 border border-slate-700 rounded pl-7 pr-2 py-1 text-slate-200 text-xs focus:border-teal-500 outline-none"
        />
      </div>
      <MapPin size={13} className="text-slate-500" />
      <input
        value={filter.location ?? ""}
        onChange={(e) => set({ location: e.target.value || undefined })}
        placeholder="Location"
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-teal-500 outline-none w-24"
      />
    </div>
  );
}

function FacetsStrip({ facets }: { facets: StatementFacets }) {
  const maxActor = Math.max(...facets.byActor.map((a) => a.count), 1);
  const maxConcept = Math.max(...facets.byConcept.map((c) => c.count), 1);
  return (
    <div className="border-b border-slate-800 p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-slate-500 uppercase tracking-wide">
          {facets.total} statement{facets.total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-1.5 ml-auto">
          {(["agree", "disagree", "neutral", "undefined"] as Stance[]).map((s) => (
            <span
              key={s}
              className="text-[10px] px-1.5 py-0.5 rounded-full border"
              style={{ color: STANCE_COLOR[s], borderColor: STANCE_COLOR[s] + "55", backgroundColor: STANCE_COLOR[s] + "11" }}
              title={s}
            >
              {s[0].toUpperCase()} {facets.byStance[s]}
            </span>
          ))}
        </div>
      </div>
      {facets.byActor.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-600 uppercase mb-1 flex items-center gap-1"><Users size={10} /> By actor</p>
          <div className="space-y-1">
            {facets.byActor.slice(0, 4).map((a) => (
              <div key={a.actorId} className="flex items-center gap-2">
                <span className="text-[11px] text-slate-300 w-20 truncate">{a.name}</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(a.count / maxActor) * 100}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 font-mono w-5 text-right">{a.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {facets.byConcept.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-600 uppercase mb-1 flex items-center gap-1"><Layers size={10} /> By concept</p>
          <div className="space-y-1">
            {facets.byConcept.slice(0, 4).map((c) => (
              <div key={c.conceptId} className="flex items-center gap-2">
                <span className="text-[11px] text-slate-300 w-20 truncate">{c.name}</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(c.count / maxConcept) * 100}%`, backgroundColor: c.color }} />
                </div>
                <span className="text-[10px] text-slate-500 font-mono w-5 text-right">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatementCard({
  statement: s,
  onAnnotate,
  onEdit,
  onDelete,
}: {
  statement: Statement;
  onAnnotate: (s: Statement, status: "accepted" | "rejected" | "flagged") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 group">
      <div className="flex items-start gap-2 mb-1.5">
        <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: STANCE_COLOR[s.stance] }} />
        <p className="text-slate-200 text-xs leading-relaxed flex-1">&ldquo;{s.text}&rdquo;</p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {s.actorName && (
          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
            <Users size={9} className="inline mr-0.5" />{s.actorName}
          </span>
        )}
        {s.conceptName && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: s.conceptColor ?? "#0d9488", backgroundColor: `${s.conceptColor ?? "#0d9488"}22` }}>
            {s.conceptName}
          </span>
        )}
        {s.stmtDate && (
          <span className="text-[10px] text-slate-500"><Calendar size={9} className="inline mr-0.5" />{s.stmtDate.slice(0, 10)}</span>
        )}
        {s.location && (
          <span className="text-[10px] text-slate-500"><MapPin size={9} className="inline mr-0.5" />{s.location}</span>
        )}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto" style={{ color: STANCE_COLOR[s.stance], backgroundColor: STANCE_COLOR[s.stance] + "22" }}>
          {s.stance}
        </span>
      </div>
      {s.notes && <p className="text-[11px] text-slate-500 italic mb-2">📝 {s.notes}</p>}
      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onAnnotate(s, "accepted")} title="Accept" className="p-1 hover:bg-teal-900/40 rounded text-slate-400 hover:text-teal-400">
          <CheckCircle2 size={13} />
        </button>
        <button onClick={() => onAnnotate(s, "rejected")} title="Reject" className="p-1 hover:bg-red-900/40 rounded text-slate-400 hover:text-red-400">
          <XCircle size={13} />
        </button>
        <button onClick={() => onAnnotate(s, "flagged")} title="Flag" className="p-1 hover:bg-amber-900/40 rounded text-slate-400 hover:text-amber-400">
          <Flag size={13} />
        </button>
        <button onClick={onEdit} title="Edit" className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white ml-auto">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} title="Delete" className="p-1 hover:bg-red-900/40 rounded text-slate-400 hover:text-red-400">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
