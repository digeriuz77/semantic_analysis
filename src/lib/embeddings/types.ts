/** Embedding adapter contract — same pattern as the LLM ChatAdapter. */

export interface EmbedAdapter {
  provider: string;
  model: string;
  /** Dimensionality of the output vectors. */
  dim: number;
  isConfigured(): boolean;
  /**
   * Embed a batch of texts. Returns vectors aligned 1:1 with the input.
   * Implementations should batch sensibly (e.g. 100 texts per API call).
   */
  embed(texts: string[]): Promise<number[][]>;
}
