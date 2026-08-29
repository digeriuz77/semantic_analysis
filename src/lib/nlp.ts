import type { ConsensusTheme, EvidenceSpan, ReliabilityReport, ThemeRun } from "@/types";

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://localhost:8000";
const NLP_TIMEOUT_MS = 30_000;
const RELIABILITY_TIMEOUT_MS = 60_000;
const EVIDENCE_TIMEOUT_MS = 45_000;

/** Raised when the Python NLP service is unreachable or errors. */
export class NlpUnavailableError extends Error {
  readonly code = "NLP_UNAVAILABLE";
  /** HTTP status to surface (400/413 pass through from the service; else 503). */
  readonly status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "NlpUnavailableError";
    this.status = status >= 400 && status < 500 ? status : 503;
  }
}

/** Column metadata from POST /inspect (tabular files only). */
export interface InspectedColumn {
  index: number;
  name: string;
  type: "numeric" | "datetime" | "text" | "categorical";
  meanLength: number;
  distinctRatio: number;
  alphaRatio: number;
  emptyRatio: number;
  isText: boolean;
}

export interface InspectResponse {
  fileName: string;
  mode: "prose" | "tabular";
  delimiter?: string;
  encoding?: string;
  rowCount?: number;
  truncated?: boolean;
  columns?: InspectedColumn[];
  suggestedTextColumns?: number[];
}

/** Ask the service for file metadata (mode + column profile) before analysis. */
export async function inspectFile(file: File): Promise<InspectResponse> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(`${NLP_SERVICE_URL}/inspect`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(NLP_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
      throw new NlpUnavailableError(
        detail?.detail || `Inspect service responded ${res.status}`
      );
    }
    return (await res.json()) as InspectResponse;
  } catch (error) {
    if (error instanceof NlpUnavailableError) throw error;
    throw new NlpUnavailableError(
      "Could not reach the NLP service. Is the Python service running?"
    );
  }
}

/** A row-indexed analysis unit (tabular mode): one response with provenance. */
export interface AnalysisUnit {
  text: string;
  rowIndex: number;
  columnName: string;
}

export interface CsvMetadata {
  delimiter: string;
  encoding: string;
  rowCount: number;
  totalDataRows?: number;
  textColumns: number[];
  textColumnNames?: string[];
  skippedShortCells: number;
  truncatedRows: boolean;
}

export interface NlpProcessResponse {
  mode?: "prose" | "tabular";
  csv?: CsvMetadata;
  units?: AnalysisUnit[];
  cleaned_text: string;
  /** Punctuation-preserving extraction (used for evidence retrieval). */
  extracted_text?: string;
  stats: Record<string, number | string | null>;
  top_keywords: { word: string; count: number }[];
  sentiment?: {
    positive: number;
    neutral: number;
    negative: number;
    basis?: string;
  };
}

export async function processFileViaNlp(
  file: File,
  textColumns?: number[]
): Promise<NlpProcessResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (textColumns && textColumns.length > 0) {
    formData.append("text_columns", JSON.stringify(textColumns));
  }
  try {
    const res = await fetch(`${NLP_SERVICE_URL}/process`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(NLP_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new NlpUnavailableError(
          detail?.detail || `NLP service responded ${res.status}`,
          res.status
        );
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
    runs: runs.map((r) => ({ seed: r.seed, themes: r.themes })),
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

/**
 * Retrieve supporting source spans for a set of themes via the Python /evidence
 * endpoint. Two modes: tabular (pre-split `units` — spans cite row/column) or
 * prose (`text` — sentence retrieval). Gracefully returns empty arrays if the
 * service is unavailable (evidence is best-effort enrichment, not blocking).
 */
export async function callEvidence(
  text: string,
  themes: { name: string; description: string }[],
  topK = 3,
  units?: AnalysisUnit[]
): Promise<EvidenceSpan[][]> {
  if (themes.length === 0) return [];
  const body: Record<string, unknown> = units
    ? { units, themes, top_k: topK }
    : { text, themes, top_k: topK };
  try {
    const res = await fetch(`${NLP_SERVICE_URL}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(EVIDENCE_TIMEOUT_MS),
    });
    if (!res.ok) return themes.map(() => []);
    const data = (await res.json()) as { evidence: EvidenceSpan[][] };
    return data.evidence ?? themes.map(() => []);
  } catch {
    return themes.map(() => []);
  }
}

/** Attach retrieved evidence spans onto each consensus theme in place. */
export async function enrichConsensusWithEvidence(
  text: string,
  consensus: ConsensusTheme[],
  units?: AnalysisUnit[]
): Promise<void> {
  if (consensus.length === 0) return;
  const themes = consensus.map((c) => ({ name: c.label, description: c.description }));
  const evidence = await callEvidence(text, themes, 3, units);
  consensus.forEach((c, i) => {
    c.evidence = evidence[i] ?? [];
  });
}
