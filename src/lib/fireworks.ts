import type { Theme, SpecialistResult } from "@/types";

const FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions";
const DEFAULT_MODEL = "accounts/fireworks/models/deepseek-v4-flash-0731";
const REQUEST_TIMEOUT_MS = 120_000;

export function getFireworksApiKey(): string | undefined {
  return process.env.FIREWORKS_API_KEY;
}

interface ChatCompletionParams {
  user: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export async function fireworksChatCompletion({
  user,
  system,
  temperature = 0.3,
  maxTokens = 8000,
  model = DEFAULT_MODEL,
}: ChatCompletionParams): Promise<string> {
  const apiKey = getFireworksApiKey();
  if (!apiKey) {
    throw new Error("Missing FIREWORKS_API_KEY");
  }

  const messages = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user" as const, content: user },
  ];

  const response = await fetch(FIREWORKS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Fireworks request failed: ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Robust JSON parser that handles markdown fences, reasoning traces, and extra text. */
export function parseJsonResponse<T>(content: string): T | null {
  if (!content || !content.trim()) return null;
  const raw = content.trim();

  // Step 1: Remove markdown codeblock wrapper if present
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Step 2: Direct parse attempt
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* proceed to regex substring extraction */
  }

  // Step 3: Extract valid JSON substring between first [ / { and last ] / }
  const firstBracket = cleaned.indexOf("[");
  const firstBrace = cleaned.indexOf("{");

  let start = -1;
  let end = -1;

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    start = firstBracket;
    end = cleaned.lastIndexOf("]");
  } else if (firstBrace !== -1) {
    start = firstBrace;
    end = cleaned.lastIndexOf("}");
  }

  if (start !== -1 && end !== -1 && end > start) {
    const jsonSubstring = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(jsonSubstring) as T;
    } catch {
      /* parse failed */
    }
  }

  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
}

export function sanitizeThemes(value: unknown): Theme[] {
  if (value === null || value === undefined) return [];

  let items: unknown[] = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.themes)) items = obj.themes;
    else if (Array.isArray(obj.results)) items = obj.results;
    else if (Array.isArray(obj.data)) items = obj.data;
  }

  return items
    .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
    .map((t) => {
      const name =
        asString(t.name) ||
        asString(t.theme) ||
        asString(t.label) ||
        asString(t.title) ||
        asString(t.topic);

      const description =
        asString(t.description) ||
        asString(t.summary) ||
        asString(t.explanation) ||
        asString(t.details) ||
        asString(t.evidence) ||
        name;

      const keywords =
        asStringArray(t.keywords) ||
        asStringArray(t.tags) ||
        asStringArray(t.key_words) ||
        asStringArray(t.terms);

      const prevalenceRaw = t.prevalence ?? t.score;
      const prevalence =
        typeof prevalenceRaw === "number"
          ? Math.max(0, Math.min(100, Math.round(prevalenceRaw)))
          : 50;

      const supportingQuotes = asStringArray(
        t.supporting_quotes ?? t.supportingQuotes ?? t.quotes ?? t.evidence
      );

      const theme: Theme = {
        name,
        description,
        keywords: keywords.length > 0 ? keywords : [name.toLowerCase()],
        prevalence,
      };
      if (supportingQuotes.length > 0) {
        theme.supportingQuotes = supportingQuotes;
      }
      return theme;
    })
    .filter((t) => t.name.length > 0);
}

const QUALITIES = ["Emerging", "Developing", "Proficient", "Exemplary"] as const;

export function sanitizeSpecialistResult(value: unknown): SpecialistResult | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  const rawQuality = String(v.reflectionQuality || v.quality || "").trim().toLowerCase();
  let reflectionQuality: SpecialistResult["reflectionQuality"] = "Developing";
  if (rawQuality.includes("exemplary") || rawQuality.includes("high")) {
    reflectionQuality = "Exemplary";
  } else if (rawQuality.includes("proficient") || rawQuality.includes("good")) {
    reflectionQuality = "Proficient";
  } else if (rawQuality.includes("emerging") || rawQuality.includes("low") || rawQuality.includes("poor")) {
    reflectionQuality = rawQuality.includes("emerging") ? "Emerging" : "Developing";
  } else if (QUALITIES.includes(v.reflectionQuality as SpecialistResult["reflectionQuality"])) {
    reflectionQuality = v.reflectionQuality as SpecialistResult["reflectionQuality"];
  }

  const rawLoop = String(v.loopType || v.loop || "").trim().toLowerCase();
  let loopType: SpecialistResult["loopType"] = "Mixed";
  if (rawLoop.includes("single")) loopType = "Single Loop";
  else if (rawLoop.includes("double")) loopType = "Double Loop";

  const scoreNum = Number(v.score);
  const score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 65;

  const analysis =
    asString(v.analysis) ||
    asString(v.summary) ||
    asString(v.description) ||
    "Specialist reflection analysis completed.";

  const recommendations = asStringArray(v.recommendations ?? v.suggestions);

  return {
    reflectionQuality,
    score,
    analysis,
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ["Continue deepening reflective practice through double-loop inquiry."],
    loopType,
  };
}
