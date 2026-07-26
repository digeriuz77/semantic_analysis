"use client";

import { useRef, useState } from "react";
import type { CorpusDocument, Statement } from "@/types/corpus";
import { FileText, Quote } from "lucide-react";

interface DocumentViewerProps {
  document: CorpusDocument;
  statements: Statement[];
  onCodeSelection: (text: string, start: number, end: number) => void;
  onJumpToStatement?: (stmt: Statement) => void;
}

/**
 * Renders a document's content and lets the researcher select a text span to
 * code it as a statement. Coded statements are underlined (colored by concept)
 * and clickable to jump to their detail.
 */
export function DocumentViewer({
  document: doc,
  statements,
  onCodeSelection,
  onJumpToStatement,
}: DocumentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) {
      setSelection(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 2) {
      setSelection(null);
      return;
    }
    // Approximate offsets within the raw content (close enough for traceability).
    const start = doc.content.indexOf(text);
    const end = start >= 0 ? start + text.length : null;
    setSelection({ text, start: start >= 0 ? start : 0, end: end ?? text.length });
    sel.removeAllRanges();
  };

  // Build highlight markers from statements with known offsets.
  const highlights = statements
    .filter((s) => s.startOffset !== null && s.endOffset !== null && s.text)
    .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));

  const renderContent = () => {
    if (highlights.length === 0) {
      return <span>{doc.content}</span>;
    }
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    highlights.forEach((h, i) => {
      const start = h.startOffset!;
      const end = h.endOffset!;
      if (start > cursor) parts.push(<span key={`p${i}`}>{doc.content.slice(cursor, start)}</span>);
      parts.push(
        <mark
          key={`h${i}`}
          onClick={(e) => {
            e.stopPropagation();
            onJumpToStatement?.(h);
          }}
          title={`${h.conceptName ?? "uncoded"} · ${h.actorName ?? "unknown"}`}
          className="rounded px-0.5 cursor-pointer border-b-2 hover:opacity-80"
          style={{
            backgroundColor: `${h.conceptColor ?? "#0d9488"}33`,
            borderBottomColor: h.conceptColor ?? "#0d9488",
          }}
        >
          {doc.content.slice(start, end)}
        </mark>
      );
      cursor = end;
    });
    if (cursor < doc.content.length) parts.push(<span key="tail">{doc.content.slice(cursor)}</span>);
    return parts;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={16} className="text-teal-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {doc.title || doc.fileName}
            </p>
            <p className="text-slate-500 text-xs">
              {doc.sourceType.replace("_", " ")}
              {doc.docDate ? ` · ${doc.docDate}` : ""} ·{" "}
              {statements.length} coded
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div
          ref={contentRef}
          onMouseUp={handleMouseUp}
          className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap select-text"
        >
          {renderContent()}
        </div>
      </div>

      {selection && (
        <div className="border-t border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-start gap-3">
            <Quote size={16} className="text-teal-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs mb-1">Selected evidence:</p>
              <p className="text-slate-200 text-sm italic line-clamp-2">
                &ldquo;{selection.text}&rdquo;
              </p>
            </div>
            <button
              onClick={() => {
                onCodeSelection(selection.text, selection.start, selection.end);
                setSelection(null);
              }}
              className="flex-shrink-0 bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              Code this →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
