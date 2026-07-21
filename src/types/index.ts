export interface AnalysisResult {
  id: string;
  fileName: string;
  stats: {
    totalWords: number;
    uniqueWords: number;
    sentences: number;
    avgWordLength: number;
  };
  wordFrequency: { word: string; count: number }[];
  themes: Theme[];
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  cleanedText: string;
}

export interface Theme {
  name: string;
  description: string;
  keywords: string[];
  prevalence: number;
}

export interface SpecialistResult {
  reflectionQuality: "Emerging" | "Developing" | "Proficient" | "Exemplary";
  score: number;
  analysis: string;
  recommendations: string[];
  loopType: "Single Loop" | "Double Loop" | "Mixed";
}

export interface AnalysisState {
  status: "idle" | "uploading" | "processing" | "complete" | "error";
  results: AnalysisResult[];
  specialistResult?: SpecialistResult;
  currentView: "upload" | "dashboard" | "specialist";
}

export interface NLPStats {
  pos_tags: Record<string, number>;
  readability_scores: {
    flesch_kincaid: number;
    smog: number;
  };
  lexical_density: number;
}

// ---------------------------------------------------------------------------
// Phase 1: Ensemble reliability framework
// ---------------------------------------------------------------------------

export type LlmProvider = "fireworks" | "openai" | "anthropic" | "gemini" | "openrouter";

/** Configuration for a reproducible ensemble of LLM thematic-analysis runs. */
export interface RunConfig {
  /** Independent seeds, one run each. Defaults match the reference paper. */
  seeds: number[];
  /** Sampling temperature in [0, 2]. Lower = more deterministic. */
  temperature: number;
  /** Provider-specific model id, e.g. "accounts/fireworks/models/llama-v3-70b-instruct". */
  model: string;
  provider: LlmProvider;
  /** Custom prompt containing {seed}/{text_chunk}; undefined uses the default. */
  promptTemplate?: string;
  maxThemesPerRun?: number;
  /** Cosine threshold for treating two themes as the same equivalence class. */
  cosineThreshold?: number;
  /** Minimum fraction of runs a class must appear in to become a consensus theme. */
  minOccurrenceRatio?: number;
}

/** One independent thematic-analysis run. */
export interface ThemeRun {
  seed: number;
  themes: Theme[];
}

export type KappaBand =
  | "almost_perfect"
  | "substantial"
  | "moderate"
  | "fair"
  | "poor"
  | "insufficient_data";

export interface PairwiseScore {
  i: number;
  j: number;
}

export interface KappaResult {
  meanKappa: number;
  minKappa: number;
  maxKappa: number;
  pairwise: (PairwiseScore & { kappa: number })[];
  band: KappaBand;
}

export interface CosineResult {
  meanCosine: number;
  minCosine: number;
  maxCosine: number;
  pairwise: (PairwiseScore & { cosine: number })[];
  /** n x n run-pair similarity matrix for heatmap rendering. */
  matrix: number[][];
}

export type ConfidenceTier = "high" | "moderate";

export interface ConsensusTheme {
  label: string;
  description: string;
  keywords: string[];
  occurrence: number;
  runCount: number;
  consistency: number;
  tier: ConfidenceTier;
  memberCount: number;
}

export interface ConsensusResult {
  themes: ConsensusTheme[];
  totalRuns: number;
}

export interface ReliabilityReport {
  runCount: number;
  embeddingBackend: string;
  cosineThreshold: number;
  minOccurrenceRatio: number;
  consensus: ConsensusResult;
  kappa: KappaResult | null;
  cosine: CosineResult | null;
}

/** Full output of a single document's ensemble analysis. */
export interface EnsembleResult {
  id: string;
  fileName: string;
  config: RunConfig;
  stats: AnalysisResult["stats"];
  sentiment: AnalysisResult["sentiment"];
  wordFrequency: { word: string; count: number }[];
  cleanedText: string;
  runs: ThemeRun[];
  reliability: ReliabilityReport;
  /** True when themes came from the built-in demo generator (no LLM key). */
  demo: boolean;
}

/** One model's reliability summary for cross-model comparison. */
export interface ModelComparisonEntry {
  provider: LlmProvider;
  model: string;
  label: string;
  runCount: number;
  meanKappa: number | null;
  kappaBand: KappaBand;
  meanCosine: number | null;
  cosinePercent: number | null;
  consensusCount: number;
  highConfidenceCount: number;
  moderateConfidenceCount: number;
  error?: string;
  demo: boolean;
}

export interface ModelComparisonResult {
  entries: ModelComparisonEntry[];
  fileName: string;
  config: Omit<RunConfig, "provider" | "model">;
}

export interface DatasetDescriptor {
  id: string;
  path: string;
  type: string;
  title: string;
  summary: string;
  suggestedMethodology: string;
}

export interface DatasetIndex {
  version: number;
  description: string;
  datasets: DatasetDescriptor[];
}
