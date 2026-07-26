import { getDb, type DbClient } from "./client";
import type {
  Actor,
  ActorType,
  Concept,
  CorpusDocument,
  DocumentSourceType,
  Statement,
  StatementAnnotation,
  StatementFacets,
  StatementFilter,
  Stance,
} from "@/types/corpus";

type Row = Record<string, unknown>;

function parseJSON<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface CreateDocumentInput {
  fileName: string;
  sourceType: DocumentSourceType;
  title?: string | null;
  content: string;
  cleanedText?: string | null;
  docDate?: string | null;
  metadata?: Record<string, unknown>;
}

function rowToDocument(r: Row): CorpusDocument {
  return {
    id: Number(r.id),
    fileName: String(r.fileName),
    sourceType: String(r.sourceType) as DocumentSourceType,
    title: (r.title as string) ?? null,
    content: String(r.content),
    cleanedText: (r.cleanedText as string) ?? null,
    createdAt: String(r.createdAt),
    docDate: (r.docDate as string) ?? null,
    metadata: parseJSON(r.metadata, {}),
    statementCount: r.statementCount !== undefined ? Number(r.statementCount) : undefined,
  };
}

export function createDocument(input: CreateDocumentInput): CorpusDocument {
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO documents (fileName, sourceType, title, content, cleanedText, docDate, metadata, createdAt)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      input.fileName,
      input.sourceType,
      input.title ?? null,
      input.content,
      input.cleanedText ?? null,
      input.docDate ?? null,
      JSON.stringify(input.metadata ?? {}),
      now()
    );
  return getDocument(Number(r.lastInsertRowid))!;
}

export function listDocuments(): CorpusDocument[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.*, (SELECT COUNT(*) FROM statements s WHERE s.documentId = d.id) AS statementCount
       FROM documents d ORDER BY d.createdAt DESC`
    )
    .all();
  return rows.map(rowToDocument);
}

export function getDocument(id: number): CorpusDocument | undefined {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT d.*, (SELECT COUNT(*) FROM statements s WHERE s.documentId = d.id) AS statementCount
       FROM documents d WHERE d.id = ?`
    )
    .get(id);
  return row ? rowToDocument(row) : undefined;
}

export function deleteDocument(id: number): void {
  getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

function rowToActor(r: Row): Actor {
  return {
    id: Number(r.id),
    name: String(r.name),
    type: String(r.type) as ActorType,
    metadata: parseJSON(r.metadata, {}),
    createdAt: String(r.createdAt),
    statementCount: r.statementCount !== undefined ? Number(r.statementCount) : undefined,
  };
}

export function listActors(): Actor[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, (SELECT COUNT(*) FROM statements s WHERE s.actorId = a.id) AS statementCount
       FROM actors a ORDER BY a.name`
    )
    .all();
  return rows.map(rowToActor);
}

/** Upsert by (name, type). Returns the actor id. */
export function upsertActor(name: string, type: ActorType = "person"): number {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM actors WHERE name = ? AND type = ?")
    .get(name, type);
  if (existing) return Number(existing.id);
  const r = db
    .prepare("INSERT INTO actors (name, type, metadata, createdAt) VALUES (?,?,?,?)")
    .run(name, type, "{}", now());
  return Number(r.lastInsertRowid);
}

export function deleteActor(id: number): void {
  getDb().prepare("DELETE FROM actors WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Concepts
// ---------------------------------------------------------------------------

function rowToConcept(r: Row): Concept {
  return {
    id: Number(r.id),
    name: String(r.name),
    description: (r.description as string) ?? null,
    frameworkId: (r.frameworkId as string) ?? null,
    color: String(r.color ?? "#0d9488"),
    createdAt: String(r.createdAt),
    statementCount: r.statementCount !== undefined ? Number(r.statementCount) : undefined,
  };
}

export function listConcepts(): Concept[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM statements s WHERE s.conceptId = c.id) AS statementCount
       FROM concepts c ORDER BY c.name`
    )
    .all();
  return rows.map(rowToConcept);
}

/** Upsert by name. Returns the concept id. */
export function upsertConcept(
  name: string,
  opts?: { description?: string; frameworkId?: string; color?: string }
): number {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM concepts WHERE name = ?").get(name);
  if (existing) return Number(existing.id);
  const r = db
    .prepare("INSERT INTO concepts (name, description, frameworkId, color, createdAt) VALUES (?,?,?,?,?)")
    .run(
      name,
      opts?.description ?? null,
      opts?.frameworkId ?? null,
      opts?.color ?? "#0d9488",
      now()
    );
  return Number(r.lastInsertRowid);
}

