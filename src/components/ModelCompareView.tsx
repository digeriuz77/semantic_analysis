"use client";

import { useState } from "react";
import type { LlmProvider, ModelComparisonResult } from "@/types";
import { KAPPA_BAND_COLOR, KAPPA_BAND_LABEL } from "@/lib/kappa";
import { PROVIDER_LABEL } from "@/lib/providers";
import { ArrowLeft, GitCompare, Trophy, AlertTriangle, Loader2 } from "lucide-react";

interface ModelCompareViewProps {
  result: ModelComparisonResult | null;
  isRunning: boolean;
  progress: number;
  providers: LlmProvider[];
  onRun: (specs: { provider: LlmProvider; model: string }[]) => void;
  onBack: () => void;
}

const DEFAULT_MODELS: Partial<Record<LlmProvider, string>> = {
  fireworks: "accounts/fireworks/models/llama-v3-70b-instruct",
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-20241022",
  gemini: "gemini-1.5-pro",
  openrouter: "openai/gpt-4o",
};

export function ModelCompareView({
  result,
  isRunning,
  progress,
  providers,
  onRun,
  onBack,
}: ModelCompareViewProps) {
  const [selected, setSelected] = useState<Record<LlmProvider, boolean>>(
    () =>
      Object.fromEntries(
        providers.map((p) => [p, true])
      ) as Record<LlmProvider, boolean>
  );
  const [models, setModels] = useState<Record<LlmProvider, string>>(
    () =>
      Object.fromEntries(
        providers.map((p) => [p, DEFAULT_MODELS[p] ?? ""])
      ) as Record<LlmProvider, string>
  );

  const availableProviders = providers.length > 0 ? providers : (["fireworks"] as LlmProvider[]);
  const selectedSpecs = availableProviders
    .filter((p) => selected[p])
    .map((p) => ({ provider: p, model: models[p] || DEFAULT_MODELS[p] || p }));

  const handleRun = () => {
    if (selectedSpecs.length >= 2) onRun(selectedSpecs);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft size={16} /> Back to results
      </button>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <GitCompare className="text-teal-400" /> Cross-Model Comparison
        </h2>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          Run the same corpus through multiple models simultaneously. Themes
          stable across architectures receive higher confidence. This mirrors
          the reliability paper&apos;s head-to-head evaluation (κ &gt; 0.80 =
          almost perfect agreement).
        </p>

        <div className="mt-6 space-y-3">
          {availableProviders.map((p) => (
            <div
              key={p}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selected[p]
                  ? "bg-slate-800/70 border-slate-600"
                  : "bg-slate-900/50 border-slate-800"
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selected[p]}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [p]: e.target.checked }))
                  }
                  className="w-4 h-4 accent-teal-500 flex-shrink-0"
                />
                <span className="text-slate-200 text-sm font-medium w-32 flex-shrink-0">
                  {PROVIDER_LABEL[p]}
                </span>
                <input
                  type="text"
                  value={models[p] ?? ""}
                  onChange={(e) =>
                    setModels((m) => ({ ...m, [p]: e.target.value }))
                  }
                  placeholder={DEFAULT_MODELS[p]}
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs font-mono focus:border-teal-500 outline-none"
                />
              </label>
            </div>
          ))}
        </div>

        {availableProviders.length < 2 && (
          <p className="text-xs text-amber-400/80 mt-4 flex items-center gap-1">
            <AlertTriangle size={12} />
            Configure at least 2 providers in .env.local to enable a meaningful
            cross-model comparison.
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={selectedSpecs.length < 2 || isRunning}
          className="mt-5 flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-teal-900/20"
        >
          {isRunning ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Comparing… {progress}%
            </>
          ) : (
            <>
              <GitCompare size={16} /> Compare {selectedSpecs.length} Models
            </>
          )}
        </button>
      </div>

      {result && !isRunning && <ComparisonTable result={result} />}
    </div>
  );
}

function ComparisonTable({ result }: { result: ModelComparisonResult }) {
  const { entries } = result;
  if (entries.length === 0) return null;

  const valid = entries.filter((e) => !e.error && e.meanKappa !== null);
  const best = valid.length > 0
    ? valid.reduce((a, b) => ((b.meanKappa ?? 0) > (a.meanKappa ?? 0) ? b : a))
    : null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-navy-900 to-slate-900 p-5 border-b border-slate-800">
        <h3 className="text-white font-semibold">
          Reliability Comparison — {result.fileName}
        </h3>
        <p className="text-slate-400 text-xs mt-1">
          {entries[0]?.runCount ?? 0} runs per model · seeds{" "}
          {result.config.seeds.join(", ")} · T={result.config.temperature}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase tracking-wide border-b border-slate-800">
              <th className="text-left px-4 py-3 font-medium">Model</th>
              <th className="text-center px-4 py-3 font-medium">κ (mean)</th>
              <th className="text-center px-4 py-3 font-medium">κ band</th>
              <th className="text-center px-4 py-3 font-medium">Cosine</th>
              <th className="text-center px-4 py-3 font-medium">Consensus</th>
              <th className="text-center px-4 py-3 font-medium">High / Mod.</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const isBest = best && e.provider === best.provider && e.model === best.model;
              const bandColor = e.meanKappa !== null ? KAPPA_BAND_COLOR[e.kappaBand] : "#64748b";
              return (
                <tr
                  key={i}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isBest && <Trophy size={14} className="text-gold-400 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-slate-200 font-medium truncate">
                          {PROVIDER_LABEL[e.provider]}
                        </p>
                        <p className="text-slate-500 text-xs font-mono truncate">{e.model}</p>
                      </div>
                    </div>
                    {e.error && (
                      <p className="text-red-400 text-xs mt-1">⚠ {e.error}</p>
                    )}
                    {e.demo && (
                      <p className="text-amber-400/70 text-xs mt-1">demo mode</p>
                    )}
                  </td>
                  <td className="text-center px-4 py-3 font-mono text-slate-200">
                    {e.meanKappa !== null ? e.meanKappa.toFixed(3) : "—"}
                  </td>
                  <td className="text-center px-4 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full border whitespace-nowrap"
                      style={{
                        color: bandColor,
                        borderColor: bandColor,
                        backgroundColor: `${bandColor}22`,
                      }}
                    >
                      {KAPPA_BAND_LABEL[e.kappaBand]}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3 font-mono text-slate-200">
                    {e.cosinePercent !== null ? `${e.cosinePercent}%` : "—"}
                  </td>
                  <td className="text-center px-4 py-3 font-mono text-slate-200">
                    {e.consensusCount}
                  </td>
                  <td className="text-center px-4 py-3 font-mono text-xs">
                    <span className="text-teal-400">{e.highConfidenceCount}</span>
                    <span className="text-slate-600"> / </span>
                    <span className="text-amber-400">{e.moderateConfidenceCount}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-slate-950/50 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          κ follows Landis &amp; Koch (1977): &gt;0.80 almost perfect, 0.61–0.80
          substantial, 0.41–0.60 moderate. Cosine % = mean run-centroid semantic
          similarity. Cross-model-stable themes (appearing across providers)
          warrant the highest researcher confidence.
        </p>
      </div>
    </div>
  );
}
