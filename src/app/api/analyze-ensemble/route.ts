import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  callReliability,
  enrichConsensusWithEvidence,
  processFileViaNlp,
  NlpUnavailableError,
  type AnalysisUnit,
} from "@/lib/nlp";
import {
  runThematicEnsemble,
  runAdaptiveEnsemble,
  chunkText,
  chunkSegments,
  filterSuccessfulRuns,
} from "@/lib/ensemble";
import { generateDemoRuns } from "@/lib/demo";
import { isProviderConfigured } from "@/lib/llm";
import { ALL_PROVIDERS } from "@/lib/providers";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import type {
  EnsembleResult,
  FrameworkId,
  LlmProvider,
  ParadigmId,
  PipelineTrace,
  RunConfig,
} from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CLIENT_TEXT_CHARS = 8000;
const MAX_EVIDENCE_TEXT_CHARS = 40_000;
/** LLM-heavy route: 10 analyses / 5 min per client. */
const RATE_LIMIT = { limit: 10, windowMs: 5 * 60_000 };

const DEFAULT_SEEDS = [42, 123, 456, 789, 1011, 1213];
const DEFAULT_MODEL = "accounts/fireworks/models/glm-5p3";

function parseSeeds(value: string | null): number[] {
  if (!value) return DEFAULT_SEEDS;
  const parsed = value
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .slice(0, 6);
  return parsed.length > 0 ? parsed : DEFAULT_SEEDS;
}

