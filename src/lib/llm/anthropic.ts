import type { ChatAdapter, ChatRequest } from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUT_MS = 45_000;
const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";

function apiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

/**
 * Anthropic Messages API adapter. Note: Anthropic does not support the `seed`
 * parameter, so reproducibility across runs relies on temperature control only.
 * Default model: claude-3-5-sonnet-20241022.
 */
export const anthropicAdapter: ChatAdapter = {
  provider: "anthropic",
  isConfigured: () => Boolean(apiKey()),

  async complete(req: ChatRequest): Promise<string> {
    const key = apiKey();
    if (!key) throw new Error("Missing ANTHROPIC_API_KEY");

    const messages = [{ role: "user" as const, content: req.user }];

    const body: Record<string, unknown> = {
      model: req.model || DEFAULT_MODEL,
      max_tokens: req.maxTokens ?? 1000,
      messages,
    };
    if (req.system) body.system = req.system;
    if (req.temperature !== undefined) body.temperature = req.temperature;

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`Anthropic request failed: ${res.status}`);
    const data = await res.json();
    return data?.content?.[0]?.text ?? "";
  },
};
