import type { ChatAdapter, ChatRequest } from "./types";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 45_000;
const DEFAULT_MODEL = "gemini-1.5-pro";

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

/**
 * Google Gemini adapter (Generative AI API). Note: Gemini does not support the
 * `seed` parameter, so reproducibility across runs relies on temperature
 * control only. Default model: gemini-1.5-pro.
 */
export const geminiAdapter: ChatAdapter = {
  provider: "gemini",
  isConfigured: () => Boolean(apiKey()),

  async complete(req: ChatRequest): Promise<string> {
    const key = apiKey();
    if (!key) throw new Error("Missing GEMINI_API_KEY");

    const model = req.model || DEFAULT_MODEL;
    const url = `${GEMINI_BASE_URL}/${model}:generateContent`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens ?? 1000,
      },
    };
    if (req.system) {
      body.systemInstruction = { parts: [{ text: req.system }] };
    }

    const res = await fetch(url, {
      method: "POST",
      // Key in a header, never the URL: query strings leak into logs/proxies.
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  },
};