export function deleteConcept(id: number): void {
  getDb().prepare("DELETE FROM concepts WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export interface CreateStatementInput {
  documentId: number;
  text: string;
  startOffset?: number | null;
  endOffset?: number | null;
  actorId?: number | null;
  actorName?: string;
  actorType?: ActorType;
  conceptId?: number | null;
  conceptName?: string;
  stance?: Stance;
  stmtDate?: string | null;
  location?: string | null;
  notes?: string | null;
  source?: "manual" | "ensemble" | "imported";
  codeRunId?: number | null;
}

function rowToStatement(r: Row): Statement {
  return {
    id: Number(r.id),
    documentId: Number(r.documentId),
    text: String(r.text),
    startOffset: r.startOffset === null ? null : Number(r.startOffset),
    endOffset: r.endOffset === null ? null : Number(r.endOffset),
    actorId: r.actorId === null ? null : Number(r.actorId),
    conceptId: r.conceptId === null ? null : Number(r.conceptId),
    stance: (String(r.stance ?? "undefined") as Stance),
    stmtDate: (r.stmtDate as string) ?? null,
    location: (r.location as string) ?? null,
    notes: (r.notes as string) ?? null,
    source: (String(r.source ?? "manual") as Statement["source"]),
    codeRunId: r.codeRunId === null ? null : Number(r.codeRunId),
    createdAt: String(r.createdAt),
    updatedAt: String(r.updatedAt),
    actorName: (r.actorName as string) ?? null,
    actorType: (r.actorType as ActorType) ?? null,
    conceptName: (r.conceptName as string) ?? null,
    conceptColor: (r.conceptColor as string) ?? null,
    documentTitle: (r.documentTitle as string) ?? null,
    documentFileName: (r.documentFileName as string) ?? null,
  };
}

const STATEMENT_SELECT = `
  SELECT s.*, a.name AS actorName, a.type AS actorType,
         c.name AS conceptName, c.color AS conceptColor,
         d.title AS documentTitle, d.fileName AS documentFileName
  FROM statements s
  LEFT JOIN actors a ON a.id = s.actorId
  LEFT JOIN concepts c ON c.id = s.conceptId
  LEFT JOIN documents d ON d.id = s.documentId
`;

export function createStatement(input: CreateStatementInput): Statement {
  const db = getDb();
  const actorId =
    input.actorId ?? (input.actorName ? upsertActor(input.actorName, input.actorType ?? "person") : null);
  const conceptId =
    input.conceptId ?? (input.conceptName ? upsertConcept(input.conceptName) : null);
  const ts = now();
  const r = db
    .prepare(
      `INSERT INTO statements
        (documentId, text, startOffset, endOffset, actorId, conceptId, stance,
         stmtDate, location, notes, source, codeRunId, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      input.documentId,
      input.text,
      input.startOffset ?? null,
      input.endOffset ?? null,
      actorId,
      conceptId,
      input.stance ?? "undefined",
      input.stmtDate ?? null,
      input.location ?? null,
      input.notes ?? null,
      input.source ?? "manual",
      input.codeRunId ?? null,
      ts,
      ts
    );
  return getStatement(Number(r.lastInsertRowid))!;
}

export function getStatement(id: number): Statement | undefined {
  const db = getDb();
  const row = db.prepare(`${STATEMENT_SELECT} WHERE s.id = ?`).get(id);
  return row ? rowToStatement(row) : undefined;
}

export function listStatements(filter: StatementFilter = {}): Statement[] {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.documentId !== undefined) {
    where.push("s.documentId = ?");
    params.push(filter.documentId);
  }
  if (filter.actorId !== undefined) {
    where.push("s.actorId = ?");
    params.push(filter.actorId);
  }
  if (filter.conceptId !== undefined) {
    where.push("s.conceptId = ?");
    params.push(filter.conceptId);
  }
  if (filter.stance) {
    where.push("s.stance = ?");
    params.push(filter.stance);
  }
  if (filter.location) {
    where.push("s.location LIKE ?");
    params.push(`%${filter.location}%`);
  }
  if (filter.dateFrom) {
    where.push("s.stmtDate >= ?");
    params.push(filter.dateFrom);
  }
  if (filter.dateTo) {
    where.push("s.stmtDate <= ?");
    params.push(filter.dateTo);
  }
  if (filter.search) {
    where.push("(s.text LIKE ? OR s.notes LIKE ?)");
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(`${STATEMENT_SELECT} ${clause} ORDER BY s.stmtDate IS NULL, s.stmtDate, s.id`)
    .all(...params);
  return rows.map(rowToStatement);
}

export function updateStatement(
  id: number,
  patch: Partial<Omit<CreateStatementInput, "documentId" | "text">> & {
    text?: string;
    actorId?: number | null;
    conceptId?: number | null;
    actorName?: string;
    conceptName?: string;
  }
): Statement | undefined {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  const maybe = (col: string, val: unknown) => {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(val);
    }
  };

  maybe("text", patch.text);
  if (patch.actorName !== undefined) {
    patch.actorId = patch.actorName
      ? upsertActor(patch.actorName, patch.actorType ?? "person")
      : null;
  }
  if (patch.conceptName !== undefined) {
    patch.conceptId = patch.conceptName ? upsertConcept(patch.conceptName) : null;
  }
  maybe("actorId", patch.actorId);
  maybe("conceptId", patch.conceptId);
  maybe("stance", patch.stance);
  maybe("stmtDate", patch.stmtDate);
  maybe("location", patch.location);
  maybe("notes", patch.notes);

  if (sets.length === 0) return getStatement(id);
  sets.push("updatedAt = ?");
  params.push(now());
  params.push(id);
  db.prepare(`UPDATE statements SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getStatement(id);
}

export function deleteStatement(id: number): void {
  getDb().prepare("DELETE FROM statements WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Annotations (researcher judgements — now persisted, not localStorage)
// ---------------------------------------------------------------------------

export function getAnnotation(statementId: number): StatementAnnotation | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM statement_annotations WHERE statementId = ?")
    .get(statementId);
  if (!row) return undefined;
  const r = row as Row;
  return {
    id: Number(r.id),
    statementId: Number(r.statementId),
    status: String(r.status) as StatementAnnotation["status"],
    note: (r.note as string) ?? null,
    updatedAt: String(r.updatedAt),
  };
}

export function upsertAnnotation(
  statementId: number,
  status: "accepted" | "rejected" | "flagged",
  note: string | null
): StatementAnnotation {
  const db = getDb();
  const ts = now();
  const existing = db
    .prepare("SELECT id FROM statement_annotations WHERE statementId = ?")
    .get(statementId);
  if (existing) {
    db.prepare("UPDATE statement_annotations SET status = ?, note = ?, updatedAt = ? WHERE id = ?").run(
      status,
      note,
      ts,
      Number((existing as Row).id)
    );
  } else {
    db.prepare(
      "INSERT INTO statement_annotations (statementId, status, note, updatedAt) VALUES (?,?,?,?)"
    ).run(statementId, status, note, ts);
  }
  return getAnnotation(statementId)!;
}

// ---------------------------------------------------------------------------
// Facets (aggregate counts for a filter — powers comparison views)
// ---------------------------------------------------------------------------

const STANCE_VALUES: Stance[] = ["agree", "disagree", "neutral", "undefined"];

export function computeFacets(filter: StatementFilter = {}): StatementFacets {
  const stmts = listStatements(filter);
  const byActorMap = new Map<string, { actorId: number; name: string; type: ActorType; count: number }>();
  const byConceptMap = new Map<string, { conceptId: number; name: string; color: string; count: number }>();
  const byStance: Record<Stance, number> = { agree: 0, disagree: 0, neutral: 0, undefined: 0 };
  const byDateMap = new Map<string, number>();
  const byLocationMap = new Map<string, number>();

  for (const s of stmts) {
    byStance[s.stance]++;
    if (s.actorId && s.actorName) {
      const k = String(s.actorId);
      const e = byActorMap.get(k);
      if (e) e.count++;
      else
        byActorMap.set(k, {
          actorId: s.actorId,
          name: s.actorName,
          type: s.actorType ?? "person",
          count: 1,
        });
    }
    if (s.conceptId && s.conceptName) {
      const k = String(s.conceptId);
      const e = byConceptMap.get(k);
      if (e) e.count++;
      else
        byConceptMap.set(k, {
          conceptId: s.conceptId,
          name: s.conceptName,
          color: s.conceptColor ?? "#0d9488",
          count: 1,
        });
    }
    if (s.stmtDate) {
      const dateKey = s.stmtDate.slice(0, 10);
      byDateMap.set(dateKey, (byDateMap.get(dateKey) ?? 0) + 1);
    }
    if (s.location) {
      byLocationMap.set(s.location, (byLocationMap.get(s.location) ?? 0) + 1);
    }
  }

  return {
    total: stmts.length,
    byActor: [...byActorMap.values()].sort((a, b) => b.count - a.count),
    byConcept: [...byConceptMap.values()].sort((a, b) => b.count - a.count),
    byStance,
    byDate: [...byDateMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byLocation: [...byLocationMap.entries()]
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// Expose for tests
export const _internal = { STANCE_VALUES, rowToStatement, rowToDocument };
export type { DbClient };
