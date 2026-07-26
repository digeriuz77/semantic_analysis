import type { EmbedAdapter } from "./types";
import { googleEmbedAdapter } from "./google";

const ADAPTERS: Record<string, EmbedAdapter> = {
  google: googleEmbedAdapter,
};

/** Return the first configured embedding adapter, or null (→ lexical fallback). */
export function getEmbedAdapter(): EmbedAdapter | null {
  for (const adapter of Object.values(ADAPTERS)) {
    if (adapter.isConfigured()) return adapter;
  }
  return null;
}

export function isEmbedConfigured(): boolean {
  return getEmbedAdapter() !== null;
}

/** L2-normalize a vector. */
export function normalize(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

/** Cosine similarity for two equal-length pre-normalized vectors. */
export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
