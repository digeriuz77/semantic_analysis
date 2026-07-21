import { NextRequest, NextResponse } from "next/server";
import { callReliability, processFileViaNlp, NlpUnavailableError } from "@/lib/nlp";
import { runThematicEnsemble } from "@/lib/ensemble";
import { generateDemoRuns } from "@/lib/demo";
import { isProviderConfigured } from "@/lib/llm";
import { PROVIDER_LABEL } from "@/lib/providers";
import type {
  KappaBand,
  LlmProvider,
  ModelComparisonEntry,
  ModelComparisonResult,
  RunConfig,
} from "@/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface CompareSpec {
  provider: LlmProvider;
  model: string;
}

function parseSpecs(value: string | null): CompareSpec[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value) as CompareSpec[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (s): s is CompareSpec =>
          s && typeof s.provider === "string" && typeof s.model === "string"
      )
      .slice(0, 6);
  } catch {
    return [];
  }
}

function parseNumber(v: string | null, fallback: number, min: number, max: number): number {
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

/**
 * Cross-model comparison: process one file once, then run the ensemble for each
 * requested provider+model in parallel, returning per-model reliability metrics
 * (kappa + cosine + consensus counts) for head-to-head display.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File exceeds the 10 MB size limit" }, { status: 413 });
    }

    const specs = parseSpecs(formData.get("specs") as string | null);
    if (specs.length < 2) {
      return NextResponse.json(
        { error: "Provide at least 2 models to compare" },
        { status: 400 }
      );
    }

    const seeds = (formData.get("seeds") as string | null)
      ?.split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .slice(0, 6) ?? [42, 123, 456, 789, 1011, 1213];

    const temperature = parseNumber(formData.get("temperature") as string | null, 0.7, 0, 2);
    const cosineThreshold = parseNumber(formData.get("cosineThreshold") as string | null, 0.7, 0, 1);
    const minOccurrenceRatio = parseNumber(formData.get("minOccurrenceRatio") as string | null, 0.5, 0, 1);
    const promptTemplate = (formData.get("promptTemplate") as string | null) || undefined;

    // Process once; reuse cleaned text + keywords for all models.
    const nlp = await processFileViaNlp(file);

    const baseConfig: Omit<RunConfig, "provider" | "model"> = {
      seeds,
      temperature,
      cosineThreshold,
      minOccurrenceRatio,
      promptTemplate,
    };

    // Run each model's ensemble in parallel.
    const results = await Promise.all(
      specs.map(async (spec): Promise<ModelComparisonEntry> => {
        const label = `${PROVIDER_LABEL[spec.provider]} · ${spec.model}`;
        try {
          const config: RunConfig = { ...baseConfig, provider: spec.provider, model: spec.model };
          let demo = false;
          const runs = isProviderConfigured(spec.provider)
            ? await runThematicEnsemble({ text: nlp.cleaned_text, config })
            : (() => {
                demo = true;
                return generateDemoRuns(nlp.top_keywords, seeds);
              })();

          const reliability = await callReliability(runs, { cosineThreshold, minOccurrenceRatio });
          const consensusThemes = reliability.consensus.themes;

          return {
            provider: spec.provider,
            model: spec.model,
            label,
            runCount: reliability.runCount,
            meanKappa: reliability.kappa?.meanKappa ?? null,
            kappaBand: (reliability.kappa?.band ?? "insufficient_data") as KappaBand,
            meanCosine: reliability.cosine?.meanCosine ?? null,
            cosinePercent: reliability.cosine ? Math.round(reliability.cosine.meanCosine * 100) : null,
            consensusCount: consensusThemes.length,
            highConfidenceCount: consensusThemes.filter((t) => t.tier === "high").length,
            moderateConfidenceCount: consensusThemes.filter((t) => t.tier === "moderate").length,
            demo,
          };
        } catch (e) {
          return {
            provider: spec.provider,
            model: spec.model,
            label,
            runCount: 0,
            meanKappa: null,
            kappaBand: "insufficient_data" as KappaBand,
            meanCosine: null,
            cosinePercent: null,
            consensusCount: 0,
            highConfidenceCount: 0,
            moderateConfidenceCount: 0,
            error: e instanceof Error ? e.message : "Analysis failed",
            demo: false,
          };
        }
      })
    );

    const output: ModelComparisonResult = {
      entries: results,
      fileName: file.name,
      config: baseConfig,
    };

    return NextResponse.json(output);
  } catch (error) {
    if (error instanceof NlpUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503 }
      );
    }
    console.error("Model comparison error:", error);
    return NextResponse.json(
      { error: "Internal Server Error during model comparison" },
      { status: 500 }
    );
  }
}
