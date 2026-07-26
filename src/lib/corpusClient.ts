"use client";

import type {
  Actor,
  Concept,
  CorpusDocument,
  Statement,
  StatementAnnotation,
  StatementFacets,
  StatementFilter,
  Stance,
} from "@/types/corpus";

/** Client-side helpers for the corpus store API. */

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { error?: string }).error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// Documents ----------------------------------------------------------------

export async function fetchDocuments(): Promise<CorpusDocument[]> {
  return jsonOrThrow<{ documents: CorpusDocument[] }>(await fetch("/api/corpus/documents")).then(
    (d) => d.documents
  );
}

export async function ingestDocument(file: File, opts?: { sourceType?: string; docDate?: string }): Promise<CorpusDocument> {
  const fd = new FormData();
  fd.append("file", file);
  if (opts?.sourceType) fd.append("sourceType", opts.sourceType);
  if (opts?.docDate) fd.append("docDate", opts.docDate);
  return jsonOrThrow(await fetch("/api/corpus/documents", { method: "POST", body: fd }));
}

export async function deleteDocument(id: number): Promise<void> {
  await jsonOrThrow(await fetch(`/api/corpus/documents/${id}`, { method: "DELETE" }));
}

// Statements ---------------------------------------------------------------

export async function fetchStatements(filter: StatementFilter = {}): Promise<Statement[]> {
  const q = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
  });
  return jsonOrThrow<{ statements: Statement[] }>(
    await fetch(`/api/corpus/statements?${q.toString()}`)
  ).then((d) => d.statements);
}

export interface StatementDraft {
  documentId: number;
  text: string;
  startOffset?: number | null;
  endOffset?: number | null;
  actorName?: string;
  actorType?: string;
  conceptName?: string;
  stance?: Stance;
  stmtDate?: string | null;
  location?: string | null;
  notes?: string | null;
}

export async function createStatement(draft: StatementDraft): Promise<Statement> {
  return jsonOrThrow(
    await fetch("/api/corpus/statements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
  );
}

export async function updateStatement(
  id: number,
  patch: Partial<StatementDraft> & { actorId?: number | null; conceptId?: number | null }
): Promise<Statement> {
  return jsonOrThrow(
    await fetch(`/api/corpus/statements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteStatement(id: number): Promise<void> {
  await jsonOrThrow(await fetch(`/api/corpus/statements/${id}`, { method: "DELETE" }));
}

export async function annotateStatement(
  id: number,
  status: StatementAnnotation["status"],
  note: string | null
): Promise<StatementAnnotation> {
  return jsonOrThrow(
    await fetch(`/api/corpus/statements/${id}/annotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    })
  );
}

// Actors / Concepts / Facets ----------------------------------------------

export async function fetchActors(): Promise<Actor[]> {
  return jsonOrThrow<{ actors: Actor[] }>(await fetch("/api/corpus/actors")).then((d) => d.actors);
}

export async function fetchConcepts(): Promise<Concept[]> {
  return jsonOrThrow<{ concepts: Concept[] }>(await fetch("/api/corpus/concepts")).then(
    (d) => d.concepts
  );
}

export async function fetchFacets(filter: StatementFilter = {}): Promise<StatementFacets> {
  const q = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
  });
  return jsonOrThrow(await fetch(`/api/corpus/facets?${q.toString()}`));
}
