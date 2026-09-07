import type { ChatAdapter, ChatRequest } from "./types";

const DEFAULT_LOCAL_URL =
  process.env.LOCAL_LLM_URL || "http://localhost:8000/v1/chat/completions";
const DEFAULT_MODEL = process.env.LOCAL_LLM_MODEL || "qwen3";
const TIMEOUT_MS = 120_000;

function getEndpointUrl(): string {
  const url = process.env.LOCAL_LLM_URL || DEFAULT_LOCAL_URL;
  if (!url.endsWith("/chat/completions") && !url.includes("/chat/completions")) {
    return url.replace(/\/+$/, "") + "/chat/completions";
  }
  return url;
}

/**
 * Local LLM adapter for Lemonade Server, LM Studio, Ollama, LocalAI, vLLM running Qwen3 / Qwen models locally.
 * Connects via OpenAI-compatible chat completions REST API.
 */
export const localAdapter: ChatAdapter = {
  provider: "local",
  isConfigured: () => {
    // Configured if LOCAL_LLM_URL is defined or defaulted
    return Boolean(process.env.LOCAL_LLM_URL || DEFAULT_LOCAL_URL);
  },

  async complete(req: ChatRequest): Promise<string> {
    const url = getEndpointUrl();

    const messages = [
      ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
      { role: "user" as const, content: req.user },
    ];

    const body: Record<string, unknown> = {
      model: req.model || DEFAULT_MODEL,
      messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens ?? 3500,
    };
    if (req.seed !== undefined) {
      body.seed = req.seed;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.LOCAL_LLM_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.LOCAL_LLM_API_KEY}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const errBody = (await res.json()) as { error?: { message?: string } | string };
        const msg =
          typeof errBody?.error === "string" ? errBody.error : errBody?.error?.message;
        if (msg) detail = `: ${msg}`;
      } catch {
        /* non-JSON */
      }
      throw new Error(`Local LLM (Lemonade/Qwen3) request failed: ${res.status}${detail}`);
    }

    const data = await res.json();
    const msgObj = data?.choices?.[0]?.message;
    const content = msgObj?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content;
    }
    if (typeof msgObj?.reasoning_content === "string" && msgObj.reasoning_content.trim().length > 0) {
      return msgObj.reasoning_content;
    }
    return "";
  },
};
