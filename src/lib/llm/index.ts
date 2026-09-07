import type { LlmProvider } from "@/types";
import type { ChatAdapter } from "./types";
import { fireworksAdapter } from "./fireworks";
import { localAdapter } from "./local";
import { openaiAdapter } from "./openai";
import { anthropicAdapter } from "./anthropic";
import { geminiAdapter } from "./gemini";
import { openrouterAdapter } from "./openrouter";

/**
 * Provider registry. All providers share the ChatAdapter contract.
 */
const ADAPTERS: Record<LlmProvider, ChatAdapter> = {
  fireworks: fireworksAdapter,
  local: localAdapter,
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  openrouter: openrouterAdapter,
};

export function getChatAdapter(provider: LlmProvider): ChatAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`No adapter configured for provider "${provider}".`);
  }
  return adapter;
}

export function isProviderConfigured(provider: LlmProvider): boolean {
  return ADAPTERS[provider].isConfigured();
}

export function getConfiguredProviders(): LlmProvider[] {
  return (Object.keys(ADAPTERS) as LlmProvider[]).filter(isProviderConfigured);
}
