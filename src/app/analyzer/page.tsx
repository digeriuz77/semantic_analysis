"use client";

import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { ProcessingView } from "@/components/ProcessingView";
import { EnsembleDashboard } from "@/components/EnsembleDashboard";
import { AnalysisConfigurator, defaultConfig } from "@/components/AnalysisConfigurator";
import { SpecialistView } from "@/components/SpecialistView";
import type { EnsembleResult, RunConfig, SpecialistResult } from "@/types";
import { Upload, BarChart3, Microscope, AlertCircle } from "lucide-react";

type View = "upload" | "configure" | "results" | "specialist";

export default function AnalyzerPage() {
  const [view, setView] = useState<View>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [config, setConfig] = useState<RunConfig>(defaultConfig());
  const [results, setResults] = useState<EnsembleResult[]>([]);
  const [specialistResult, setSpecialistResult] = useState<SpecialistResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (selected: File[]) => {
    if (selected.length === 0) return;
    setFiles(selected);
    setConfig(defaultConfig());
    setError(null);
    setView("configure");
  };

  const handleRun = async (runConfig: RunConfig) => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setProcessingStep("Preprocessing corpus (NLTK)…");
    const out: EnsembleResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingStep(
          `Analyzing ${file.name} (${i + 1}/${files.length}) — ensemble of ${runConfig.seeds.length} run${runConfig.seeds.length === 1 ? "" : "s"}…`
        );

        const formData = new FormData();
        formData.append("file", file);
        formData.append("seeds", runConfig.seeds.join(","));
        formData.append("temperature", String(runConfig.temperature));
        formData.append("model", runConfig.model);
        formData.append("provider", runConfig.provider);
        formData.append("cosineThreshold", String(runConfig.cosineThreshold ?? 0.7));
        formData.append("minOccurrenceRatio", String(runConfig.minOccurrenceRatio ?? 0.5));
        if (runConfig.promptTemplate) {
          formData.append("promptTemplate", runConfig.promptTemplate);
        }

        const res = await fetch("/api/analyze-ensemble", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Analysis failed (${res.status})`);
        }

        out.push((await res.json()) as EnsembleResult);
        setProgress(((i + 1) / files.length) * 100);
      }

      setResults(out);
      setView("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpecialist = async () => {
    setIsProcessing(true);
    setError(null);
    setProcessingStep("Running Specialist Reflection Analysis…");
    setProgress(0);

    try {
      const allText = results.map((r) => r.cleanedText).join("\n");
      const res = await fetch("/api/specialist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: allText, mode: "reflection_quality" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Specialist analysis failed");
      }
      setSpecialistResult(await res.json());
      setView("specialist");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Specialist analysis failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setResults([]);
    setSpecialistResult(null);
    setError(null);
    setView("upload");
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 flex-wrap">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
              Reliability-Quantified
            </span>
            <span className="text-white">Thematic Analyzer</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl">
            Ensemble thematic analysis with dual reliability metrics (Cohen&apos;s κ
            + cosine similarity) and consensus extraction.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <NavButton icon={Upload} label="Upload" active={view === "upload" || view === "configure"} onClick={() => reset()} />
          <NavButton
            icon={BarChart3}
            label="Results"
            active={view === "results"}
            disabled={results.length === 0}
            onClick={() => results.length > 0 && setView("results")}
          />
          <NavButton
            icon={Microscope}
            label="Specialist"
            active={view === "specialist"}
            disabled={!specialistResult}
            onClick={() => specialistResult && setView("specialist")}
          />
        </div>
      </header>

      {error && (
        <div className="mb-6 flex items-start gap-3 bg-red-900/20 border border-red-700/50 rounded-xl p-4">
          <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-200 text-sm">{error}</p>
            {view !== "results" && (
              <button
                onClick={reset}
                className="mt-2 text-xs text-red-300 underline hover:text-red-200"
              >
                Start over
              </button>
            )}
          </div>
        </div>
      )}

      {isProcessing && <ProcessingView step={processingStep} progress={progress} />}

      {!isProcessing && view === "upload" && (
        <FileUpload onFilesSelected={handleFilesSelected} />
      )}

      {!isProcessing && view === "configure" && (
        <AnalysisConfigurator
          files={files}
          initialConfig={config}
          onRun={handleRun}
          onBack={() => setView("upload")}
        />
      )}

      {!isProcessing && view === "results" && results.length > 0 && (
        <div className="space-y-6">
          <EnsembleDashboard results={results} onReset={reset} />
          <SpecialistPrompt onRun={handleSpecialist} />
        </div>
      )}

      {!isProcessing && view === "specialist" && specialistResult && (
        <SpecialistView result={specialistResult} onBack={() => setView("results")} />
      )}
    </main>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Upload;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-navy-800 text-white"
          : "text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function SpecialistPrompt({ onRun }: { onRun: () => void }) {
  return (
    <div className="bg-gradient-to-r from-navy-900 to-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-teal-500/10 rounded-lg">
          <Microscope size={24} className="text-teal-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Specialist Lens available</h3>
          <p className="text-slate-400 text-sm">
            Run Schön double-loop reflection analysis on this corpus.
          </p>
        </div>
      </div>
      <button
        onClick={onRun}
        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-teal-900/20"
      >
        Run Specialist Lens →
      </button>
    </div>
  );
}
