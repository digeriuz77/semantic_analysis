import type { RunConfig, RunProvenance, Theme, ThemeRun } from "@/types";
import { getChatAdapter } from "./llm";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_THEMATIC_PROMPT, renderPrompt } from "./prompts";
import { parseJsonResponse, sanitizeThemes } from "./fireworks";

/** Max characters per LLM call (chunk). */
export const MAX_TEXT_CHARS = 8000;
/** Max chunks analyzed per run; input beyond this is honestly truncated. Supports up to ~190k chars. */
export const MAX_CHUNKS = 24;

export interface EnsembleOptions {
  text: string;
  config: RunConfig;
  /**
   * Pre-split analysis units (tabular mode: one per source row). When present,
   * chunks are packed from whole units — a response is never split mid-row —
   * instead of word-boundary splitting the joined text.
   */
  segments?: string[];
}

/** Result of chunking a long document for per-run analysis. */
export interface ChunkPlan {
  chunks: string[];
  /** True when the input exceeded the chunk budget and was cut. */
  truncated: boolean;
  /** Total characters actually analyzed across all chunks. */
  analyzedChars: number;
}

/**
 * Split text into word-boundary chunks of at most maxChunkChars, capped at
 * maxChunks. Longer documents are analyzed chunk-by-chunk per run and the
 * per-chunk themes merged, instead of silently analyzing only the first 2k
 * tokens of a 45-minute interview.
 */
export function chunkText(
  text: string,
  maxChunkChars = MAX_TEXT_CHARS,
  maxChunks = MAX_CHUNKS
): ChunkPlan {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { chunks: [], truncated: false, analyzedChars: 0 };
  }
  if (trimmed.length <= maxChunkChars) {
    return { chunks: [trimmed], truncated: false, analyzedChars: trimmed.length };
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  let consumedAll = true;

  const flush = () => {
    chunks.push(current.join(" "));
    current = [];
    currentLen = 0;
  };

  for (const word of trimmed.split(/\s+/)) {
    // Pathological single token (base64 blob, minified js): hard-split.
    if (word.length > maxChunkChars) {
      let rest = word;
      while (rest.length > 0) {
        const room = maxChunkChars - currentLen - (current.length > 0 ? 1 : 0);
        if (room <= 0 && current.length > 0) {
          if (chunks.length === maxChunks) {
            consumedAll = false;
            return finish();
          }
          flush();
          continue;
        }
        const take = Math.min(rest.length, Math.max(room, 0));
        current.push(rest.slice(0, take));
        currentLen += take + (current.length > 1 ? 1 : 0);
        rest = rest.slice(take);
        if (currentLen >= maxChunkChars) {
          if (chunks.length === maxChunks) {
            consumedAll = false;
            return finish();
          }
          flush();
        }
      }
      continue;
    }

    const add = current.length === 0 ? word.length : word.length + 1;
    if (currentLen + add > maxChunkChars && current.length > 0) {
      if (chunks.length === maxChunks) {
        consumedAll = false;
        break;
      }
      flush();
    }
    current.push(word);
    currentLen += add;
  }
  return finish();

  function finish(): ChunkPlan {
    if (current.length > 0 && chunks.length < maxChunks) {
      chunks.push(current.join(" "));
    }
    const analyzedChars = chunks.reduce((s, c) => s + c.length, 0);
    return { chunks, truncated: !consumedAll, analyzedChars };
  }
}

/**
 * Pack whole analysis units (e.g. one CSV response per unit) into chunks.
 * A unit is never split across chunks (row integrity for the LLM); a single
 * unit longer than the chunk limit is hard-split as a last resort. Units are
 * separated by a blank line so per-response boundaries reach the model.
 */
