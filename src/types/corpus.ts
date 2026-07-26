// ---------------------------------------------------------------------------
// Phase 5: Persistent corpus model (DNA-inspired statement atom)
//
// A STATEMENT is the atomic unit: an evidence span attributed to an actor,
// expressing a stance on a concept, at a point in time, optionally in a
// location. This is what unlocks temporal windows, entity comparison, and
// network analysis — themes summarize; statements are attributable, dated,
// traceable evidence you can iterate on.
// ---------------------------------------------------------------------------

export type DocumentSourceType =
  | "interview"
  | "survey"
  | "reflection"
  | "transcript"
  | "focus_group"
  | "field_note"
  | "feedback"
  | "other";

export interface CorpusDocument {
  id: number;
  fileName: string;
  sourceType: DocumentSourceType;
  title: string | null;
  content: string;
  cleanedText: string | null;
  createdAt: string;
  /** Date the document pertains to (ISO or YYYY-MM), not when it was ingested. */
  docDate: string | null;
  metadata: Record<string, unknown>;
  /** Derived: number of statements coded against this document. */
  statementCount?: number;
}

export type ActorType = "person" | "organization" | "location";

export interface Actor {
  id: number;
  name: string;
  type: ActorType;
  metadata: Record<string, unknown>;
  createdAt: string;
  statementCount?: number;
}

export interface Concept {
  id: number;
  name: string;
  description: string | null;
  frameworkId: string | null;
  color: string;
  createdAt: string;
  statementCount?: number;
}

export type Stance = "agree" | "disagree" | "neutral" | "undefined";

/** The DNA atom: traceable, attributable, dated evidence. */
export interface Statement {
  id: number;
  documentId: number;
  text: string;
  startOffset: number | null;
  endOffset: number | null;
  actorId: number | null;
  conceptId: number | null;
  stance: Stance;
  /** When the statement pertains to (ISO or partial date). */
  stmtDate: string | null;
  location: string | null;
  notes: string | null;
  source: "manual" | "ensemble" | "imported";
  codeRunId: number | null;
  createdAt: string;
  updatedAt: string;
  /** Joined fields (populated by list/detail queries). */
  actorName?: string | null;
  actorType?: ActorType | null;
  conceptName?: string | null;
  conceptColor?: string | null;
  documentTitle?: string | null;
  documentFileName?: string | null;
}

export interface StatementAnnotation {
  id: number;
  statementId: number;
  status: "accepted" | "rejected" | "flagged";
  note: string | null;
  updatedAt: string;
}

export interface CodeRun {
  id: number;
  documentId: number | null;
  frameworkId: string | null;
  config: Record<string, unknown>;
  result: Record<string, unknown>;
  status: "manual" | "ensemble" | "imported";
  createdAt: string;
}

/** Filter params for the statement list — the iterative workspace queries. */
export interface StatementFilter {
  documentId?: number;
  actorId?: number;
  conceptId?: number;
  stance?: Stance;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

/** Aggregate counts for a filter — powers comparison views. */
export interface StatementFacets {
  total: number;
  byActor: { actorId: number; name: string; type: ActorType; count: number }[];
  byConcept: { conceptId: number; name: string; color: string; count: number }[];
  byStance: Record<Stance, number>;
  byDate: { date: string; count: number }[];
  byLocation: { location: string; count: number }[];
}
