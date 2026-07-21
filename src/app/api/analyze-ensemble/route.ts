import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  callReliability,
  enrichConsensusWithEvidence,
  processFileViaNlp,
  NlpUnavailableError,
} from "@/lib/nlp";
import { runThematicEnsemble, getTextChunkLength } from "@/lib/ensemble";
import { generateDemoRuns } from "@/lib/demo";
import { isProviderConfigured } from "@/lib/llm";
import type { EnsembleResult, LlmProvider, PipelineTrace, RunConfig } from "@/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CLIENT_TEXT_CHARS = 8000;

const DEFAULT_SEEDS = [42, 123, 456, 789, 1011, 1213];
const DEFAULT_MODEL = "accounts/fireworks/models/llama-v3-70b-instruct";

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
    const provider = ((formData.get("provider") as string | null) ||
      "fireworks") as LlmProvider;
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

    const config: RunConfig = {
      seeds,
      temperature,
      model,
      provider,
      cosineThreshold,
      minOccurrenceRatio,
      promptTemplate,
    };

    const inputChars = file.size;

    // 1. NLP preprocessing (server-side; file never reaches the browser raw).
    const nlp = await processFileViaNlp(file);
    const sentiment = nlp.sentiment ?? { positive: 33, neutral: 34, negative: 33 };
    const cleanedText = nlp.cleaned_text.slice(0, MAX_CLIENT_TEXT_CHARS);

    // 2. Ensemble runs (each carries full provenance).
    let demo = false;
    const runs = isProviderConfigured(provider)
      ? await runThematicEnsemble({ text: nlp.cleaned_text, config })
      : (() => {
          demo = true;
          return generateDemoRuns(nlp.top_keywords, seeds);
        })();

    // 3. Reliability + consensus with per-theme lineage.
    const reliability = await callReliability(runs, {
      cosineThreshold,
      minOccurrenceRatio,
    });

    // 4. Evidence grounding: retrieve supporting source spans per consensus theme.
    await enrichConsensusWithEvidence(cleanedText, reliability.consensus.themes);

    // 5. Pipeline trace for transparency/auditability.
    const pipelineTrace: PipelineTrace = {
      inputChars,
      cleanedChars: nlp.cleaned_text.length,
      chunkChars: getTextChunkLength(nlp.cleaned_text),
      preprocessed: true,
      embeddingBackend: reliability.embeddingBackend,
      cosineThreshold,
      minOccurrenceRatio,
      temperature,
      seeds,
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
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NlpUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503 }
      );
    }
    console.error("Ensemble analysis error:", error);
    return NextResponse.json(
      { error: "Internal Server Error during ensemble analysis" },
      { status: 500 }
    );
  }
}