export function chunkSegments(
  units: string[],
  maxChunkChars = MAX_TEXT_CHARS,
  maxChunks = MAX_CHUNKS
): ChunkPlan {
  const cleaned = units.map((u) => u.trim()).filter((u) => u.length > 0);
  if (cleaned.length === 0) {
    return { chunks: [], truncated: false, analyzedChars: 0 };
  }

  const chunks: string[] = [];
  let current = "";
  let consumedAll = true;
  const SEP = "\n\n";

  for (const unit of cleaned) {
    if (unit.length > maxChunkChars) {
      // Pathological unit: hard-split it across chunk-sized pieces.
      let rest = unit;
      while (rest.length > 0) {
        const room = maxChunkChars - current.length - (current ? SEP.length : 0);
        if (room <= 0 && current) {
          if (chunks.length === maxChunks) {
            consumedAll = false;
            return finalize();
          }
          chunks.push(current);
          current = "";
          continue;
        }
        const take = Math.min(rest.length, Math.max(room, 0));
        current = current ? current + SEP + rest.slice(0, take) : rest.slice(0, take);
        rest = rest.slice(take);
        if (current.length >= maxChunkChars) {
          if (chunks.length === maxChunks) {
            consumedAll = false;
            return finalize();
          }
          chunks.push(current);
          current = "";
        }
      }
      continue;
    }

    const candidate = current ? current + SEP + unit : unit;
    if (candidate.length > maxChunkChars) {
      if (chunks.length === maxChunks) {
        consumedAll = false;
        break;
      }
      chunks.push(current);
      current = unit;
    } else {
      current = candidate;
    }
  }
  return finalize();

  function finalize(): ChunkPlan {
    if (current && chunks.length < maxChunks) {
      chunks.push(current);
    } else if (current) {
      consumedAll = false;
    }
    const analyzedChars = chunks.reduce((s, c) => s + c.length, 0);
    return { chunks, truncated: !consumedAll, analyzedChars };
  }
}

/** Merge themes from multiple chunks of one run, deduping by normalized name. */
function mergeThemes(themeLists: Theme[][]): Theme[] {
  const merged: Theme[] = [];
  const byName = new Map<string, number>();
  for (const themes of themeLists) {
    for (const theme of themes) {
      const key = theme.name.trim().toLowerCase();
      const existingIdx = byName.get(key);
      if (existingIdx === undefined) {
        byName.set(key, merged.length);
        merged.push(theme);
      } else {
        const existing = merged[existingIdx];
        merged[existingIdx] = {
          ...existing,
          keywords: Array.from(new Set([...existing.keywords, ...theme.keywords])),
          supportingQuotes: Array.from(
            new Set([...(existing.supportingQuotes ?? []), ...(theme.supportingQuotes ?? [])])
          ).slice(0, 6),
        };
      }
    }
  }
  return merged;
}

/**
 * Run the thematic-analysis ensemble: one independent LLM run per seed,
 * executed in parallel. Long documents are split into chunks; each seed
 * analyzes every chunk sequentially and its themes are merged. Each run
 * captures its full provenance (rendered prompt, raw response, parse status)
 * so the derivation of every theme is auditable case-by-case. This is the
 * foundation of the explainability layer.
 */
export async function runThematicEnsemble({
  text,
  config,
  segments,
}: EnsembleOptions): Promise<ThemeRun[]> {
  const adapter = getChatAdapter(config.provider);
  const template = config.promptTemplate?.trim()
    ? config.promptTemplate
    : DEFAULT_THEMATIC_PROMPT;
  const plan = segments && segments.length > 0 ? chunkSegments(segments) : chunkText(text);
  const cap = config.maxThemesPerRun;

  const settled = await Promise.allSettled(
    config.seeds.map(
      async (seed): Promise<ThemeRun> =>
        runOneSeed({ adapter, template, plan, seed, config, cap })
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
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        textChunkLength: plan.analyzedChars,
      },
    };
  });
}

export interface AdaptiveEnsembleResult {
  runs: ThemeRun[];
  /** True when the ensemble stopped before exhausting all seeds. */
  stoppedEarly: boolean;
}

/**
 * Adaptive ensemble: run seeds sequentially and stop early once two
 * consecutive *successful* runs add no new theme names (an exact-name
 * discovery plateau) after at least 3 successful runs. Saves LLM spend on
 * corpora that saturate quickly. Failed runs never count toward the plateau:
 * they add no names, but absence of themes from a failed request is not
 * evidence of saturation (two API failures must not stop the ensemble).
 * Trade-off: no parallelism, so wall time is proportional to runs executed.
 */
