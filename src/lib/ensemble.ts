import type { RunConfig, RunProvenance, Theme, ThemeRun } from "@/types";
import { getChatAdapter } from "./llm";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_THEMATIC_PROMPT, renderPrompt } from "./prompts";
import { parseJsonResponse, sanitizeThemes } from "./fireworks";

export const MAX_TEXT_CHARS = 8000;

export interface EnsembleOptions {
  text: string;
  config: RunConfig;
}

/**
 * Run the thematic-analysis ensemble: one independent LLM call per seed,
 * executed in parallel. Each run captures its full provenance (rendered prompt,
 * raw response, parse status) so the derivation of every theme is auditable
 * case-by-case. This is the foundation of the explainability layer.
 */
export async function runThematicEnsemble({
  text,
  config,
}: EnsembleOptions): Promise<ThemeRun[]> {
  const adapter = getChatAdapter(config.provider);
  const template = config.promptTemplate?.trim()
    ? config.promptTemplate
    : DEFAULT_THEMATIC_PROMPT;
  const textChunk = text.slice(0, MAX_TEXT_CHARS);
  const cap = config.maxThemesPerRun;

  const settled = await Promise.allSettled(
    config.seeds.map(
      async (seed): Promise<ThemeRun> => {
        const renderedPrompt = renderPrompt(template, seed, textChunk);
        let rawResponse = "";
        let status: RunProvenance["status"] = "ok";
        let error: string | undefined;
        let themes: Theme[] = [];

        try {
          rawResponse = await adapter.complete({
            user: renderedPrompt,
            system: DEFAULT_SYSTEM_PROMPT,
            temperature: config.temperature,
            seed,
            model: config.model,
            maxTokens: 1400,
          });
          themes = sanitizeThemes(parseJsonResponse<unknown>(rawResponse));
          if (themes.length === 0 && rawResponse.trim()) {
            status = "parse_failed";
          }
          if (cap && cap > 0) {
            themes = themes.slice(0, cap);
          }
        } catch (e) {
          status = "request_failed";
          error = e instanceof Error ? e.message : String(e);
        }

        const provenance: RunProvenance = {
          seed,
          renderedPrompt,
          rawResponse,
          status,
          error,
          textChunkLength: textChunk.length,
        };

        return { seed, themes, provenance };
      }
    )
  );

  return settled.map((result, index) => {
    const seed = config.seeds[index];
    if (result.status === "fulfilled") {
      return result.value;
    }
    // Promise rejection (adapter threw outside the inner try/catch) — record it.
    return {
      seed,
      themes: [],
      provenance: {
        seed,
        renderedPrompt: "",
        rawResponse: "",
        status: "request_failed" as const,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        textChunkLength: textChunk.length,
      },
    };
  });
}

/** Expose MAX_TEXT_CHARS so the orchestrator can build the pipeline trace. */
export function getTextChunkLength(text: string): number {
  return Math.min(text.length, MAX_TEXT_CHARS);
}
