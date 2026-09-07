"use client";

import type { EnsembleResult, ThemeAnnotation } from "@/types";
import { PARADIGMS } from "@/lib/paradigms";
import { FRAMEWORKS } from "@/lib/frameworks";
import { KAPPA_BAND_LABEL } from "@/lib/kappa";
import { Download, FileJson, FileText, FileSpreadsheet, ClipboardList } from "lucide-react";

interface ExportPanelProps {
  result: EnsembleResult;
  annotations: Record<string, ThemeAnnotation>;
}

/**
 * Bundles the full explainability + methodology record into citable formats so
 * any analysis is reproducible and auditable. Every export carries the pipeline
 * trace, paradigm/framework, reliability metrics, lineage, evidence, and
 * researcher annotations.
 */
export function ExportPanel({ result, annotations }: ExportPanelProps) {
  const ts = new Date().toISOString();

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const safeName = result.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_");

  const exportJson = () => {
    const payload = {
      ...result,
      annotations,
      exportedAt: ts,
    };
    download(
      `${safeName}_analysis.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
  };

  const exportCsv = () => {
    const rows = [
      [
        "date_reference",
        "theme_label",
        "description",
        "tier",
        "occurrence",
        "run_count",
        "consistency_ratio",
        "keywords",
        "supporting_quotes",
        "retrieved_evidence",
        "participating_seeds",
        "annotation_status",
        "annotation_note",
      ],
    ];
    for (const t of result.reliability.consensus.themes) {
      const anno = annotations[t.label];
      const llmQuotes = Array.from(
        new Set((t.lineage ?? []).flatMap((m) => m.quotes).filter(Boolean))
      );
      const evidenceTexts = Array.from(
        new Set((t.evidence ?? []).map((e) => e.text).filter(Boolean))
      );
      const seeds = (t.lineage ?? [])
        .map((m) => m.seed)
        .filter((s): s is number => s !== null && s !== undefined);
      const dateRef = (t as { dateReference?: string }).dateReference || "Unstated";

      rows.push([
        csv(dateRef),
        csv(t.label),
        csv(t.description),
        t.tier,
        String(t.occurrence),
        String(t.runCount),
        String(t.consistency),
        csv(t.keywords.join("; ")),
        csv(llmQuotes.join(" | ")),
        csv(evidenceTexts.join(" | ")),
        csv(seeds.join("; ")),
        anno?.status ?? "",
        csv(anno?.note ?? ""),
      ]);
    }
    download(`${safeName}_themes.csv`, rows.map((r) => r.join(",")).join("\n"), "text/csv");
  };

  const exportEvidenceCsv = () => {
    const rows = [
      [
        "date_reference",
        "theme_label",
        "tier",
        "evidence_type",
        "text",
        "source_reference",
        "similarity_score",
        "seed",
      ],
    ];
    for (const t of result.reliability.consensus.themes) {
      const dateRef = (t as { dateReference?: string }).dateReference || "Unstated";
      for (const m of t.lineage ?? []) {
        const memberDate = m.dateReference || dateRef;
        for (const q of m.quotes ?? []) {
          if (!q) continue;
          rows.push([
            csv(memberDate),
            csv(t.label),
            t.tier,
            "LLM Quote",
            csv(q),
            "Extracted by model",
            m.cosineToMedoid !== undefined ? m.cosineToMedoid.toFixed(3) : "1.000",
            m.seed ? String(m.seed) : "",
          ]);
        }
      }
      for (const e of t.evidence ?? []) {
        if (!e.text) continue;
        const ref = e.rowIndex !== undefined
          ? `Row ${e.rowIndex}${e.columnName ? ` · ${e.columnName}` : ""}`
          : `Sentence ${e.unitIndex + 1}`;
        rows.push([
          csv(dateRef),
          csv(t.label),
          t.tier,
          "Retrieved Source Evidence",
          csv(e.text),
          csv(ref),
          e.cosine.toFixed(3),
          "",
        ]);
      }
    }
    download(`${safeName}_evidence.csv`, rows.map((r) => r.join(",")).join("\n"), "text/csv");
  };

  const exportMarkdown = () => {
    const md = buildMarkdownReport(result, annotations, ts);
    download(`${safeName}_report.md`, md, "text/markdown");
  };

  const exportManifest = () => {
    const manifest = buildManifest(result, annotations, ts);
    download(`${safeName}_manifest.json`, JSON.stringify(manifest, null, 2), "application/json");
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
        <Download size={18} className="text-teal-400" /> Export &amp; Reproducibility
      </h3>
      <p className="text-slate-400 text-xs mb-5 max-w-2xl">
        Bundle the full analysis record — pipeline trace, paradigm/framework,
        reliability metrics, theme lineage, evidence, and annotations — into a
        citable, reproducible artifact.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <ExportButton
          icon={ClipboardList}
          label="Markdown report"
          desc="Human-readable, COREQ-aligned. Includes lineage, evidence, annotations."
          onClick={exportMarkdown}
        />
        <ExportButton
          icon={FileSpreadsheet}
          label="CSV (Themes Summary)"
          desc="Consensus themes with tiers, consistency, keywords, evidence quotes, and annotations."
          onClick={exportCsv}
        />
        <ExportButton
          icon={FileSpreadsheet}
          label="CSV (Evidence & Quotes)"
          desc="Long-format export of supporting quotes and corpus spans per theme for NVivo/Excel."
          onClick={exportEvidenceCsv}
        />
        <ExportButton
          icon={FileJson}
          label="Full JSON"
          desc="Complete result object with all provenance and annotations."
          onClick={exportJson}
        />
        <ExportButton
          icon={FileText}
          label="Reproducibility manifest"
          desc="Parameters hash + timestamp for citation/replication."
          onClick={exportManifest}
        />
      </div>
    </div>
  );
}

function ExportButton({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 text-left bg-slate-950/50 border border-slate-800 hover:border-teal-500/60 rounded-lg p-4 transition-colors"
    >
      <Icon size={18} className="text-teal-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-slate-200 text-sm font-medium">{label}</p>
        <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

function csv(value: string): string {
  const needsQuote = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function buildManifest(
  result: EnsembleResult,
  annotations: Record<string, ThemeAnnotation>,
  ts: string
) {
  const t = result.pipelineTrace;
  const configStr = JSON.stringify({
    provider: result.config.provider,
    model: result.config.model,
    seeds: t.seeds,
    temperature: t.temperature,
    paradigm: t.paradigm,
    framework: t.framework,
    cosineThreshold: t.cosineThreshold,
    minOccurrenceRatio: t.minOccurrenceRatio,
  });
  let hash = 0;
  for (let i = 0; i < configStr.length; i++) {
    hash = (hash * 31 + configStr.charCodeAt(i)) >>> 0;
  }
  return {
    manifestVersion: 1,
    generatedAt: ts,
    fileName: result.fileName,
    analysisId: result.id,
    configHash: `0x${hash.toString(16)}`,
    config: {
      provider: result.config.provider,
      model: result.config.model,
      seeds: t.seeds,
      temperature: t.temperature,
      paradigm: t.paradigm,
      framework: t.framework,
      cosineThreshold: t.cosineThreshold,
      minOccurrenceRatio: t.minOccurrenceRatio,
      embeddingBackend: t.embeddingBackend,
    },
    pipeline: {
      inputChars: t.inputChars,
      cleanedChars: t.cleanedChars,
      chunkChars: t.chunkChars,
      preprocessed: t.preprocessed,
    },
    reliability: {
      runCount: result.reliability.runCount,
      meanKappa: result.reliability.kappa?.meanKappa ?? null,
      kappaBand: result.reliability.kappa?.band ?? null,
      meanCosine: result.reliability.cosine?.meanCosine ?? null,
      consensusCount: result.reliability.consensus.themes.length,
    },
    annotationCount: Object.keys(annotations).length,
  };
}

function buildMarkdownReport(
  result: EnsembleResult,
  annotations: Record<string, ThemeAnnotation>,
  ts: string
) {
  const t = result.pipelineTrace;
  const paradigm = t.paradigm ? PARADIGMS[t.paradigm] : null;
  const framework = t.framework ? FRAMEWORKS[t.framework] : null;
  const rel = result.reliability;
  const kappa = rel.kappa;
  const cosine = rel.cosine;

  const lines: string[] = [];
  lines.push(`# Thematic Analysis Report`);
  lines.push("");
  lines.push(`**Document:** ${result.fileName}`);
  lines.push(`**Generated:** ${ts}`);
  lines.push(`**Analysis ID:** ${result.id}`);
  lines.push("");

  lines.push(`## Research Design`);
  lines.push("");
  if (paradigm) {
    lines.push(`- **Paradigm:** ${paradigm.label} — ${paradigm.summary}`);
  }
  if (framework) {
    lines.push(`- **Framework:** ${framework.label}`);
    lines.push(`- **Methodology phases:**`);
    for (const phase of framework.phases) {
      lines.push(`  - ${phase.name}: ${phase.description}`);
    }
  }
  lines.push("");

  if (paradigm && !paradigm.foregroundKappa) {
    lines.push(`## Quality Criteria (${paradigm.label})`);
    lines.push("");
    for (const c of paradigm.qualityCriteria) {
      lines.push(`- **${c.name}** — ${c.description}`);
    }
    lines.push("");
  }

  lines.push(`## Reliability Metrics`);
  lines.push("");
  if (paradigm && !paradigm.kappaAppropriate) {
    lines.push(`> _Cohen's κ is reported as supplementary; the ${paradigm.label} paradigm foregrounds trustworthiness criteria._`);
    lines.push("");
  }
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  if (kappa) {
    lines.push(`| Cohen's κ (mean) | ${kappa.meanKappa.toFixed(3)} (${KAPPA_BAND_LABEL[kappa.band]}) |`);
    lines.push(`| κ range | ${kappa.minKappa.toFixed(3)} – ${kappa.maxKappa.toFixed(3)} |`);
  }
  if (cosine) {
    lines.push(`| Cosine similarity (mean) | ${(cosine.meanCosine * 100).toFixed(1)}% |`);
    lines.push(`| Cosine range | ${(cosine.minCosine * 100).toFixed(1)}% – ${(cosine.maxCosine * 100).toFixed(1)}% |`);
  }
  lines.push(`| Runs | ${rel.runCount} |`);
  lines.push(`| Embedding backend | ${t.embeddingBackend} |`);
  lines.push("");

  if (rel.saturation && rel.saturation.length > 0) {
    lines.push(`## Theoretical Saturation`);
    lines.push("");
    lines.push(`| Runs | Distinct classes | New classes |`);
    lines.push(`|------|----------------|-------------|`);
    for (const s of rel.saturation) {
      lines.push(`| ${s.runsIncluded} | ${s.distinctClasses} | ${s.newClasses} |`);
    }
    lines.push("");
  }

  lines.push(`## Consensus Themes`);
  lines.push("");
  for (const theme of rel.consensus.themes) {
    const anno = annotations[theme.label];
    lines.push(`### ${theme.label}`);
    lines.push("");
    lines.push(`- **Tier:** ${theme.tier} (${theme.occurrence}/${theme.runCount} runs, ${Math.round(theme.consistency * 100)}% consistency)`);
    if (theme.keywords.length > 0) {
      lines.push(`- **Keywords:** ${theme.keywords.join(", ")}`);
    }
    lines.push(`- **Description:** ${theme.description}`);
    if (anno) {
      lines.push(`- **Researcher annotation:** ${anno.status}${anno.note ? ` — "${anno.note}"` : ""}`);
    }
    lines.push("");

    if (theme.lineage && theme.lineage.length > 0) {
      lines.push(`#### Derivation lineage`);
      lines.push("");
      lines.push(`| Run | Seed | Name | Cosine to medoid | Medoid |`);
      lines.push(`|-----|------|------|-------------------|--------|`);
      for (const m of theme.lineage) {
        lines.push(`| ${m.runIndex + 1} | ${m.seed ?? "?"} | ${m.name || "(unnamed)"} | ${m.cosineToMedoid.toFixed(3)} | ${m.isMedoid ? "✓" : ""} |`);
      }
      lines.push("");
    }

    const llmQuotes = (theme.lineage ?? []).flatMap((m) => m.quotes);
    if (llmQuotes.length > 0) {
      lines.push(`#### LLM-cited quotes`);
      lines.push("");
      for (const q of llmQuotes.slice(0, 5)) {
        lines.push(`> "${q}"`);
      }
      lines.push("");
    }
    if (theme.evidence && theme.evidence.length > 0) {
      lines.push(`#### Retrieved source evidence`);
      lines.push("");
      for (const e of theme.evidence.slice(0, 3)) {
        lines.push(`> "${e.text}" _(cosine ${e.cosine.toFixed(3)})_`);
      }
      lines.push("");
    }
  }

  lines.push(`## Pipeline Trace (Reproducibility)`);
  lines.push("");
  lines.push(`| Step | Detail |`);
  lines.push(`|------|--------|`);
  lines.push(`| Input size | ${t.inputChars.toLocaleString()} chars |`);
  lines.push(`| After cleaning | ${t.cleanedChars.toLocaleString()} chars |`);
  lines.push(`| Sent to LLM | ${t.chunkChars.toLocaleString()} chars |`);
  lines.push(`| Preprocessing | ${t.preprocessed ? "tokenize · lemmatize · stopwords" : "none"} |`);
  lines.push(`| Provider / model | ${result.config.provider} / ${result.config.model} |`);
  lines.push(`| Seeds | [${t.seeds.join(", ")}] |`);
  lines.push(`| Temperature | ${t.temperature} |`);
  lines.push(`| Cosine threshold | ${t.cosineThreshold} |`);
  lines.push(`| Min occurrence ratio | ${t.minOccurrenceRatio} |`);
  lines.push(`| Embedding backend | ${t.embeddingBackend} |`);
  lines.push(`| Demo mode | ${result.demo} |`);
  lines.push("");

  return lines.join("\n");
}
