"use client";

import { useState } from "react";
import type { SynthesizedReport } from "@/types";
import {
  FileText,
  Download,
  Copy,
  Check,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Users,
  Layers,
  ArrowLeft,
  Calendar,
} from "lucide-react";

interface SynthesizedReportViewProps {
  report: SynthesizedReport;
  onBack?: () => void;
}

export function SynthesizedReportView({
  report,
  onBack,
}: SynthesizedReportViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(report.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([report.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Synthesized_Impact_Report_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Back to file results"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="text-teal-400" size={22} />
              {report.title}
            </h2>
            <p className="text-xs text-slate-400">
              Synthesized across {report.analyzedFiles.length} document sources ·{" "}
              {new Date(report.generatedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700"
          >
            {copied ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy Markdown"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Download size={14} /> Download (.md)
          </button>
        </div>
      </div>

      {/* Primary Research Question */}
      {report.researchQuestion && (
        <div className="bg-teal-950/20 border border-teal-800/60 rounded-xl p-5">
          <div className="flex items-center gap-2 text-teal-300 font-semibold text-sm mb-1">
            <HelpCircle size={16} /> Primary Research Question
          </div>
          <p className="text-slate-200 text-base font-medium italic pl-6 border-l-2 border-teal-500/60 my-2">
            &ldquo;{report.researchQuestion}&rdquo;
          </p>
        </div>
      )}

      {/* Executive Summary & Headline Finding */}
      <div className="bg-gradient-to-br from-slate-900 to-navy-950 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <TrendingUp size={16} /> Executive Summary · Headline Finding
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
          <p className="text-white text-base md:text-lg font-semibold leading-relaxed">
            {report.executiveSummary.headlineFinding}
          </p>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          {report.executiveSummary.narrative}
        </p>
      </div>

      {/* Triangulated Cross-Role Matrix */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="text-teal-400" size={18} /> Triangulated Cross-Role Matrix
          </h3>
          <span className="text-xs text-slate-500">Cross-stakeholder evidence</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                <th className="p-3 font-semibold w-1/4">Theme</th>
                <th className="p-3 font-semibold w-1/4">Teacher Evidence</th>
                <th className="p-3 font-semibold w-1/4">Coach Evidence</th>
                <th className="p-3 font-semibold w-1/4">Artifact &amp; Classroom Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {report.triangulationMatrix.map((row, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 align-top">
                    <p className="font-semibold text-teal-300 text-sm">{row.theme}</p>
                    <p className="text-slate-400 text-xs mt-1">{row.description}</p>
                  </td>
                  <td className="p-3 align-top leading-relaxed text-slate-300">
                    {row.teacherEvidence}
                  </td>
                  <td className="p-3 align-top leading-relaxed text-slate-300">
                    {row.coachEvidence}
                  </td>
                  <td className="p-3 align-top leading-relaxed text-slate-300">
                    {row.artifactEvidence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Voice (Attributed Quotes) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="text-teal-400" size={18} /> Selected Participant Voice
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.selectedVoice.map((v, i) => (
            <div
              key={i}
              className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between"
            >
              <p className="text-slate-200 text-sm italic leading-relaxed mb-3">
                &ldquo;{v.quote}&rdquo;
              </p>
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2 gap-2">
                <span className="font-semibold text-teal-300">
                  — {v.speaker} <span className="text-slate-500 font-normal">({v.role})</span>
                </span>
                {v.date && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Calendar size={12} /> {v.date}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation Strands */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {report.strands.map((strand, i) => (
          <div
            key={i}
            className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3"
          >
            <h4 className="text-sm font-bold text-white text-teal-400">
              {strand.title}
            </h4>
            <p className="text-xs text-slate-400">{strand.summary}</p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {strand.keyPoints.map((pt, j) => (
                <li key={j} className="flex items-start gap-1.5">
                  <span className="text-teal-500 mt-0.5">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Strengths and Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <ShieldCheck size={18} /> Evidence-Backed Strengths
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <AlertTriangle size={18} /> Risks to Impact &amp; Emerging Bottlenecks
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {report.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">!</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Plan / Priority Recommendations */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Priority Action Plan (Next Phase)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                <th className="p-3 font-semibold w-1/3">Priority Action</th>
                <th className="p-3 font-semibold w-1/2">Why It Matters</th>
                <th className="p-3 font-semibold w-1/6">Lead Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {report.priorityActions.map((act, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 font-semibold text-white align-top">
                    {act.action}
                  </td>
                  <td className="p-3 text-slate-300 align-top leading-relaxed">
                    {act.whyItMatters}
                  </td>
                  <td className="p-3 text-teal-400 font-medium align-top">
                    {act.leadRole}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
