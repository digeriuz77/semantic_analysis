import type { ReliabilityReport, ThemeRun } from "@/types";

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://localhost:8000";
const NLP_TIMEOUT_MS = 30_000;
const RELIABILITY_TIMEOUT_MS = 60_000;

/** Raised when the Python NLP service is unreachable or errors. */
export class NlpUnavailableError extends Error {
  readonly code = "NLP_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "NlpUnavailableError";
  }
}

export interface NlpProcessResponse {
  cleaned_text: string;
  stats: Record<string, number>;
  top_keywords: { word: string; count: number }[];
  sentiment?: { positive: number; neutral: number; negative: number };
}

export async function processFileViaNlp(file: File): Promise<NlpProcessResponse> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(`${NLP_SERVICE_URL}/process`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(NLP_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new NlpUnavailableError(`NLP service responded ${res.status}`);
    }
    return (await res.json()) as NlpProcessResponse;
  } catch (error) {
    if (error instanceof NlpUnavailableError) throw error;
    throw new NlpUnavailableError(
      "Could not reach the NLP service. Is the Python service running?"
    );
  }
}

export interface ReliabilityCallOptions {
  cosineThreshold?: number;
  minOccurrenceRatio?: number;
}

/** Call the Python reliability endpoint for kappa + cosine + consensus. */
export async function callReliability(
  runs: ThemeRun[],
  opts: ReliabilityCallOptions = {}
): Promise<ReliabilityReport> {
  const body = {
    runs: runs.map((r) => ({ themes: r.themes })),
    cosine_threshold: opts.cosineThreshold ?? 0.7,
    min_occurrence_ratio: opts.minOccurrenceRatio ?? 0.5,
  };
  const res = await fetch(`${NLP_SERVICE_URL}/reliability`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(RELIABILITY_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new NlpUnavailableError(`Reliability service responded ${res.status}`);
  }
  return (await res.json()) as ReliabilityReport;
}
