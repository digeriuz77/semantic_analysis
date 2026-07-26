"use client";

import { useState } from "react";
import type { Stance, Statement } from "@/types/corpus";
import { createStatement, updateStatement, type StatementDraft } from "@/lib/corpusClient";
import { X, Save } from "lucide-react";

interface StatementEditorProps {
  documentId: number;
  /** Pre-filled text span from a selection, or an existing statement to edit. */
  initial?: Partial<Statement>;
  /** Existing actor/concept names for autocomplete suggestions. */
  actorNames: string[];
  conceptNames: string[];
  onSaved: () => void;
  onClose: () => void;
}

const STANCES: { value: Stance; label: string; color: string }[] = [
  { value: "agree", label: "Agree", color: "#0d9488" },
  { value: "disagree", label: "Disagree", color: "#ef4444" },
  { value: "neutral", label: "Neutral", color: "#3b82f6" },
  { value: "undefined", label: "Undefined", color: "#64748b" },
];

export function StatementEditor({
  documentId,
  initial,
  actorNames,
  conceptNames,
  onSaved,
  onClose,
}: StatementEditorProps) {
  const isEdit = Boolean(initial?.id);
  const [text, setText] = useState(initial?.text ?? "");
  const [actorName, setActorName] = useState(initial?.actorName ?? "");
  const [actorType, setActorType] = useState(initial?.actorType ?? "person");
  const [conceptName, setConceptName] = useState(initial?.conceptName ?? "");
  const [stance, setStance] = useState<Stance>(initial?.stance ?? "undefined");
  const [stmtDate, setStmtDate] = useState(initial?.stmtDate ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!text.trim()) {
      setError("Statement text is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const draft: StatementDraft = {
        documentId,
        text: text.trim(),
        startOffset: initial?.startOffset ?? null,
        endOffset: initial?.endOffset ?? null,
        actorName: actorName.trim() || undefined,
        actorType,
        conceptName: conceptName.trim() || undefined,
        stance,
        stmtDate: stmtDate || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      };
      if (isEdit && initial?.id) {
        await updateStatement(initial.id, draft);
      } else {
        await createStatement(draft);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-white font-semibold">
            {isEdit ? "Edit statement" : "Code statement"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Evidence text */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Evidence span
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none resize-y"
              placeholder="The verbatim text this statement is drawn from."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Actor */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Actor (who)
              </label>
              <input
                list="actor-options"
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none"
                placeholder="Name or unknown"
              />
              <datalist id="actor-options">
                {actorNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Actor type
              </label>
              <select
                value={actorType}
                onChange={(e) => setActorType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none"
              >
                <option value="person">Person</option>
                <option value="organization">Organization</option>
                <option value="location">Location</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Concept */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Concept (what)
              </label>
              <input
                list="concept-options"
                value={conceptName}
                onChange={(e) => setConceptName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none"
                placeholder="Code / category"
              />
              <datalist id="concept-options">
                {conceptNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            {/* Stance */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Stance
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STANCES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStance(s.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                    style={{
                      color: stance === s.value ? "#fff" : s.color,
                      borderColor: stance === s.value ? s.color : "#334155",
                      backgroundColor: stance === s.value ? `${s.color}44` : "transparent",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Date (when)
              </label>
              <input
                type="date"
                value={stmtDate ? stmtDate.slice(0, 10) : ""}
                onChange={(e) => setStmtDate(e.target.value || null)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none"
              />
            </div>
            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Location (where)
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Researcher note
            </label>
            <textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none resize-y"
              placeholder="Optional memo"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={15} /> {saving ? "Saving…" : isEdit ? "Update" : "Code it"}
          </button>
        </div>
      </div>
    </div>
  );
}
