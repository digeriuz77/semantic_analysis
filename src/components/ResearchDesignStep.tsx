"use client";

import { useState } from "react";
import type { FrameworkId, ParadigmId, ResearchDesign } from "@/types";
import { PARADIGM_LIST, PARADIGMS } from "@/lib/paradigms";
import { FRAMEWORK_LIST, FRAMEWORKS, frameworkForParadigm } from "@/lib/frameworks";
import { Compass, BookOpen, ArrowRight, Check } from "lucide-react";

interface ResearchDesignStepProps {
  files: File[];
  onComplete: (design: ResearchDesign) => void;
  onBack: () => void;
}

export function ResearchDesignStep({ files, onComplete, onBack }: ResearchDesignStepProps) {
  const [paradigm, setParadigm] = useState<ParadigmId>("constructivist");
  const [framework, setFramework] = useState<FrameworkId>("reflexive_ta");

  const activeParadigm = PARADIGMS[paradigm];
  const activeFramework = FRAMEWORKS[framework];
  const recommendedFrameworks = FRAMEWORK_LIST.filter((f) =>
    f.suitsParadigms.includes(paradigm)
  );

  const selectParadigm = (id: ParadigmId) => {
    setParadigm(id);
    // If the current framework doesn't suit this paradigm, switch to the recommendation.
    if (!FRAMEWORKS[framework].suitsParadigms.includes(id)) {
      setFramework(frameworkForParadigm(id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="text-slate-400 hover:text-white transition-colors text-sm"
      >
        ← Back to upload
      </button>

      {/* Intro */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Compass className="text-teal-400" /> Research Design
        </h2>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          Methodology before method. Your paradigm determines which validity
          criteria are appropriate — constructivist work foregrounds Lincoln &amp;
          Guba trustworthiness and is{" "}
          <span className="text-slate-200">not</span> forced to report Cohen&apos;s
          kappa, whereas post-positivist work may. This choice flows into the
          analysis and the pipeline trace for full transparency.
        </p>
      </div>

      {/* Paradigm selection */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Compass size={18} className="text-teal-400" /> Epistemological Paradigm
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PARADIGM_LIST.map((p) => {
            const active = p.id === paradigm;
            return (
              <button
                key={p.id}
                onClick={() => selectParadigm(p.id)}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  active
                    ? "bg-teal-900/20 border-teal-500"
                    : "bg-slate-950/50 border-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium text-sm">{p.label}</span>
                  {active && <Check size={15} className="text-teal-400" />}
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{p.summary}</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {p.kappaAppropriate ? (
                    <span className="text-teal-400">κ appropriate</span>
                  ) : (
                    <span className="text-amber-400">κ optional</span>
                  )}
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-500">
                    {p.qualityCriteria.length} criteria
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Framework selection */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
          <BookOpen size={18} className="text-teal-400" /> Analytical Framework
        </h3>
        <p className="text-slate-400 text-xs mb-4">
          Frameworks marked <span className="text-teal-400">recommended</span> suit
          the {activeParadigm.label.toLowerCase()} paradigm.
        </p>
        <div className="space-y-2">
          {FRAMEWORK_LIST.map((f) => {
            const active = f.id === framework;
            const recommended = f.suitsParadigms.includes(paradigm);
            return (
              <button
                key={f.id}
                onClick={() => setFramework(f.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  active
                    ? "bg-teal-900/20 border-teal-500"
                    : recommended
                    ? "bg-slate-950/50 border-slate-700 hover:border-slate-500"
                    : "bg-slate-950/50 border-slate-800 hover:border-slate-600 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-white font-medium text-sm">{f.label}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {recommended && (
                      <span className="text-xs text-teal-400">recommended</span>
                    )}
                    {active && <Check size={15} className="text-teal-400" />}
                  </div>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{f.summary}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected framework phases preview */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <BookOpen size={18} className="text-teal-400" />
          {activeFramework.label} — phases
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {activeFramework.phases.map((phase, i) => (
            <div
              key={i}
              className="flex items-start gap-2 bg-slate-950/50 border border-slate-800 rounded-lg p-3"
            >
              <Check size={14} className="text-teal-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-200 text-xs font-medium">{phase.name}</p>
                <p className="text-slate-500 text-xs">{phase.description}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          The framework&apos;s prompt template will be loaded into the configurator
          where you can inspect and modify it before running.
        </p>
      </section>

      {/* Continue */}
      <div className="bg-gradient-to-r from-navy-900 to-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm">
          <p className="text-white font-semibold">
            {files.length} document{files.length === 1 ? "" : "s"} ·{" "}
            {activeParadigm.label} · {activeFramework.label}
          </p>
          <p className="text-slate-400">
            {activeParadigm.kappaAppropriate
              ? "Cohen's κ will be foregrounded in the results."
              : "Trustworthiness criteria will be foregrounded; κ shown as supplementary."}
          </p>
        </div>
        <button
          onClick={() => onComplete({ paradigm, framework })}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-teal-900/20 whitespace-nowrap"
        >
          Continue → Configure <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
