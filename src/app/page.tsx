import Link from "next/link";
import { Layers, BarChart3 } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-3 flex-wrap">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
              Reliability-Quantified
            </span>
            <span>Thematic Analyzer</span>
          </h1>
          <p className="text-slate-400 mt-4 text-sm max-w-xl mx-auto">
            Ensemble LLM thematic analysis with dual reliability metrics,
            paradigm-aware methodology, full explainability, and a persistent
            iterative research workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeCard
            href="/workspace"
            icon={Layers}
            title="Research Workspace"
            desc="Persist your corpus and iterate. Code evidence as statements attributed to actors, concepts, dates, and locations. Filter by entity or time window and compare."
            badge="Persistent"
          />
          <ModeCard
            href="/analyzer"
            icon={BarChart3}
            title="Quick Analysis"
            desc="Run an ensemble thematic analysis on a document. Dual reliability metrics (κ + cosine), consensus themes, cross-model comparison, and export."
            badge="One-shot"
          />
        </div>
      </div>
    </main>
  );
}

function ModeCard({
  href,
  icon: Icon,
  title,
  desc,
  badge,
}: {
  href: string;
  icon: typeof Layers;
  title: string;
  desc: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-slate-900/50 border border-slate-800 hover:border-teal-500/60 rounded-xl p-6 transition-all hover:scale-[1.01]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-teal-500/10 rounded-lg group-hover:bg-teal-500/20 transition-colors">
          <Icon size={24} className="text-teal-400" />
        </div>
        <span className="text-xs text-slate-600 border border-slate-700 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
      <p className="text-teal-400 text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        Open →
      </p>
    </Link>
  );
}
