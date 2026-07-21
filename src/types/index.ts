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
  /** Optional supporting quotes returned by the LLM (evidence grounding). */
  supportingQuotes?: string[];
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

/** Provenance for one run: the full audit trail of how its themes were derived. */
export interface RunProvenance {
  seed: number;
  /** The exact prompt sent to the model (with {seed}/{text_chunk} substituted). */
  renderedPrompt: string;
  /** Raw model output before JSON parsing. Empty on failure. */
  rawResponse: string;
  /** "ok" | "parse_failed" | "request_failed". */
  status: "ok" | "parse_failed" | "request_failed";
  /** Error message when status !== "ok". */
  error?: string;
  /** Character length of the text chunk actually sent. */
  textChunkLength: number;
}

/** One independent thematic-analysis run, carrying its provenance. */
export interface ThemeRun {
  seed: number;
  themes: Theme[];
  provenance?: RunProvenance;
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

/** Provenance for one theme within an equivalence class (case-by-case audit). */
export interface ThemeLineageMember {
  runIndex: number;
  seed?: number | null;
  name: string;
  description: string;
  keywords: string[];
  /** Supporting quotes returned by the model for this run's theme variant. */
  quotes: string[];
  /** Cosine similarity of this member to the cluster medoid. */
  cosineToMedoid: number;
  /** True if this is the representative (most central) member. */
  isMedoid: boolean;
}

export interface ConsensusTheme {
  label: string;
  description: string;
  keywords: string[];
  occurrence: number;
  runCount: number;
  consistency: number;
  tier: ConfidenceTier;
  memberCount: number;
  /** Run indices that produced a theme in this equivalence class. */
  runsPresent: number[];
  /** Per-member derivation trail (which runs/seeds agreed, how strongly). */
  lineage: ThemeLineageMember[];
  /** Evidence spans retrieved from the source corpus (grounding). */
  evidence?: EvidenceSpan[];
}

/** A source-corpus span that supports a theme, with its similarity score. */
export interface EvidenceSpan {
  text: string;
  cosine: number;
  unitIndex: number;
}

export interface ConsensusResult {
  themes: ConsensusTheme[];
  totalRuns: number;
}

/** Records every transformation applied to the data (pipeline transparency). */
export interface PipelineTrace {
  /** Source character count before preprocessing. */
  inputChars: number;
  /** Cleaned-text character count after preprocessing. */
  cleanedChars: number;
  /** Character length of the chunk sent to the LLM (after truncation). */
  chunkChars: number;
  /** Whether stopwords/lemmatization were applied by the NLP service. */
  preprocessed: boolean;
  /** Embedding backend used for reliability (sentence-transformers | tfidf). */
  embeddingBackend: string;
  /** Reproducibility parameters, echoed for the manifest. */
  cosineThreshold: number;
  minOccurrenceRatio: number;
  temperature: number;
  seeds: number[];
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

/** A researcher's case-by-case judgement on a consensus theme. */
export interface ThemeAnnotation {
  /** "accepted" | "rejected" | "flagged" — researcher disposition. */
  status: "accepted" | "rejected" | "flagged";
  note: string;
  /** ISO timestamp of the annotation. */
  updatedAt: string;
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
  /** Every transformation applied to the data (pipeline transparency). */
  pipelineTrace: PipelineTrace;
  /** True when themes came from the built-in demo generator (no LLM key). */
  demo: boolean;
  /** Researcher annotations, keyed by consensus-theme label. Client-side only. */
  annotations?: Record<string, ThemeAnnotation>;
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