export async function runAdaptiveEnsemble({
  text,
  config,
  segments,
}: EnsembleOptions): Promise<AdaptiveEnsembleResult> {
  const adapter = getChatAdapter(config.provider);
  const template = config.promptTemplate?.trim()
    ? config.promptTemplate
    : DEFAULT_THEMATIC_PROMPT;
  const plan = segments && segments.length > 0 ? chunkSegments(segments) : chunkText(text);
  const cap = config.maxThemesPerRun;

  const runs: ThemeRun[] = [];
  const seenNames = new Set<string>();
  let successfulRuns = 0;
  let runsSinceNewTheme = 0;

  for (const seed of config.seeds) {
    const run = await runOneSeed({ adapter, template, plan, seed, config, cap });
    runs.push(run);
    const failed = run.provenance?.status !== undefined && run.provenance.status !== "ok";
    if (failed) continue;

    successfulRuns += 1;
    const newNames = run.themes
      .map((t) => t.name.trim().toLowerCase())
      .filter((n) => n.length > 0 && !seenNames.has(n));
    if (newNames.length > 0) {
      newNames.forEach((n) => seenNames.add(n));
      runsSinceNewTheme = 0;
    } else {
      runsSinceNewTheme += 1;
    }
    if (successfulRuns >= 3 && runsSinceNewTheme >= 2) {
      return { runs, stoppedEarly: true };
    }
  }
  return { runs, stoppedEarly: false };
}

interface RunOneSeedArgs {
  adapter: ReturnType<typeof getChatAdapter>;
  template: string;
  plan: ChunkPlan;
  seed: number;
  config: RunConfig;
  cap?: number;
}

/** One seeded run: analyze every chunk, merge themes, record provenance. */
async function runOneSeed({
  adapter,
  template,
  plan,
  seed,
  config,
  cap,
}: RunOneSeedArgs): Promise<ThemeRun> {
  const themeLists: Theme[][] = [];
  const renderedPrompts: string[] = [];
  const rawResponses: string[] = [];
  let error: string | undefined;

  const chunkResults = await Promise.all(
    plan.chunks.map(async (chunk, i) => {
      const renderedPrompt = renderPrompt(template, seed, chunk, config.researchQuestion);
      try {
        const rawResponse = await adapter.complete({
          user: renderedPrompt,
          system: DEFAULT_SYSTEM_PROMPT,
          temperature: config.temperature,
          seed,
          model: config.model,
          maxTokens: 4000,
        });
        let themes = sanitizeThemes(parseJsonResponse<unknown>(rawResponse));
        if (cap && cap > 0) {
          themes = themes.slice(0, cap);
        }
        return { prompt: renderedPrompt, response: rawResponse, themes, error: undefined };
      } catch (e) {
        const errStr = e instanceof Error ? e.message : String(e);
        return { prompt: renderedPrompt, response: "", themes: [], error: errStr };
      }
    })
  );

  for (const res of chunkResults) {
    renderedPrompts.push(res.prompt);
    rawResponses.push(res.response);
    if (res.themes.length > 0) {
      themeLists.push(res.themes);
    }
    if (res.error && !error) {
      error = res.error;
    }
  }

  const themes = mergeThemes(themeLists);
  let status: RunProvenance["status"] = "ok";
  if (themes.length > 0) {
    status = "ok";
  } else if (error) {
    status = "request_failed";
  } else if (plan.chunks.length > 0) {
    status = "parse_failed";
    error = "No themes parsed from any chunk.";
  }

  const provenance: RunProvenance = {
    seed,
    renderedPrompt: renderedPrompts.join("\n\n--- CHUNK BOUNDARY ---\n\n"),
    rawResponse: rawResponses.join("\n\n--- CHUNK BOUNDARY ---\n\n"),
    status,
    error,
    textChunkLength: plan.analyzedChars,
    chunkCount: plan.chunks.length,
  };

  return { seed, themes, provenance };
}

/**
 * Drop runs whose LLM request or JSON parse failed. A failed run carries no
 * themes, and feeding it into the reliability engine would count it as a
 * rater: it deflates min-occurrence consensus thresholds and drags run-centroid
 * cosine toward 0. Runs without provenance (demo mode, legacy payloads) pass.
 */
export function filterSuccessfulRuns(runs: ThemeRun[]): ThemeRun[] {
  return runs.filter((r) => !r.provenance || r.provenance.status === "ok");
}
