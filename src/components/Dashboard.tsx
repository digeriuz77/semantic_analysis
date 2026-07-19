"use client";

import { useState } from "react";
import { AnalysisResult } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FileText, TrendingUp, Activity, BrainCircuit, ChevronRight } from "lucide-react";

interface DashboardProps {
  results: AnalysisResult[];
  onRunSpecialist: () => void;
  onReset: () => void;
}

const COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#10b981"];

export function Dashboard({ results, onRunSpecialist, onReset }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "themes" | "text">("overview");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const data = results[selectedFileIndex];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Controls */}
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div className="flex gap-2 overflow-x-auto">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => setSelectedFileIndex(i)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                i === selectedFileIndex
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
          className="text-sm text-slate-500 hover:text-white transition-colors"
        >
          New Analysis
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Words"
          value={data.stats.totalWords.toLocaleString()}
          icon={FileText}
          color="text-blue-400"
        />
        <StatCard
          title="Unique Vocabulary"
          value={data.stats.uniqueWords.toLocaleString()}
          icon={Activity}
          color="text-teal-400"
        />
        <StatCard
          title="Avg. Word Length"
          value={data.stats.avgWordLength.toFixed(1)}
          icon={TrendingUp}
          color="text-gold-400"
        />
        <StatCard
          title="Sentences"
          value={data.stats.sentences}
          icon={FileText}
          color="text-purple-400"
        />
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex border-b border-slate-800 mb-6">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
          <TabButton active={activeTab === "themes"} onClick={() => setActiveTab("themes")}>Themes</TabButton>
          <TabButton active={activeTab === "text"} onClick={() => setActiveTab("text")}>Cleaned Text</TabButton>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp size={18} className="text-teal-400" /> Top Word Frequency
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.wordFrequency.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={12} />
                      <YAxis dataKey="word" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {data.wordFrequency.slice(0, 10).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-blue-400" /> Sentiment Analysis
                </h3>
                <div className="flex items-center justify-center h-64 gap-8">
                  <SentimentRing label="Positive" value={data.sentiment.positive} color="#0d9488" />
                  <SentimentRing label="Neutral" value={data.sentiment.neutral} color="#3b82f6" />
                  <SentimentRing label="Negative" value={data.sentiment.negative} color="#f59e0b" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "themes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.themes.map((theme, idx) => (
              <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-teal-500/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white">{theme.name}</h3>
                  <span className="bg-teal-900/50 text-teal-300 text-xs px-2 py-1 rounded-full border border-teal-700">
                    {theme.prevalence}% Prevalence
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-4">{theme.description}</p>
                <div className="flex flex-wrap gap-2">
                  {theme.keywords.map((kw, kidx) => (
                    <span key={kidx} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "text" && (
          <div className="bg-slate-950 rounded-lg p-6 font-mono text-sm text-slate-300 leading-relaxed max-h-[500px] overflow-y-auto border border-slate-800">
            {data.cleanedText}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="bg-gradient-to-r from-navy-900 to-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-500/10 rounded-lg">
            <BrainCircuit size={24} className="text-teal-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Specialist Analysis Available</h3>
            <p className="text-slate-400 text-sm">Run the Teaching Reflection Quality assessment on this corpus.</p>
          </div>
        </div>
        <button
          onClick={onRunSpecialist}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-teal-900/20"
        >
          Run Specialist Lens <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <span className="text-slate-400 text-sm font-medium">{title}</span>
        <Icon size={20} className={color} />
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-teal-500 text-teal-400"
          : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
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
          <circle
            className="text-slate-800 stroke-current"
            strokeWidth="8"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
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
          {value}%
        </div>
      </div>
      <span className="mt-2 text-xs text-slate-400">{label}</span>
    </div>
  );
}