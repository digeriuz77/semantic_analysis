"use client";

import { Loader2, XCircle } from "lucide-react";

interface ProcessingViewProps {
  step: string;
  progress: number;
  /** When provided, a cancel button is shown (aborts in-flight requests). */
  onCancel?: () => void;
}

export function ProcessingView({ step, progress, onCancel }: ProcessingViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
        <div
          className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"
        ></div>
        <Loader2 size={40} className="absolute inset-0 m-auto text-white animate-pulse" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">Analyzing Corpus</h2>
      <p className="text-teal-400 font-mono text-sm mb-8">{step}</p>

      <div className="w-full max-w-md bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-6 flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm transition-colors"
        >
          <XCircle size={15} /> Cancel analysis
        </button>
      )}

      <div className="mt-8 grid grid-cols-3 gap-8 text-center opacity-60">
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></div>
          <span className="text-xs text-slate-400">Tokenization</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          <span className="text-xs text-slate-400">Thematic Clustering</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
          <span className="text-xs text-slate-400">Semantic Mapping</span>
        </div>
      </div>
    </div>
  );
}