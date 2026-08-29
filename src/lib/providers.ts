import type { LlmProvider } from "@/types";

/** Default model id per provider. */
export const PROVIDER_DEFAULT_MODEL: Record<LlmProvider, string> = {
  fireworks: "accounts/fireworks/models/glm-5p3",
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-20241022",
  gemini: "gemini-1.5-pro",
  openrouter: "openai/gpt-4o",
};

/** Human-friendly label for UI. */
export const PROVIDER_LABEL: Record<LlmProvider, string> = {
  fireworks: "Fireworks AI",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
};

/** Whether a provider supports the `seed` parameter for reproducible runs. */
export const PROVIDER_SUPPORTS_SEED: Record<LlmProvider, boolean> = {
  fireworks: true,
  openai: true,
  anthropic: false,
  gemini: false,
  openrouter: true,
};

export const ALL_PROVIDERS: LlmProvider[] = [
  "fireworks",
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
];
