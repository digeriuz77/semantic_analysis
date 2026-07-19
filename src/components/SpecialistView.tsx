"use client";

import { SpecialistResult } from "@/types";
import { ArrowLeft, Award, BookOpen, Lightbulb, AlertCircle } from "lucide-react";

interface SpecialistViewProps {
  result: SpecialistResult;
  onBack: () => void;
}

const QUALITY_COLORS = {
  Emerging: "text-red-400 border-red-900 bg-red-900/20",
  Developing: "text-yellow-400 border-yellow-900 bg-yellow-900/20",
  Proficient: "text-blue-400 border-blue-900 bg-blue-900/20",
  Exemplary: "text-teal-400 border-teal-900 bg-teal-900/20",
};

export function SpecialistView({ result, onBack }: SpecialistViewProps) {
  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy-900 to-slate-900 p-8 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="text-teal-400" />
            <span className="text-teal-400 font-mono text-sm tracking-wider uppercase">
              Schön Double Loop Reflection Analysis
            </span>
          </div>
          <h2 className="text-3xl font-bold text-white">Teaching Reflection Quality</h2>
        </div>

        <div className="p-8 space-y-8">
          {/* Score Card */}
          <div className={`rounded-xl border-2 p-6 flex flex-col md:flex-row items-center justify-between gap-6 ${QUALITY_COLORS[result.reflectionQuality]}`}>
            <div>
              <p className="text-sm opacity-80 uppercase tracking-wide font-semibold">Overall Assessment</p>
              <h3 className="text-4xl font-bold mt-1">{result.reflectionQuality}</h3>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm opacity-80 mb-1">Quality Score</p>
              <div className="text-5xl font-bold font-mono">{result.score}/100</div>
            </div>
          </div>

          {/* Loop Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="text-blue-400" size={20} />
                <h4 className="text-white font-semibold">Detected Loop Type</h4>
              </div>
              <p className="text-2xl font-bold text-blue-400 mb-2">{result.loopType}</p>
              <p className="text-slate-400 text-sm">
                {result.loopType === "Double Loop"
                  ? "The text demonstrates reflection on underlying assumptions, values, and governing variables."
                  : result.loopType === "Single Loop"
                  ? "The text focuses primarily on strategies and actions to correct errors without questioning underlying goals."
                  : "The text contains a mix of instrumental problem-solving and deeper questioning of assumptions."}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="text-gold-400" size={20} />
                <h4 className="text-white font-semibold">Key Strengths</h4>
              </div>
              <ul className="space-y-2">
                {result.score > 80 && <li className="text-slate-300 text-sm">• Deep critical self-awareness</li>}
                {result.score > 60 && <li className="text-slate-300 text-sm">• Evidence of contextual analysis</li>}
                <li className="text-slate-300 text-sm">• Clear articulation of teaching experiences</li>
                {result.loopType !== "Single Loop" && <li className="text-slate-300 text-sm">• Questioning of established norms</li>}
              </ul>
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-teal-400" /> Detailed Analysis
            </h4>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
              {result.analysis}
            </p>
          </div>

          {/* Recommendations */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Lightbulb size={18} className="text-gold-400" /> Recommendations for Improvement
            </h4>
            <div className="space-y-3">
              {result.recommendations.map((rec, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center text-xs font-bold mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-slate-300 text-sm pt-0.5">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}