import { NextRequest, NextResponse } from "next/server";
import {
  fireworksChatCompletion,
  getFireworksApiKey,
  parseJsonResponse,
  sanitizeThemes,
} from "@/lib/fireworks";
import type { Theme } from "@/types";

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://localhost:8000";
const NLP_TIMEOUT_MS = 30_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_AI_TEXT_CHARS = 4000;
const MAX_CLIENT_TEXT_CHARS = 5000;

interface NlpKeyword {
  word: string;
  count: number;
}

interface NlpServiceResponse {
  cleaned_text: string;
  stats: Record<string, number>;
  top_keywords: NlpKeyword[];
  sentiment?: { positive: number; neutral: number; negative: number };
}

function keywordThemes(stats: Record<string, number>, topKeywords: NlpKeyword[]): Theme[] {
  return topKeywords.slice(0, 5).map((kw) => ({
    name: kw.word.charAt(0).toUpperCase() + kw.word.slice(1),
    description: `Cluster related to the concept of "${kw.word}"`,
    keywords: [kw.word],
    prevalence: stats.total_words
      ? Math.min(100, Math.round((kw.count / stats.total_words) * 1000))
      : 0,
  }));
}

async function resolveThemes(
  cleanedText: string,
  stats: Record<string, number>,
  topKeywords: NlpKeyword[]
): Promise<Theme[]> {
  if (getFireworksApiKey()) {
    const prompt = `Analyze the following text using Braun and Clarke's thematic analysis approach. Identify 3-5 key themes. Return ONLY a JSON array of objects with keys: "name", "description", "keywords" (array of strings), "prevalence" (integer 0-100). Do not include markdown formatting.\n\nText: ${cleanedText.substring(0, MAX_AI_TEXT_CHARS)}`;
    const content = await fireworksChatCompletion({ user: prompt, maxTokens: 1000 });
    const themes = sanitizeThemes(parseJsonResponse<unknown>(content));
    if (themes.length > 0) return themes;
  }
  return keywordThemes(stats, topKeywords);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 10 MB size limit" },
        { status: 413 }
      );
    }

    const nlpFormData = new FormData();
    nlpFormData.append("file", file);

    const nlpResponse = await fetch(`${NLP_SERVICE_URL}/process`, {
      method: "POST",
      body: nlpFormData,
      signal: AbortSignal.timeout(NLP_TIMEOUT_MS),
    });

    if (!nlpResponse.ok) {
      throw new Error(`NLP Service unavailable (${nlpResponse.status})`);
    }

    const nlpData: NlpServiceResponse = await nlpResponse.json();
    const themes = await resolveThemes(nlpData.cleaned_text, nlpData.stats, nlpData.top_keywords);
    const sentiment = nlpData.sentiment ?? { positive: 33, neutral: 34, negative: 33 };

    return NextResponse.json({
      fileName: file.name,
      stats: nlpData.stats,
      wordFrequency: nlpData.top_keywords,
      themes,
      sentiment,
      cleanedText: nlpData.cleaned_text.substring(0, MAX_CLIENT_TEXT_CHARS),
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Internal Server Error during analysis" },
      { status: 500 }
    );
  }
}
