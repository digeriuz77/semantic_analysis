"use client";

import { useEffect, useState } from "react";
import type { InspectResponse, InspectedColumn } from "@/lib/nlp";
import { ArrowLeft, ArrowRight, Table2, Hash, Calendar, Type, Tag, AlertTriangle } from "lucide-react";

interface CsvColumnPickerProps {
  /** CSV files in the analysis batch (non-CSV files are skipped silently). */
  csvFiles: File[];
  /** Current selections: file name -> selected column indices. */
  selections: Record<string, number[]>;
  onChange: (fileName: string, indices: number[]) => void;
  onComplete: () => void;
  onBack: () => void;
}

const TYPE_ICON: Record<InspectedColumn["type"], typeof Table2> = {
  text: Type,
  numeric: Hash,
  datetime: Calendar,
  categorical: Tag,
};

const TYPE_COLOR: Record<InspectedColumn["type"], string> = {
  text: "#0d9488",
  numeric: "#3b82f6",
  datetime: "#8b5cf6",
  categorical: "#64748b",
};

export function CsvColumnPicker({
  csvFiles,
  selections,
  onChange,
  onComplete,
  onBack,
}: CsvColumnPickerProps) {
  const [inspections, setInspections] = useState<Record<string, InspectResponse>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      csvFiles.map(async (file) => {
        // Inspect via the Next orchestrator proxy-less path: this component
        // runs client-side, so go through a small fetch to /api/nlp-inspect
        // which forwards to the Python service with no key exposure.
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/nlp-inspect", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Inspect failed (${res.status})`);
        }
        return [file.name, await res.json()] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        const map = Object.fromEntries(entries) as Record<string, InspectResponse>;
        setInspections(map);
        // Pre-select the suggested text columns for any file not yet chosen.
        for (const [name, insp] of Object.entries(map)) {
          if (!selections[name] && insp.suggestedTextColumns) {
            onChange(name, insp.suggestedTextColumns);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErrors({ "*": e instanceof Error ? e.message : "Could not inspect files" });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvFiles]);

  const allReady =
    !loading &&
    csvFiles.every((f) => {
      const sel = selections[f.name];
      return sel && sel.length > 0;
    });

  const toggleColumn = (fileName: string, idx: number, suggested: boolean) => {
    const current = selections[fileName] ?? [];
    let next: number[];
    if (current.includes(idx)) {
      next = current.filter((i) => i !== idx);
    } else {
      next = [...current, idx];
    }
    // Guard: never allow deselecting into emptiness.
    if (next.length === 0 && !suggested) return;
    if (next.length === 0) return;
    onChange(fileName, next.sort((a, b) => a - b));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Table2 className="text-teal-400" /> Tabular Input Detected
        </h2>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          CSV files are analyzed per <span className="text-slate-200">response row</span>.
          Confirm which columns contain free-text responses — numeric, date, and ID
          columns stay out of the analysis so themes are grounded in what
          respondents actually said. Evidence will cite row numbers.
        </p>
      </div>

      {errors["*"] && (
        <div className="flex items-start gap-3 bg-red-900/20 border border-red-700/50 rounded-xl p-4">
          <AlertTriangle size={18} className="text-red-400 mt-0.5" />
          <div className="text-sm text-red-200">
            {errors["*"]}
            <button
              onClick={onComplete}
              className="block mt-2 text-xs text-red-300 underline hover:text-red-200"
            >
              Continue with automatic column detection
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-slate-400 text-sm font-mono">Inspecting column structure…</div>
      )}

      {!loading &&
        csvFiles.map((file) => {
          const insp = inspections[file.name];
          if (!insp || insp.mode !== "tabular") return null;
          const selected = selections[file.name] ?? [];
          return (
            <div
              key={file.name}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-6"
            >
              <div className="flex items-baseline justify-between gap-4 flex-wrap mb-1">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Table2 size={16} className="text-teal-400" /> {file.name}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {insp.rowCount?.toLocaleString()} rows · delimiter{" "}
                  {insp.delimiter === "\t" ? "\\t" : insp.delimiter} · {insp.encoding}
                  {insp.truncated ? " · first 5,000 rows" : ""}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Checked columns are analyzed as response text. Row numbers in the
                CSV (header = row 1) are preserved end-to-end.
              </p>
              <div className="space-y-1.5">
                {(insp.columns ?? []).map((col) => {
                  const Icon = TYPE_ICON[col.type] ?? Tag;
                  const color = TYPE_COLOR[col.type] ?? "#64748b";
                  const isSel = selected.includes(col.index);
                  return (
                    <button
                      key={col.index}
                      onClick={() => toggleColumn(file.name, col.index, col.isText)}
                      disabled={isSel && selected.length === 1}
                      title={
                        isSel && selected.length === 1
                          ? "At least one response column must stay selected"
                          : undefined
                      }
                      className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        isSel
                          ? "border-teal-600 bg-teal-900/20"
                          : "border-slate-800 bg-slate-950 hover:border-slate-600"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                          isSel
                            ? "bg-teal-600 border-teal-500 text-white"
                            : "border-slate-600 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <Icon size={14} style={{ color }} className="flex-shrink-0" />
                      <span className="text-sm text-slate-200 truncate">{col.name}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 uppercase tracking-wide"
                        style={{ color, borderColor: `${color}55`, backgroundColor: `${color}11` }}
                      >
                        {col.type}
                      </span>
                      <span className="ml-auto text-xs text-slate-500 font-mono flex-shrink-0">
                        ~{col.meanLength} chars · {Math.round(col.distinctRatio * 100)}% distinct
                        {col.emptyRatio > 0.05
                          ? ` · ${Math.round(col.emptyRatio * 100)}% empty`
                          : ""}
                      </span>
                      {col.isText && (
                        <span className="text-[10px] text-teal-400 flex-shrink-0">
                          suggested
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-500">
          {allReady ? "Ready — response columns selected." : "Select at least one text column per file."}
        </span>
        <button
          onClick={onComplete}
          disabled={!allReady && !errors["*"]}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Continue to Configuration <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
