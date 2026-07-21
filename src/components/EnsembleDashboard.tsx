"use client";

import { useState } from "react";
import type {
  ConsensusTheme,
  EnsembleResult,
  KappaBand,
  SaturationPoint,
  Theme,
  ThemeAnnotation,
} from "@/types";
import type { Paradigm } from "@/lib/paradigms";
import { ThemeLineageView } from "@/components/ThemeLineageView";
import { useAnnotations } from "@/lib/useAnnotations";
import { PARADIGMS } from "@/lib/paradigms";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  FileText,
  TrendingUp,
  Activity,
  ShieldCheck,
  Layers,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Workflow,
  Flag,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  KAPPA_BAND_COLOR,
  KAPPA_BAND_DESCRIPTION,
  KAPPA_BAND_LABEL,
  cosinePercent,
  tierColor,
} from "@/lib/kappa";

interface EnsembleDashboardProps {
  results: EnsembleResult[];
  onReset: () => void;
}

type Tab = "overview" | "reliability" | "consensus" | "runs" | "pipeline";
const CHART_COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#10b981"];

export function EnsembleDashboard({ results, onReset }: EnsembleDashboardProps) {
  const [activeFile, setActiveFile] = useState(0);
  const [tab, setTab] = useState<Tab>("reliability");
  const [selectedThemeIdx, setSelectedThemeIdx] = useState<number | null>(null);
  const result = results[activeFile];
  const { annotations, annotate } = useAnnotations(result.id);

  // Lineage drill-down view takes over the panel.
  if (selectedThemeIdx !== null) {
    const theme = result.reliability.consensus.themes[selectedThemeIdx];
    if (theme) {
      return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <ThemeLineageView
            theme={theme}
            themeIndex={selectedThemeIdx}
            runSeeds={result.runs.map((r) => r.seed)}
            annotation={annotations[theme.label]}
            onAnnotate={annotate}
            onBack={() => setSelectedThemeIdx(null)}
          />
        </div>
      );
    }
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* File selector */}
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 gap-4">
        <div className="flex gap-2 overflow-x-auto">
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setActiveFile(i)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                i === activeFile
                  ? "bg-teal-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <FileText size={14} className="inline mr-2" />
              {r.fileName}
            </button>
          ))}
        </div>
        <button
          onClick={onReset}
          className="text-sm text-slate-500 hover:text-white transition-colors whitespace-nowrap"
        >
          New Analysis
        </button>
      </div>

      {result.demo && (
        <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
          <p className="text-amber-200 text-sm">
            <span className="font-semibold">Demo mode.</span> No LLM API key is
            configured, so themes were generated deterministically from corpus
            keywords. Add an API key to run real thematic analysis. The
            reliability metrics below are illustrative.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Words" value={result.stats.totalWords.toLocaleString()} icon={FileText} color="text-blue-400" />
        <StatCard title="Unique Vocabulary" value={result.stats.uniqueWords.toLocaleString()} icon={Activity} color="text-teal-400" />
        <StatCard title="Sentences" value={result.stats.sentences.toLocaleString()} icon={TrendingUp} color="text-purple-400" />
        <StatCard title="Runs" value={`${result.runs.length}`} icon={Layers} color="text-gold-400" />
      </div>

      {/* Tabs */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap border-b border-slate-800 mb-6 gap-1">
          <TabButton active={tab === "reliability"} onClick={() => setTab("reliability")}>
            <ShieldCheck size={15} className="inline mr-1" /> Reliability
          </TabButton>
          <TabButton active={tab === "consensus"} onClick={() => setTab("consensus")}>
            <Layers size={15} className="inline mr-1" /> Consensus Themes
          </TabButton>
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={tab === "runs"} onClick={() => setTab("runs")}>
            Per-Run
          </TabButton>
          <TabButton active={tab === "pipeline"} onClick={() => setTab("pipeline")}>
            <Workflow size={15} className="inline mr-1" /> Pipeline Trace
          </TabButton>
        </div>

        {tab === "reliability" && <ReliabilityTab result={result} />}
        {tab === "consensus" && (
          <ConsensusTab
            result={result}
            annotations={annotations}
            onSelectTheme={setSelectedThemeIdx}
          />
        )}
        {tab === "overview" && <OverviewTab result={result} />}
        {tab === "runs" && <RunsTab result={result} />}
        {tab === "pipeline" && <PipelineTab result={result} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReliabilityTab({ result }: { result: EnsembleResult }) {
  const { kappa, cosine, embeddingBackend, runCount, saturation } = result.reliability;
  const paradigmId = result.config.paradigm;
  const paradigm = paradigmId ? PARADIGMS[paradigmId] : null;
  const foregroundKappa = paradigm ? paradigm.foregroundKappa : true;

  if (runCount < 2) {
    return (
      <InfoBox>
        Reliability metrics require at least 2 runs. Re-run with more seeds to
        measure inter-run agreement.
      </InfoBox>
    );
  }

  return (
    <div className="space-y-6">
      {/* Paradigm-aware quality criteria (constructivist → trustworthiness first) */}
      {paradigm && !foregroundKappa && (
        <TrustworthinessCard paradigm={paradigm} hasKappa={Boolean(kappa)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricCard
          title={
            paradigm && !paradigm.kappaAppropriate
              ? "Cohen's Kappa (κ) — supplementary"
              : "Cohen's Kappa (κ)"
          }
        >
          {kappa ? (
            <KappaDisplay kappa={kappa} />
          ) : (
            <p className="text-slate-400 text-sm">
              Insufficient categorical overlap to compute κ across runs.
            </p>
          )}
        </MetricCard>

        <MetricCard title="Cosine Similarity">
          {cosine ? (
            <CosineDisplay cosine={cosine} />
          ) : (
            <p className="text-slate-400 text-sm">
              Not enough theme embeddings to compute semantic consistency.
            </p>
          )}
        </MetricCard>
      </div>

      {cosine?.matrix && <CosineHeatmap matrix={cosine.matrix} seeds={result.runs.map((r) => r.seed)} />}

      {saturation && saturation.length > 0 && (
        <SaturationCard points={saturation} runCount={runCount} />
      )}

      <p className="text-xs text-slate-500">
        Embedding backend:{" "}
        <span className="text-slate-300 font-mono">{embeddingBackend}</span>. κ
        uses theme presence/absence (Landis &amp; Koch bands); cosine uses
        run-centroid similarity over theme embeddings.
        {paradigm && !paradigm.kappaAppropriate && (
          <>
            {" "}
            <span className="text-amber-400/80">
              Note: κ is shown as supplementary — your {paradigm.label.toLowerCase()}{" "}
              paradigm foregrounds trustworthiness criteria above.
            </span>
          </>
        )}
      </p>
    </div>
  );
}

function TrustworthinessCard({
  paradigm,
  hasKappa,
}: {
  paradigm: Paradigm;
  hasKappa: boolean;
}) {
  return (
    <div className="bg-gradient-to-r from-teal-900/20 to-slate-900/20 border border-teal-700/40 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={18} className="text-teal-400" />
        <h4 className="text-white font-semibold">
          {paradigm.label} quality criteria
        </h4>
      </div>
      <p className="text-slate-400 text-xs mb-4 max-w-2xl">
        Your paradigm foregrounds these criteria over inter-rater κ. The
        pipeline trace, per-theme lineage, and annotations directly support
        dependability and confirmability.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {paradigm.qualityCriteria.map((c) => (
          <div key={c.id} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
            <p className="text-teal-300 text-sm font-medium">{c.name}</p>
            <p className="text-slate-500 text-xs mt-1">{c.description}</p>
          </div>
        ))}
      </div>
      {hasKappa && (
        <p className="text-xs text-slate-500 mt-3">
          κ is computed and shown below as supplementary information only.
        </p>
      )}
    </div>
  );
}

function SaturationCard({
  points,
  runCount,
}: {
  points: SaturationPoint[];
  runCount: number;
}) {
  const maxClasses = Math.max(...points.map((p) => p.distinctClasses), 1);
  const lastNew = points[points.length - 1]?.newClasses ?? 0;
  const plateaued = lastNew === 0 && runCount >= 3;
  const chartData = points.map((p) => ({
    name: `${p.runsIncluded}`,
    classes: p.distinctClasses,
    new: p.newClasses,
  }));

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h4 className="text-white font-semibold text-sm flex items-center gap-2">
          <TrendingUp size={16} className="text-teal-400" />
          Theoretical saturation curve
        </h4>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            plateaued
              ? "text-teal-400 border-teal-600 bg-teal-900/30"
              : "text-amber-400 border-amber-700 bg-amber-900/20"
          }`}
        >
          {plateaued
            ? "Saturation likely reached"
            : "New themes still emerging"}
        </span>
      </div>
      <p className="text-slate-500 text-xs mb-4 max-w-2xl">
        Distinct theme classes discovered as runs accumulate. Saturation is a
        process, not a fixed number — when additional runs add no new classes,
        the analysis has likely saturated.
      </p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} label={{ value: "runs", position: "insideBottom", dy: 12, fontSize: 10, fill: "#64748b" }} />
            <YAxis stroke="#64748b" fontSize={11} domain={[0, Math.ceil(maxClasses * 1.1)]} />
            <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc", fontSize: 12 }} />
            <Bar dataKey="classes" name="distinct classes" fill="#0d9488" radius={[3, 3, 0, 0]} />
            <Bar dataKey="new" name="new classes" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KappaDisplay({
  kappa,
}: {
  kappa: NonNullable<EnsembleResult["reliability"]["kappa"]>;
}) {
  const band = kappa.band as KappaBand;
  const color = KAPPA_BAND_COLOR[band];
  return (
    <div>
      <div className="flex items-end gap-4">
        <div className="text-5xl font-bold font-mono" style={{ color }}>
          {kappa.meanKappa.toFixed(3)}
        </div>
        <span
          className="mb-1 text-sm font-semibold px-3 py-1 rounded-full border"
          style={{
            color,
            borderColor: color,
            backgroundColor: `${color}22`,
          }}
        >
          {KAPPA_BAND_LABEL[band]}
        </span>
      </div>
      <p className="text-slate-400 text-sm mt-3">
        Range: {kappa.minKappa.toFixed(3)} – {kappa.maxKappa.toFixed(3)} across{" "}
        {kappa.pairwise.length} run pairs.{" "}
        <span className="text-slate-300">
          {KAPPA_BAND_DESCRIPTION[band]}
        </span>
      </p>
    </div>
  );
}

function CosineDisplay({
  cosine,
}: {
  cosine: NonNullable<EnsembleResult["reliability"]["cosine"]>;
}) {
  const pct = cosinePercent(cosine.meanCosine);
  const color = pct >= 90 ? "#0d9488" : pct >= 80 ? "#3b82f6" : "#f59e0b";
  return (
    <div>
      <div className="flex items-end gap-4">
        <div className="text-5xl font-bold font-mono" style={{ color }}>
          {pct}%
        </div>
        <span
          className="mb-1 text-sm font-semibold px-3 py-1 rounded-full border"
          style={{ color, borderColor: color, backgroundColor: `${color}22` }}
        >
          {pct >= 90 ? "High consistency" : pct >= 80 ? "Moderate" : "Low"}
        </span>
      </div>
      <p className="text-slate-400 text-sm mt-3">
        Mean run-centroid similarity. Range: {cosine.minCosine.toFixed(3)} –{" "}
        {cosine.maxCosine.toFixed(3)}.
      </p>
    </div>
  );
}

function CosineHeatmap({ matrix, seeds }: { matrix: number[][]; seeds: number[] }) {
  const n = matrix.length;
  const colorFor = (v: number) => {
    const t = Math.max(0, Math.min(1, v));
    const hue = 175 - t * 30; // teal -> green
    return `hsl(${hue}, 70%, ${20 + t * 45}%)`;
  };
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-6">
      <h4 className="text-white font-semibold mb-4 text-sm">
        Run-to-run similarity matrix
      </h4>
      <div className="overflow-x-auto">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `auto repeat(${n}, minmax(48px, 1fr))` }}
        >
          <div />
          {seeds.map((s, j) => (
            <div key={`h-${j}`} className="text-center text-xs text-slate-500 pb-1">
              #{j + 1}
            </div>
          ))}
          {matrix.map((row, i) => (
            <Row key={`r-${i}`} index={i} row={row} colorFor={colorFor} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
        <span>Low</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background:
              "linear-gradient(to right, hsl(175,70%,20%), hsl(145,70%,65%))",
          }}
        />
        <span>High</span>
      </div>
    </div>
  );
}

function Row({
  index,
  row,
  colorFor,
}: {
  index: number;
  row: number[];
  colorFor: (v: number) => string;
}) {
  return (
    <>
      <div className="text-right text-xs text-slate-500 pr-2 flex items-center justify-end">
        #{index + 1}
      </div>
      {row.map((v, j) => (
        <div
          key={`c-${index}-${j}`}
          className="aspect-square rounded text-center text-[10px] font-mono flex items-center justify-center text-white/80"
          style={{ backgroundColor: colorFor(v) }}
          title={`Run ${index + 1} ↔ Run ${j + 1}: ${v.toFixed(3)}`}
        >
          {v.toFixed(2)}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------

function ConsensusTab({
  result,
  annotations,
  onSelectTheme,
}: {
  result: EnsembleResult;
  annotations: Record<string, ThemeAnnotation>;
  onSelectTheme: (idx: number) => void;
}) {
  const themes: ConsensusTheme[] = result.reliability.consensus.themes;
  const allThemes = result.reliability.consensus.themes;
  const high = themes.filter((t) => t.tier === "high");
  const moderate = themes.filter((t) => t.tier === "moderate");

  const indexByLabel = (label: string) =>
    allThemes.findIndex((t) => t.label === label);

  if (themes.length === 0) {
    return (
      <InfoBox>
        No themes met the consensus threshold ({Math.round((result.config.minOccurrenceRatio ?? 0.5) * 100)}%
        of runs). Lower the threshold or add more runs.
      </InfoBox>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Click any theme to inspect its derivation lineage, evidence, and record a
        researcher annotation.
      </p>
      <ThemeGroup
        title="High confidence"
        subtitle={`Appears in ≥83% of runs (${result.reliability.runCount})`}
        themes={high}
        allThemes={allThemes}
        annotations={annotations}
        onSelectTheme={onSelectTheme}
      />
      <ThemeGroup
        title="Moderate confidence"
        subtitle={`Appears in 50–66% of runs — warrants researcher review`}
        themes={moderate}
        allThemes={allThemes}
        annotations={annotations}
        onSelectTheme={onSelectTheme}
      />
    </div>
  );
}

function ThemeGroup({
  title,
  subtitle,
  themes,
  allThemes,
  annotations,
  onSelectTheme,
}: {
  title: string;
  subtitle: string;
  themes: ConsensusTheme[];
  allThemes: ConsensusTheme[];
  annotations: Record<string, ThemeAnnotation>;
  onSelectTheme: (idx: number) => void;
}) {
  if (themes.length === 0) return null;
  return (
    <div>
      <div className="mb-3">
        <h4 className="text-white font-semibold">{title}</h4>
        <p className="text-slate-500 text-xs">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {themes.map((theme) => {
          const idx = allThemes.findIndex((t) => t.label === theme.label);
          return (
            <ConsensusCard
              key={theme.label}
              theme={theme}
              annotation={annotations[theme.label]}
              onClick={() => onSelectTheme(idx)}
            />
          );
        })}
      </div>
    </div>
  );
}

const ANNO_ICON: Record<ThemeAnnotation["status"], { Icon: LucideIcon; color: string; label: string }> = {
  accepted: { Icon: CheckCircle2, color: "#0d9488", label: "Accepted" },
  rejected: { Icon: XCircle, color: "#ef4444", label: "Rejected" },
  flagged: { Icon: Flag, color: "#f59e0b", label: "Flagged" },
};

function ConsensusCard({
  theme,
  annotation,
  onClick,
}: {
  theme: ConsensusTheme;
  annotation?: ThemeAnnotation;
  onClick: () => void;
}) {
  const color = tierColor(theme.tier);
  const anno = annotation ? ANNO_ICON[annotation.status] : null;
  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-slate-800/50 border rounded-lg p-5 hover:border-teal-500/60 hover:bg-slate-800 transition-colors cursor-pointer group"
      style={{ borderColor: `${color}55` }}
    >
      <div className="flex justify-between items-start mb-3 gap-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          {theme.label}
          <GitBranch size={14} className="text-slate-600 group-hover:text-teal-400 transition-colors" />
        </h3>
        <span
          className="text-xs px-2 py-1 rounded-full border whitespace-nowrap"
          style={{ color, borderColor: color, backgroundColor: `${color}22` }}
        >
          {theme.occurrence}/{theme.runCount} runs
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-3">{theme.description}</p>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${theme.consistency * 100}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {Math.round(theme.consistency * 100)}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        {theme.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {theme.keywords.slice(0, 4).map((kw, i) => (
              <span
                key={i}
                className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded"
              >
                {kw}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        {anno && (
          <span
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{ color: anno.color, borderColor: anno.color, backgroundColor: `${anno.color}22` }}
            title={annotation?.note}
          >
            <anno.Icon size={11} /> {anno.label}
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------

function OverviewTab({ result }: { result: EnsembleResult }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Top Word Frequency</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result.wordFrequency.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis dataKey="word" type="category" stroke="#94a3b8" fontSize={12} width={90} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {result.wordFrequency.slice(0, 10).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Sentiment (VADER)</h3>
        <div className="flex items-center justify-center h-64 gap-8">
          <SentimentRing label="Positive" value={result.sentiment.positive} color="#0d9488" />
          <SentimentRing label="Neutral" value={result.sentiment.neutral} color="#3b82f6" />
          <SentimentRing label="Negative" value={result.sentiment.negative} color="#f59e0b" />
        </div>
      </div>
    </div>
  );
}

function RunsTab({ result }: { result: EnsembleResult }) {
  const [openRaw, setOpenRaw] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      {result.runs.map((run, i) => {
        const prov = run.provenance;
        const status = prov?.status ?? "ok";
        const statusColor =
          status === "ok" ? "#0d9488" : status === "parse_failed" ? "#f59e0b" : "#ef4444";
        return (
          <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-mono text-slate-500">Run {i + 1}</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs font-mono text-teal-400">seed {run.seed}</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-slate-500">
                {run.themes.length} theme{run.themes.length === 1 ? "" : "s"}
              </span>
              {prov && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded border font-mono"
                  style={{ color: statusColor, borderColor: statusColor, backgroundColor: `${statusColor}22` }}
                >
                  {status}
                </span>
              )}
              {prov && prov.rawResponse && (
                <button
                  onClick={() => setOpenRaw(openRaw === i ? null : i)}
                  className="text-xs text-slate-500 hover:text-teal-400 ml-auto underline"
                >
                  {openRaw === i ? "hide raw output" : "show raw output"}
                </button>
              )}
            </div>

            {prov?.error && (
              <p className="text-red-400 text-xs mb-2 font-mono">{prov.error}</p>
            )}

            {run.themes.length === 0 ? (
              <p className="text-slate-600 text-sm italic">No themes extracted.</p>
            ) : (
              <div className="space-y-2">
                {run.themes.map((theme: Theme, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <CheckCircle2 size={14} className="text-teal-400 mt-1 flex-shrink-0" />
                    <div>
                      <span className="text-slate-200 text-sm font-medium">{theme.name}</span>
                      <span className="text-slate-500 text-xs"> — {theme.description}</span>
                      {theme.supportingQuotes && theme.supportingQuotes.length > 0 && (
                        <p className="text-slate-600 text-xs italic mt-0.5">
                          “{theme.supportingQuotes[0]}”
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {openRaw === i && prov && (
              <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">
                {prov.renderedPrompt && (
                  <div>
                    <p className="text-xs text-slate-600 font-mono mb-1">RENDERED PROMPT</p>
                    <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono bg-slate-900/50 rounded p-2 max-h-40 overflow-y-auto">
                      {prov.renderedPrompt.slice(0, 1200)}
                      {prov.renderedPrompt.length > 1200 ? "…" : ""}
                    </pre>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-600 font-mono mb-1">RAW RESPONSE</p>
                  <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono bg-slate-900/50 rounded p-2 max-h-60 overflow-y-auto">
                    {prov.rawResponse.slice(0, 3000)}
                    {prov.rawResponse.length > 3000 ? "…" : ""}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PipelineTab({ result }: { result: EnsembleResult }) {
  const t = result.pipelineTrace;
  if (!t) {
    return <InfoBox>Pipeline trace unavailable (older analysis format).</InfoBox>;
  }
  const rows: { label: string; value: string; hint?: string }[] = [
    { label: "Input size", value: `${t.inputChars.toLocaleString()} chars`, hint: "raw uploaded file" },
    { label: "After cleaning", value: `${t.cleanedChars.toLocaleString()} chars`, hint: "NLTK preprocessing applied" },
    { label: "Sent to LLM", value: `${t.chunkChars.toLocaleString()} chars`, hint: "truncated chunk per run" },
    { label: "Preprocessing", value: t.preprocessed ? "tokenize · lemmatize · stopwords" : "none" },
    { label: "Embedding backend", value: t.embeddingBackend, hint: "used for κ + cosine + evidence" },
    { label: "Cosine threshold", value: t.cosineThreshold.toFixed(2), hint: "theme-equivalence cutoff" },
    { label: "Min occurrence ratio", value: `${Math.round(t.minOccurrenceRatio * 100)}%`, hint: "consensus threshold" },
    { label: "Temperature", value: t.temperature.toFixed(1), hint: "LLM sampling randomness" },
    { label: "Seeds", value: t.seeds.join(", "), hint: `${t.seeds.length} independent runs` },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-white font-semibold mb-1">Pipeline Trace</h4>
        <p className="text-slate-400 text-xs max-w-2xl">
          Every transformation applied to your data, end to end. This is the
          reproducibility record — combined with the per-run provenance, it lets
          any reader trace exactly how each result was produced.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r, i) => (
          <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase tracking-wide">{r.label}</span>
            </div>
            <p className="text-slate-200 font-mono text-sm mt-1">{r.value}</p>
            {r.hint && <p className="text-xs text-slate-600 mt-1">{r.hint}</p>}
          </div>
        ))}
      </div>
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Manifest (for citation)</p>
        <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">{`fileName: ${result.fileName}
provider: ${result.config.provider}
model: ${result.config.model}
seeds: [${t.seeds.join(", ")}]
temperature: ${t.temperature}
cosineThreshold: ${t.cosineThreshold}
minOccurrenceRatio: ${t.minOccurrenceRatio}
embeddingBackend: ${t.embeddingBackend}
demoMode: ${result.demo}`}</pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: LucideIcon; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex justify-between items-start mb-3">
        <span className="text-slate-400 text-xs font-medium">{title}</span>
        <Icon size={18} className={color} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-teal-500 text-teal-400" : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-6">
      <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-wide mb-4">
        {title}
      </h4>
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-slate-950 border border-slate-800 rounded-lg p-6">
      <InfoCircle />
      <p className="text-slate-400 text-sm">{children}</p>
    </div>
  );
}

function InfoCircle() {
  return (
    <span className="flex-shrink-0 w-5 h-5 rounded-full border border-slate-600 text-slate-400 flex items-center justify-center text-xs">
      i
    </span>
  );
}

function SentimentRing({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle className="text-slate-800 stroke-current" strokeWidth="8" fill="transparent" r={radius} cx="50" cy="50" />
          <circle
            className="stroke-current transition-all duration-1000 ease-out"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
            style={{ stroke: color }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
          {Math.round(value)}%
        </div>
      </div>
      <span className="mt-2 text-xs text-slate-400">{label}</span>
    </div>
  );
}
