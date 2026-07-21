"use client";

import { useState } from "react";
import type { LlmProvider, RunConfig } from "@/types";
import { FileText, Play, Sliders, Info } from "lucide-react";

export const DEFAULT_SEEDS = [42, 123, 456, 789, 1011, 1213];
export const DEFAULT_MODEL = "accounts/fireworks/models/llama-v3-70b-instruct";

export function defaultConfig(): RunConfig {
  return {
    seeds: [...DEFAULT_SEEDS],
    temperature: 0.7,
    model: DEFAULT_MODEL,
    provider: "fireworks" as LlmProvider,
    cosineThreshold: 0.7,
    minOccurrenceRatio: 0.5,
  };
}

interface AnalysisConfiguratorProps {
  files: File[];
  initialConfig: RunConfig;
  onRun: (config: RunConfig) => void;
  onBack: () => void;
}

export function AnalysisConfigurator({
  files,
  initialConfig,
  onRun,
  onBack,
}: AnalysisConfiguratorProps) {
  const [config, setConfig] = useState<RunConfig>(initialConfig);
  const [seedsText, setSeedsText] = useState(initialConfig.seeds.join(", "));

  const update = <K extends keyof RunConfig>(key: K, value: RunConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const commitSeeds = (text: string) => {
    setSeedsText(text);
    const parsed = text
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .slice(0, 6);
    update("seeds", parsed.length > 0 ? parsed : [...DEFAULT_SEEDS]);
  };

  const applyPreset = (count: number) => {
    const seeds = DEFAULT_SEEDS.slice(0, count);
    setSeedsText(seeds.join(", "));
    update("seeds", seeds);
  };

  const totalRuns = config.seeds.length * files.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="text-slate-400 hover:text-white transition-colors text-sm"
      >
        ← Back to upload
      </button>

      {/* Files */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <FileText size={18} className="text-teal-400" />
          Documents ({files.length})
        </h3>
        <div className="space-y-2">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-lg p-3"
            >
              <FileText size={16} className="text-teal-400" />
              <span className="text-slate-200 text-sm truncate flex-1">
                {file.name}
              </span>
              <span className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-6">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Sliders size={18} className="text-teal-400" />
          Ensemble Configuration
        </h3>

        {/* Seeds */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Seeds (one independent run each, max 6)
          </label>
          <input
            type="text"
            value={seedsText}
            onChange={(e) => commitSeeds(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none"
            placeholder="42, 123, 456..."
          />
          <div className="flex gap-2 mt-2">
            {[1, 3, 6].map((n) => (
              <button
                key={n}
                onClick={() => applyPreset(n)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  config.seeds.length === n
                    ? "bg-teal-600 border-teal-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {n === 1 ? "Quick (1 run)" : `${n} runs`}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Fixed seeds enable reproducible variation. 6 runs yields 15 pairwise
            comparisons (~41% lower variance than 3).
          </p>
        </div>

        {/* Temperature */}
        <SliderRow
          label="Temperature"
          value={config.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => update("temperature", v)}
          hint="Lower = deterministic; higher = creative exploration."
        />

        <SliderRow
          label="Consensus cosine threshold"
          value={config.cosineThreshold ?? 0.7}
          min={0.5}
          max={0.95}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => update("cosineThreshold", v)}
          hint="Themes with cosine similarity above this are treated as equivalent."
        />

        <SliderRow
          label="Min occurrence ratio"
          value={config.minOccurrenceRatio ?? 0.5}
          min={0.34}
          max={0.84}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update("minOccurrenceRatio", v)}
          hint="Fraction of runs a theme must appear in to become a consensus theme."
        />

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Model
          </label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => update("model", e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-teal-500 outline-none"
          />
        </div>
      </section>

      {/* Cost note + run */}
      <div className="bg-gradient-to-r from-navy-900 to-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-teal-400 mt-0.5" />
          <div>
            <p className="text-white font-semibold">
              {totalRuns} total LLM run{totalRuns === 1 ? "" : "s"}
            </p>
            <p className="text-slate-400 text-sm">
              Without an API key the app runs in demo mode (deterministic mock
              themes) so the reliability dashboard stays explorable.
            </p>
          </div>
        </div>
        <button
          onClick={() => onRun(config)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-teal-900/20 whitespace-nowrap"
        >
          <Play size={16} /> Run Rigorous Analysis
        </button>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <span className="text-teal-400 font-mono text-sm">
          {format ? format(value) : value.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-500"
      />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
