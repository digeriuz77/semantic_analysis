"use client";

import { useEffect, useState } from "react";
import type { CoreqResponse } from "@/types";
import { COREQ_ITEMS, COREQ_DOMAIN_LABEL } from "@/lib/coreq";
import { ArrowLeft, ClipboardCheck, Save, Download, Database } from "lucide-react";

interface CoreqChecklistViewProps {
  onBack: () => void;
}

const STORAGE_KEY = "ta:coreq-responses";
const STUDY_KEY_STORAGE = "ta:coreq-study";

function loadResponses(): Record<number, CoreqResponse> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<number, CoreqResponse>) : {};
  } catch {
    return {};
  }
}

function persistResponses(r: Record<number, CoreqResponse>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    /* storage unavailable */
  }
}

/** Server persistence, debounced per item so typing does not POST per keystroke. */
const pendingSaves = new Map<string, number>();

function saveToServer(study: string, id: number, next: CoreqResponse) {
  const key = `${study}::${id}`;
  if (pendingSaves.has(key)) {
    clearTimeout(pendingSaves.get(key));
  }
  const timer = setTimeout(() => {
    pendingSaves.delete(key);
    fetch("/api/coreq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ study, itemId: id, checked: next.checked, detail: next.detail }),
    }).catch(() => {
      /* offline: localStorage cache still holds the change */
    });
  }, 500) as unknown as number;
  pendingSaves.set(key, timer);
}

function loadStudy(): string {
  if (typeof window === "undefined") return "default";
  try {
    return window.localStorage.getItem(STUDY_KEY_STORAGE) || "default";
  } catch {
    return "default";
  }
}

export function CoreqChecklistView({ onBack }: CoreqChecklistViewProps) {
  const [responses, setResponses] = useState<Record<number, CoreqResponse>>(loadResponses);
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [study, setStudy] = useState<string>(loadStudy);
  const [serverSynced, setServerSynced] = useState(false);

  // Load server-side responses for the active study (SQLite outlives browser
  // data resets); merge only strictly-newer rows over the local cache.
  // Debounced so typing a study key does not fire a request per keystroke.
  useEffect(() => {
    const key = study.trim() || "default";
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/coreq?study=${encodeURIComponent(key)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { responses?: Record<string, { checked: boolean; detail: string; updatedAt: string }> } | null) => {
          if (cancelled || !data?.responses) return;
          setServerSynced(true);
          setResponses((prev) => {
            const merged = { ...prev };
            for (const [id, row] of Object.entries(data.responses!)) {
              const itemId = Number(id);
              if (!Number.isInteger(itemId)) continue;
              const local = merged[itemId];
              if (!local || new Date(row.updatedAt) > new Date(local.updatedAt)) {
                merged[itemId] = {
                  checked: row.checked,
                  detail: row.detail,
                  updatedAt: row.updatedAt,
                };
              }
            }
            persistResponses(merged);
            return merged;
          });
        })
        .catch(() => {
          /* offline: localStorage cache stands */
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [study]);

  // Cross-tab sync: another tab writing localStorage updates this one.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setResponses(loadResponses());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const domains = ["all", ...Object.keys(COREQ_DOMAIN_LABEL)];
  const items =
    filterDomain === "all"
      ? COREQ_ITEMS
      : COREQ_ITEMS.filter((i) => i.domain === filterDomain);

  const checkedCount = Object.values(responses).filter((r) => r.checked).length;
  const completion = Math.round((checkedCount / COREQ_ITEMS.length) * 100);

  const changeStudy = (value: string) => {
    setStudy(value);
    setServerSynced(false);
    try {
      window.localStorage.setItem(STUDY_KEY_STORAGE, value);
    } catch {
      /* ignore */
    }
  };

  const updateItem = (id: number, next: CoreqResponse) => {
    setResponses((prev) => {
      const updated = { ...prev, [id]: next };
      persistResponses(updated);
      return updated;
    });
    saveToServer(study.trim() || "default", id, next);
  };

  const toggle = (id: number) => {
    const existing = responses[id];
    updateItem(id, {
      checked: !existing?.checked,
      detail: existing?.detail ?? "",
      updatedAt: new Date().toISOString(),
    });
  };

  const updateDetail = (id: number, detail: string) => {
    const existing = responses[id];
    updateItem(id, {
      checked: existing?.checked ?? false,
      detail,
      updatedAt: new Date().toISOString(),
    });
  };

  const exportMarkdown = () => {
    const lines = COREQ_ITEMS.map((item) => {
      const r = responses[item.id];
      const status = r?.checked ? "[x]" : "[ ]";
      const detail = r?.detail ? ` — ${r.detail}` : "";
      return `${status} ${item.id}. ${item.question}${detail}`;
    });
    const md = `# COREQ 32-Item Checklist\n\nCompletion: ${completion}% (${checkedCount}/${COREQ_ITEMS.length})\n\n${lines.join("\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coreq-checklist.md";
    a.click();
    URL.revokeObjectURL(url);
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
          <ClipboardCheck className="text-teal-400" /> COREQ Checklist
        </h2>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          Consolidated criteria for reporting qualitative research (Tong,
          Sainsbury &amp; Craig, 2007). Self-check against 32 reporting items.
          Responses persist per study in the local database (with a browser
          cache for offline use) and can be exported.
        </p>

        {/* Study key: separates checklists between projects */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Database size={14} className="text-slate-500" />
          <label className="text-xs text-slate-400" htmlFor="coreq-study">
            Study
          </label>
          <input
            id="coreq-study"
            type="text"
            value={study}
            onChange={(e) => changeStudy(e.target.value)}
            placeholder="default"
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:border-teal-600 outline-none w-48"
          />
          <span className="text-xs text-slate-600">
            {serverSynced ? "synced with local database" : "local cache only"}
          </span>
        </div>

        {/* Progress + actions */}
        <div className="mt-5 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Completion</span>
              <span>
                {checkedCount}/{COREQ_ITEMS.length} ({completion}%)
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-blue-500 rounded-full transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={15} /> Export Markdown
          </button>
        </div>
      </div>

      {/* Domain filter */}
      <div className="flex gap-2 flex-wrap">
        {domains.map((d) => (
          <button
            key={d}
            onClick={() => setFilterDomain(d)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterDomain === d
                ? "bg-teal-600 border-teal-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {d === "all" ? "All domains" : COREQ_DOMAIN_LABEL[d as keyof typeof COREQ_DOMAIN_LABEL]}
          </button>
        ))}
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {items.map((item) => {
          const r = responses[item.id];
          return (
            <div
              key={item.id}
              className={`bg-slate-900/50 border rounded-lg p-4 transition-colors ${
                r?.checked ? "border-teal-700/50" : "border-slate-800"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggle(item.id)}
                  className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    r?.checked
                      ? "bg-teal-600 border-teal-500 text-white"
                      : "border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {r?.checked && <Save size={11} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-mono text-slate-600">{item.id}.</span>
                    <span className="text-slate-200 text-sm">{item.question}</span>
                  </div>
                  <span className="text-xs text-slate-600 mt-0.5 inline-block">
                    {COREQ_DOMAIN_LABEL[item.domain]}
                  </span>
                  <input
                    type="text"
                    value={r?.detail ?? ""}
                    onChange={(e) => updateDetail(item.id, e.target.value)}
                    placeholder="How is this addressed? (optional)"
                    className="w-full mt-2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:border-teal-600 outline-none"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
