import type { LlmProvider } from "@/types";
import type { ChatAdapter } from "./types";
import { fireworksAdapter } from "./fireworks";

/**
 * Provider registry. Phase 1 ships Fireworks only (the currently configured
 * provider). OpenAI / Anthropic / Gemini / OpenRouter adapters slot in here in
 * Phase 2 without changing call sites.
 */
const ADAPTERS: Partial<Record<LlmProvider, ChatAdapter>> = {
  fireworks: fireworksAdapter,
};

export function getChatAdapter(provider: LlmProvider): ChatAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new Error(
      `No adapter configured for provider "${provider}". Additional providers arrive in Phase 2.`
    );
  }
  return adapter;
}

export function isProviderConfigured(provider: LlmProvider): boolean {
  const adapter = ADAPTERS[provider];
  return Boolean(adapter?.isConfigured());
}
