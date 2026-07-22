"use client";

import { useEffect, useState } from "react";
import type { DatasetDescriptor, DatasetIndex, FrameworkId } from "@/types";
import { FRAMEWORKS } from "@/lib/frameworks";
import { Library, FileText, ArrowRight, Loader2 } from "lucide-react";

interface DatasetGalleryProps {
  onSelect: (file: File, framework: FrameworkId) => void;
}

export function DatasetGallery({ onSelect }: DatasetGalleryProps) {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/datasets/index.json")
      .then((r) => r.json())
      .then((data: DatasetIndex) => setIndex(data))
      .catch(() => setError("Could not load sample datasets."));
  }, []);

  const pick = async (ds: DatasetDescriptor) => {
    setLoadingId(ds.id);
    setError(null);
    try {
      const res = await fetch(ds.path);
      if (!res.ok) throw new Error(`Failed to load ${ds.path}`);
      const text = await res.text();
      const filename = ds.path.split("/").pop() ?? "sample.txt";
      const file = new File([text], filename, { type: "text/plain" });
      const framework = (ds.suggestedMethodology as FrameworkId) ?? "reflexive_ta";
      onSelect(file, framework);
    } catch {
      setError("Could not load that dataset.");
      setLoadingId(null);
    }
  };

  if (error) {
    return <p className="text-slate-500 text-sm">{error}</p>;
  }

  if (!index) {
    return (
      <p className="text-slate-500 text-sm flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading samples…
      </p>
    );
  }

  return (
    <div className="mt-10">
      <h3 className="text-lg font-medium text-white mb-1 flex items-center gap-2">
        <Library size={18} className="text-teal-400" /> Try a sample corpus
      </h3>
      <p className="text-slate-400 text-xs mb-4 max-w-xl">
        One-click synthetic datasets. Each pre-selects a fitting analytical
        framework — you can adjust it in the next step.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {index.datasets.map((ds) => {
          const fw = FRAMEWORKS[(ds.suggestedMethodology as FrameworkId) ?? "reflexive_ta"];
          const isLoading = loadingId === ds.id;
          return (
            <button
              key={ds.id}
              onClick={() => pick(ds)}
              disabled={isLoading}
              className="text-left bg-slate-900/50 border border-slate-800 hover:border-teal-500/60 rounded-xl p-4 transition-colors group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-2">
                <FileText size={16} className="text-teal-400" />
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin text-slate-500" />
                ) : (
                  <ArrowRight
                    size={14}
                    className="text-slate-600 group-hover:text-teal-400 transition-colors"
                  />
                )}
              </div>
              <p className="text-slate-200 text-sm font-medium">{ds.title}</p>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                {ds.summary}
              </p>
              <span className="inline-block mt-2 text-xs text-teal-400/80">
                {fw?.label ?? "reflexive TA"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
