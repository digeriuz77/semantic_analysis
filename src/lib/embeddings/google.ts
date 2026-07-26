import type { EmbedAdapter } from "./types";

const BATCH_SIZE = 100;
const TIMEOUT_MS = 30_000;

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

/**
 * Google text-embedding-004 adapter. Produces 768-dimensional vectors.
 * Requires GEMINI_API_KEY (same key used for Gemini LLM). The batch endpoint
 * embeds up to 100 texts per call.
 *
 * Task type RETRIEVAL_DOCUMENT is used for storage; RETRIEVAL_QUERY for search.
 */
export const googleEmbedAdapter: EmbedAdapter = {
  provider: "google",
  model: "text-embedding-004",
  dim: 768,
  isConfigured: () => Boolean(apiKey()),

  async embed(texts: string[]): Promise<number[][]> {
    const key = apiKey();
    if (!key) throw new Error("Missing GEMINI_API_KEY for embeddings");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${key}`;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const isQuery = batch.length === 1;
      const body = {
        requests: batch.map((text) => ({
          model: "models/text-embedding-004",
          content: { parts: [{ text: text.slice(0, 2048) }] },
          taskType: isQuery ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
        })),
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Google embedding request failed: ${res.status} ${detail.slice(0, 200)}`);
      }

      const data = (await res.json()) as { embeddings: { values: number[] }[] };
      for (const e of data.embeddings) {
        results.push(e.values);
      }
    }

    return results;
  },
};
