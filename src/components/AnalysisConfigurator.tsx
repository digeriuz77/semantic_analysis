"use client";

import { useEffect, useState } from "react";
import type { LlmProvider, RunConfig } from "@/types";
import {
  PROVIDER_DEFAULT_MODEL,
  PROVIDER_LABEL,
  PROVIDER_SUPPORTS_SEED,
} from "@/lib/providers";
import { DEFAULT_THEMATIC_PROMPT, renderPrompt } from "@/lib/prompts";
import { FileText, Play, Sliders, Info, Wand2, ChevronDown } from "lucide-react";

export const DEFAULT_SEEDS = [42, 123, 456, 789, 1011, 1213];
export const DEFAULT_PROVIDER: LlmProvider = "fireworks";

export function defaultConfig(): RunConfig {
  return {
    seeds: [...DEFAULT_SEEDS],
    temperature: 0.7,
    model: PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER],
    provider: DEFAULT_PROVIDER,
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

interface ProvidersResponse {
  providers: LlmProvider[];
  demoMode: boolean;
}

export function AnalysisConfigurator({
  files,
  initialConfig,
  onRun,
  onBack,
}: AnalysisConfiguratorProps) {
  const [config, setConfig] = useState<RunConfig>(initialConfig);
  const [seedsText, setSeedsText] = useState(initialConfig.seeds.join(", "));
  const [availableProviders, setAvailableProviders] = useState<LlmProvider[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data: ProvidersResponse) => {
        setAvailableProviders(data.providers);
        setDemoMode(data.demoMode);
      })
      .catch(() => setDemoMode(true));
  }, []);

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

  const selectProvider = (provider: LlmProvider) => {
    update("provider", provider);
    update("model", PROVIDER_DEFAULT_MODEL[provider]);
  };

  const totalRuns = config.seeds.length * files.length;

  const promptPreview = renderPrompt(
    config.promptTemplate?.trim() ? config.promptTemplate : DEFAULT_THEMATIC_PROMPT,
    42,
    "[your document text appears here…]"
  ).slice(0, 400);

  const designLabel =
    config.paradigm && config.framework
      ? `${config.paradigm.replace("_", " ")} · ${config.framework.replace("_", " ")}`
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="text-slate-400 hover:text-white transition-colors text-sm"
      >
        ← Back to research design
      </button>

      {designLabel && (
        <div className="text-xs text-slate-500 -mt-2">
          Research design: <span className="text-teal-400">{designLabel}</span>
        </div>
      )}

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

        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            LLM Provider
          </label>
          <div className="flex flex-wrap gap-2">
            {(availableProviders.length > 0 ? availableProviders : [DEFAULT_PROVIDER]).map(
              (p) => {
                const disabled = demoMode && !availableProviders.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => selectProvider(p)}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      config.provider === p
                        ? "bg-teal-600 border-teal-500 text-white"
                        : disabled
                        ? "bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                    }`}
                  >
                    {PROVIDER_LABEL[p]}
                  </button>
                );
              }
            )}
          </div>
          {demoMode && (
            <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-1">
              <Info size={12} />
              No API keys configured — running in demo mode. Add a key in{" "}
              <code className="text-amber-300">.env.local</code> to enable real
              models.
            </p>
          )}
          {availableProviders.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              {PROVIDER_SUPPORTS_SEED[config.provider]
                ? "This provider supports seed-based reproducibility."
                : "This provider does NOT support seeds — reproducibility relies on temperature control only."}
            </p>
          )}
        </div>

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

          {/* Adaptive mode toggle */}
          <label className="flex items-center gap-2 mt-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={config.adaptive ?? false}
              onChange={(e) => update("adaptive", e.target.checked)}
              className="w-4 h-4 accent-teal-500 flex-shrink-0"
            />
            <div>
              <span className="text-slate-200 text-sm font-medium">
                Adaptive mode (early stop on saturation)
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Runs seeds sequentially and stops when two consecutive runs add
                no new themes — saves cost once themes stabilise.
              </p>
            </div>
          </label>
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

        {/* Custom prompt */}
        <div className="border-t border-slate-800 pt-5">
          <button
            onClick={() => setShowPromptEditor((s) => !s)}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            <Wand2 size={16} className="text-teal-400" />
            Custom Prompt
            <ChevronDown
              size={14}
              className={`transition-transform ${showPromptEditor ? "rotate-180" : ""}`}
            />
          </button>
          {showPromptEditor && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-500">
                Use <code className="text-teal-400">{`{seed}`}</code> and{" "}
                <code className="text-teal-400">{`{text_chunk}`}</code> for
                per-run substitution. Leave empty to use the default Braun &amp;
                Clarke reflexive TA prompt.
              </p>
              <textarea
                value={config.promptTemplate ?? ""}
                onChange={(e) => update("promptTemplate", e.target.value || undefined)}
                placeholder={DEFAULT_THEMATIC_PROMPT}
                rows={8}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono focus:border-teal-500 outline-none resize-y"
              />
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <p className="text-xs text-slate-600 mb-2 font-mono">
                  PREVIEW (seed=42)
                </p>
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">
                  {promptPreview}
                  {promptPreview.length >= 400 ? "…" : ""}
                </pre>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Cost note + run */}
      <div className="bg-gradient-to-r from-navy-900 to-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-teal-400 mt-0.5" />
          <div>
            <p className="text-white font-semibold">
              {totalRuns} total LLM run{totalRuns === 1 ? "" : "s"}
              {!demoMode && ` via ${PROVIDER_LABEL[config.provider]}`}
            </p>
            <p className="text-slate-400 text-sm">
              {demoMode
                ? "Demo mode active — themes are deterministic mock data."
                : "Each seed produces one independent run for reliability measurement."}
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
