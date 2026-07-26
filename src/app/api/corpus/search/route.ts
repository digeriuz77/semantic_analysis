import { NextRequest, NextResponse } from "next/server";
import { semanticSearch, getAllStatementEmbeddings, storeEmbedding, listStatements } from "@/db/repos";
import { getEmbedAdapter, normalize } from "@/lib/embeddings";
import type { StatementFilter, Stance } from "@/types/corpus";

const STANCES: Stance[] = ["agree", "disagree", "neutral", "undefined"];

/**
 * POST /api/corpus/search — semantic search across coded statements.
 * Falls back to lexical search when no embeddings/provider available.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = String(body.query ?? "").trim();
    if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

    const filter: StatementFilter = {
      documentId: body.documentId,
      actorId: body.actorId,
      conceptId: body.conceptId,
      stance: body.stance && STANCES.includes(body.stance) ? body.stance : undefined,
      location: body.location,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    };
    const topK = Math.min(body.topK ?? 20, 100);

    const stored = getAllStatementEmbeddings();
    const adapter = getEmbedAdapter();

    if (stored.length > 0 && adapter) {
      const queryVecs = await adapter.embed([query]);
      const queryVec = normalize(queryVecs[0]);
      const hits = semanticSearch(queryVec, filter, topK);
      return NextResponse.json({ results: hits, mode: "semantic", embeddingModel: adapter.model });
    }

    const lexical = listStatements({ ...filter, search: query });
    return NextResponse.json({
      results: lexical.slice(0, topK).map((s) => ({ statement: s, score: 0 })),
      mode: "lexical",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** PUT /api/corpus/search — batch-embed all statements that lack embeddings. */
export async function PUT() {
  try {
    const adapter = getEmbedAdapter();
    if (!adapter) {
      return NextResponse.json({ error: "No embedding provider configured (add GEMINI_API_KEY)" }, { status: 400 });
    }

    const allStmts = listStatements();
    const existing = new Set(getAllStatementEmbeddings(adapter.model).map((e) => e.entityId));
    const toEmbed = allStmts.filter((s) => !existing.has(s.id));

    if (toEmbed.length === 0) {
      return NextResponse.json({ embedded: 0, total: existing.size, message: "All statements already embedded" });
    }

    const BATCH = 50;
    let count = 0;
    for (let i = 0; i < toEmbed.length; i += BATCH) {
      const batch = toEmbed.slice(i, i + BATCH);
      const vecs = await adapter.embed(batch.map((s) => s.text));
      for (let j = 0; j < batch.length; j++) {
        const normalized = normalize(vecs[j]);
        storeEmbedding("statement", batch[j].id, adapter.provider, adapter.model, normalized.length, normalized);
        count++;
      }
    }
    return NextResponse.json({ embedded: count, total: existing.size + count });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
