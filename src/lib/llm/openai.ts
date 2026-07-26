import type { ChatAdapter, ChatRequest } from "./types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 45_000;
const DEFAULT_MODEL = "gpt-4o";

function apiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

/**
 * OpenAI adapter. Supports the `seed` parameter for reproducible variation.
 * Default model: gpt-4o.
 */
export const openaiAdapter: ChatAdapter = {
  provider: "openai",
  isConfigured: () => Boolean(apiKey()),

  async complete(req: ChatRequest): Promise<string> {
    const key = apiKey();
    if (!key) throw new Error("Missing OPENAI_API_KEY");

    const messages = [
      ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
      { role: "user" as const, content: req.user },
    ];

    const body: Record<string, unknown> = {
      model: req.model || DEFAULT_MODEL,
      messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens ?? 1000,
    };
    if (req.seed !== undefined) body.seed = req.seed;

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  },
};
