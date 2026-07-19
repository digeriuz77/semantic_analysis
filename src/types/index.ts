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