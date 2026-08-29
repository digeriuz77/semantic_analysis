import type { ChatAdapter, ChatRequest } from "./types";

const FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions";
const TIMEOUT_MS = 45_000;

function apiKey(): string | undefined {
  return process.env.FIREWORKS_API_KEY;
}

/**
 * Fireworks AI adapter (OpenAI-compatible chat completions). Supports the
 * `seed` parameter for reproducible variation across ensemble runs. Additional
 * providers (OpenAI, Anthropic, Gemini, OpenRouter) are added in Phase 2 via
 * the same ChatAdapter contract.
 */
export const fireworksAdapter: ChatAdapter = {
  provider: "fireworks",
  isConfigured: () => Boolean(apiKey()),

  async complete(req: ChatRequest): Promise<string> {
    const key = apiKey();
    if (!key) {
      throw new Error("Missing FIREWORKS_API_KEY");
    }

    const messages = [
      ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
      { role: "user" as const, content: req.user },
    ];

    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens ?? 1000,
    };
    if (req.seed !== undefined) {
      body.seed = req.seed;
    }

    const res = await fetch(FIREWORKS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      // Surface the provider's own message (invalid key, onboarding required,
      // rate limit) so deployment misconfiguration is diagnosable from the
      // per-run provenance panel instead of a bare status code.
      let detail = "";
      try {
        const errBody = (await res.json()) as { error?: { message?: string } | string };
        const msg =
          typeof errBody?.error === "string" ? errBody.error : errBody?.error?.message;
        if (msg) detail = `: ${msg}`;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(`Fireworks request failed: ${res.status}${detail}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  },
};
