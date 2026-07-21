"use client";

import { useState } from "react";
import type {
  ConsensusTheme,
  EnsembleResult,
  KappaBand,
  Theme,
} from "@/types";
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

type Tab = "overview" | "reliability" | "consensus" | "runs";
const CHART_COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#10b981"];

export function EnsembleDashboard({ results, onReset }: EnsembleDashboardProps) {
  const [activeFile, setActiveFile] = useState(0);
  const [tab, setTab] = useState<Tab>("reliability");
  const result = results[activeFile];

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
        </div>

        {tab === "reliability" && <ReliabilityTab result={result} />}
        {tab === "consensus" && <ConsensusTab result={result} />}
        {tab === "overview" && <OverviewTab result={result} />}
        {tab === "runs" && <RunsTab result={result} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReliabilityTab({ result }: { result: EnsembleResult }) {
  const { kappa, cosine, embeddingBackend, runCount } = result.reliability;

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricCard title="Cohen's Kappa (κ)">
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

      <p className="text-xs text-slate-500">
        Embedding backend:{" "}
        <span className="text-slate-300 font-mono">{embeddingBackend}</span>. κ
        uses theme presence/absence (Landis &amp; Koch bands); cosine uses
        run-centroid similarity over theme embeddings.
      </p>
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

function ConsensusTab({ result }: { result: EnsembleResult }) {
  const themes: ConsensusTheme[] = result.reliability.consensus.themes;
  const high = themes.filter((t) => t.tier === "high");
  const moderate = themes.filter((t) => t.tier === "moderate");

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
      <ThemeGroup
        title="High confidence"
        subtitle={`Appears in ≥83% of runs (${result.reliability.runCount})`}
        themes={high}
      />
      <ThemeGroup
        title="Moderate confidence"
        subtitle={`Appears in 50–66% of runs — warrants researcher review`}
        themes={moderate}
      />
    </div>
  );
}

function ThemeGroup({
  title,
  subtitle,
  themes,
}: {
  title: string;
  subtitle: string;
  themes: ConsensusTheme[];
}) {
  if (themes.length === 0) return null;
  return (
    <div>
      <div className="mb-3">
        <h4 className="text-white font-semibold">{title}</h4>
        <p className="text-slate-500 text-xs">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {themes.map((theme, idx) => (
          <ConsensusCard key={idx} theme={theme} />
        ))}
      </div>
    </div>
  );
}

function ConsensusCard({ theme }: { theme: ConsensusTheme }) {
  const color = tierColor(theme.tier);
  return (
    <div
      className="bg-slate-800/50 border rounded-lg p-5"
      style={{ borderColor: `${color}55` }}
    >
      <div className="flex justify-between items-start mb-3 gap-3">
        <h3 className="text-lg font-bold text-white">{theme.label}</h3>
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
      {theme.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {theme.keywords.map((kw, i) => (
            <span
              key={i}
              className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
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
  return (
    <div className="space-y-4">
      {result.runs.map((run, i) => (
        <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono text-slate-500">Run {i + 1}</span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs font-mono text-teal-400">seed {run.seed}</span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">
              {run.themes.length} theme{run.themes.length === 1 ? "" : "s"}
            </span>
          </div>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
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