function parseNumber(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Parse the per-file text_columns override (JSON int array) or null. */
function parseTextColumns(value: string | null): number[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every((i) => typeof i === "number" && Number.isInteger(i) && i >= 0)
    ) {
      return (parsed as number[]).slice(0, 50);
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Orchestrates a reproducible ensemble analysis for one document:
 *   1. Python /process  -> cleaning, NLTK stats, VADER sentiment, keywords
 *   2. N parallel LLM runs (one per seed), or deterministic demo runs if no key
 *   3. Python /reliability -> Cohen's kappa + cosine + consensus themes (w/ lineage)
 *   4. Python /evidence -> supporting source spans per consensus theme
 *   5. Pipeline trace assembled for full transparency.
 * Returns a single EnsembleResult the dashboard renders directly.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(clientKey(request), RATE_LIMIT.limit, RATE_LIMIT.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many analyses. Please wait a moment and retry." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 10 MB size limit" },
        { status: 413 }
      );
    }

    const seeds = parseSeeds(formData.get("seeds") as string | null);
    const temperature = parseNumber(
      formData.get("temperature") as string | null,
      0.7,
      0,
      2
    );
    const model = (formData.get("model") as string | null) || DEFAULT_MODEL;
    const provider = (
      (formData.get("provider") as string | null) || "fireworks"
    ) as LlmProvider;
    if (!ALL_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `Unknown provider "${provider}"` },
        { status: 400 }
      );
    }
    const cosineThreshold = parseNumber(
      formData.get("cosineThreshold") as string | null,
      0.7,
      0,
      1
    );
    const minOccurrenceRatio = parseNumber(
      formData.get("minOccurrenceRatio") as string | null,
      0.5,
      0,
      1
    );
    const promptTemplate =
      (formData.get("promptTemplate") as string | null) || undefined;
    const paradigm = (formData.get("paradigm") as ParadigmId | null) || undefined;
    const framework = (formData.get("framework") as FrameworkId | null) || undefined;
    const adaptive = formData.get("adaptive") === "true";
    const textColumns = parseTextColumns(formData.get("text_columns") as string | null);

    const config: RunConfig = {
      seeds,
      temperature,
      model,
      provider,
      cosineThreshold,
      minOccurrenceRatio,
      promptTemplate,
      paradigm,
      framework,
      adaptive,
    };

    // 1. NLP preprocessing (server-side; file never reaches the browser raw).
    // Tabular files are parsed into row-indexed units; prose files are cleaned.
    const nlp = await processFileViaNlp(file, textColumns ?? undefined);
    const isTabular = nlp.mode === "tabular";
    const units: AnalysisUnit[] = isTabular ? (nlp.units ?? []) : [];
    const segments = units.map((u) => u.text);
    const sentiment = nlp.sentiment ?? { positive: 33, neutral: 34, negative: 33 };
    const cleanedText = nlp.cleaned_text.slice(0, MAX_CLIENT_TEXT_CHARS);
    // Punctuation-preserving text: sent_tokenize in /evidence needs sentence
    // boundaries that clean_text (which strips punctuation) destroys. In
    // tabular mode the units themselves are the evidence corpus.
    const evidenceText = (nlp.extracted_text ?? nlp.cleaned_text).slice(
      0,
      MAX_EVIDENCE_TEXT_CHARS
    );

    // 2. Ensemble runs (each carries full provenance). Adaptive mode runs
    // seeds sequentially and stops early on a discovery plateau; otherwise
    // seeds run in parallel. Tabular input uses whole-row chunk packing.
    let demo = false;
    let stoppedEarly = false;
    let runs;
    if (isProviderConfigured(provider)) {
      if (adaptive) {
        const adaptiveResult = await runAdaptiveEnsemble({
          text: nlp.cleaned_text,
          config,
          segments,
        });
        runs = adaptiveResult.runs;
        stoppedEarly = adaptiveResult.stoppedEarly;
      } else {
        runs = await runThematicEnsemble({ text: nlp.cleaned_text, config, segments });
      }
    } else {
      demo = true;
      runs = generateDemoRuns(nlp.top_keywords, seeds);
    }

    // 3. Reliability + consensus with per-theme lineage. Only successful runs
    // count as raters; failed runs are retained above for the audit trail but
    // excluded here so they cannot deflate kappa/cosine/consensus.
    const successfulRuns = filterSuccessfulRuns(runs);
    const failedRunCount = runs.length - successfulRuns.length;
    const reliability = await callReliability(successfulRuns, {
      cosineThreshold,
      minOccurrenceRatio,
    });

    // 4. Evidence grounding: retrieve supporting source spans per consensus
    // theme (units mode cites row + column for tabular input).
    await enrichConsensusWithEvidence(
      evidenceText,
      reliability.consensus.themes,
      isTabular ? units : undefined
    );

    // 5. Pipeline trace for transparency/auditability.
    const chunkPlan =
      segments.length > 0
        ? chunkSegments(segments)
        : chunkText(nlp.cleaned_text);
    const pipelineTrace: PipelineTrace = {
      // Characters, not bytes: multi-byte corpora must not misreport size.
      inputChars: nlp.extracted_text?.length ?? nlp.cleaned_text.length,
      cleanedChars: nlp.cleaned_text.length,
      chunkChars: chunkPlan.analyzedChars,
      chunkCount: chunkPlan.chunks.length,
      inputTruncated: chunkPlan.truncated,
      preprocessed: true,
      embeddingBackend: reliability.embeddingBackend,
      cosineThreshold,
      minOccurrenceRatio,
      temperature,
      seeds,
      paradigm,
      framework,
      failedRunCount,
      reliabilityRunCount: successfulRuns.length,
      csv: isTabular && nlp.csv
        ? {
            delimiter: nlp.csv.delimiter,
            encoding: nlp.csv.encoding,
            rowCount: nlp.csv.rowCount,
            textColumnNames: nlp.csv.textColumnNames ?? [],
          }
        : undefined,
    };

    const result: EnsembleResult = {
      id: uuidv4(),
      fileName: file.name,
      config,
      stats: {
        totalWords: Number(nlp.stats.totalWords ?? 0),
        uniqueWords: Number(nlp.stats.uniqueWords ?? 0),
        sentences: Number(nlp.stats.sentences ?? 0),
        avgWordLength: Number(nlp.stats.avgWordLength ?? 0),
      },
      sentiment,
      wordFrequency: nlp.top_keywords,
      cleanedText,
      runs,
      reliability,
      pipelineTrace,
      demo,
      stoppedEarly,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NlpUnavailableError) {
      // 400/413 from the service (e.g. malformed CSV, no text column) pass
      // through as client errors; anything else is a service outage.
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Ensemble analysis error:", error);
    return NextResponse.json(
      { error: "Internal Server Error during ensemble analysis" },
      { status: 500 }
    );
  }
}
