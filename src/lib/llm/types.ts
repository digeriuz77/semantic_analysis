import type { LlmProvider } from "@/types";

export interface ChatRequest {
  user: string;
  system?: string;
  temperature: number;
  maxTokens?: number;
  /** Reproducibility seed; providers that support it pass it through. */
  seed?: number;
  model: string;
}

export interface ChatAdapter {
  provider: LlmProvider;
  isConfigured(): boolean;
  complete(req: ChatRequest): Promise<string>;
}
