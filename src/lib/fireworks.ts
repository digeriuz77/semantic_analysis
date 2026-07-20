import type { Theme, SpecialistResult } from "@/types";

const FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions";
const DEFAULT_MODEL = "accounts/fireworks/models/llama-v3-70b-instruct";
const REQUEST_TIMEOUT_MS = 30_000;

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
  maxTokens = 1000,
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

export function parseJsonResponse<T>(content: string): T | null {
  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function sanitizeThemes(value: unknown): Theme[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
    .map((t) => {
      const prevalence =
        typeof t.prevalence === "number"
          ? Math.max(0, Math.min(100, Math.round(t.prevalence)))
          : 0;
      return {
        name: asString(t.name),
        description: asString(t.description),
        keywords: asStringArray(t.keywords),
        prevalence,
      };
    })
    .filter((t) => t.name.length > 0);
}

const QUALITIES = ["Emerging", "Developing", "Proficient", "Exemplary"] as const;
const LOOP_TYPES = ["Single Loop", "Double Loop", "Mixed"] as const;

export function sanitizeSpecialistResult(value: unknown): SpecialistResult | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  const reflectionQuality = QUALITIES.includes(v.reflectionQuality as SpecialistResult["reflectionQuality"])
    ? (v.reflectionQuality as SpecialistResult["reflectionQuality"])
    : "Developing";
  const loopType = LOOP_TYPES.includes(v.loopType as SpecialistResult["loopType"])
    ? (v.loopType as SpecialistResult["loopType"])
    : "Mixed";
  const score =
    typeof v.score === "number" ? Math.max(0, Math.min(100, Math.round(v.score))) : 0;

  return {
    reflectionQuality,
    score,
    analysis: asString(v.analysis),
    recommendations: asStringArray(v.recommendations),
    loopType,
  };
}
