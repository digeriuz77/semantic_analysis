import type { RunConfig, Theme, ThemeRun } from "@/types";
import { getChatAdapter } from "./llm";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_THEMATIC_PROMPT, renderPrompt } from "./prompts";
import { parseJsonResponse, sanitizeThemes } from "./fireworks";

const MAX_TEXT_CHARS = 8000;

export interface EnsembleOptions {
  text: string;
  config: RunConfig;
}

/**
 * Run the thematic-analysis ensemble: one independent LLM call per seed,
 * executed in parallel. Each run uses the same prompt framework with the seed
 * substituted in, producing reproducible variation for reliability measurement.
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
    config.seeds.map(async (seed): Promise<ThemeRun> => {
      const prompt = renderPrompt(template, seed, textChunk);
      const content = await adapter.complete({
        user: prompt,
        system: DEFAULT_SYSTEM_PROMPT,
        temperature: config.temperature,
        seed,
        model: config.model,
        maxTokens: 1400,
      });
      let themes: Theme[] = sanitizeThemes(parseJsonResponse<unknown>(content));
      if (cap && cap > 0) {
        themes = themes.slice(0, cap);
      }
      return { seed, themes };
    })
  );

  return settled.map((result, index) => {
    const seed = config.seeds[index];
    if (result.status === "fulfilled") {
      return result.value;
    }
    // A failed run contributes no themes but is still counted in runCount,
    // which correctly penalises reliability for instability.
    return { seed, themes: [] };
  });
}
