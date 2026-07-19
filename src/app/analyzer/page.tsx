"use client";

import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { ProcessingView } from "@/components/ProcessingView";
import { Dashboard } from "@/components/Dashboard";
import { SpecialistView } from "@/components/SpecialistView";
import { AnalysisResult, SpecialistResult } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { Upload, BarChart3, Microscope } from "lucide-react";

type View = "upload" | "dashboard" | "specialist";

export default function AnalyzerPage() {
  const [currentView, setCurrentView] = useState<View>("upload");
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [specialistResult, setSpecialistResult] = useState<SpecialistResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [progress, setProgress] = useState(0);

  const handleFilesUploaded = async (files: File[]) => {
    setIsProcessing(true);
    setCurrentView("upload");
    setProgress(0);

    try {
      const newResults: AnalysisResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingStep(`Processing ${file.name} (${i + 1}/${files.length})...`);
        setProgress(((i) / files.length) * 50);

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to process ${file.name}`);
        }

        const data = await response.json();
        newResults.push({
          ...data,
          id: uuidv4(),
        });

        setProgress(((i + 1) / files.length) * 100);
      }

      setResults(newResults);
      setIsProcessing(false);
      setCurrentView("dashboard");
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      alert("Error processing files. Please try again.");
    }
  };

  const handleSpecialistAnalysis = async () => {
    setIsProcessing(true);
    setProcessingStep("Running Specialist Reflection Analysis...");
    setProgress(0);

    try {
      const allText = results.map(r => r.cleanedText).join("\n");

      const response = await fetch("/api/specialist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: allText, mode: "reflection_quality" }),
      });

      if (!response.ok) throw new Error("Specialist analysis failed");

      const data = await response.json();
      setSpecialistResult(data);
      setProgress(100);
      setCurrentView("specialist");
    } catch (error) {
      console.error(error);
      alert("Specialist analysis failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAnalysis = () => {
    setResults([]);
    setSpecialistResult(null);
    setCurrentView("upload");
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
              Semantic & Thematic
            </span>
            <span className="text-white">Analyzer</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl">
            Braun & Clarke thematic analysis powered by NLTK and Fireworks AI.
            Specialized in teaching reflection quality assessment.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentView("upload")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentView === "upload"
                ? "bg-navy-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Upload size={16} /> Upload
          </button>
          <button
            onClick={() => results.length > 0 && setCurrentView("dashboard")}
            disabled={results.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentView === "dashboard"
                ? "bg-navy-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
            }`}
          >
            <BarChart3 size={16} /> Dashboard
          </button>
          <button
            onClick={() => specialistResult && setCurrentView("specialist")}
            disabled={!specialistResult}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentView === "specialist"
                ? "bg-navy-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
            }`}
          >
            <Microscope size={16} /> Specialist
          </button>
        </div>
      </header>

      {isProcessing && (
        <ProcessingView step={processingStep} progress={progress} />
      )}

      {!isProcessing && currentView === "upload" && (
        <FileUpload onFilesSelected={handleFilesUploaded} />
      )}

      {!isProcessing && currentView === "dashboard" && results.length > 0 && (
        <Dashboard
          results={results}
          onRunSpecialist={handleSpecialistAnalysis}
          onReset={resetAnalysis}
        />
      )}

      {!isProcessing && currentView === "specialist" && specialistResult && (
        <SpecialistView result={specialistResult} onBack={() => setCurrentView("dashboard")} />
      )}
    </main>
  );
}