import { NextResponse } from "next/server";
import { isEmbedConfigured } from "@/lib/embeddings";
import { getAllStatementEmbeddings, listStatements } from "@/db/repos";

/** GET /api/corpus/embed-status — reports embedding readiness for the UI. */
export async function GET() {
  const configured = isEmbedConfigured();
  const embedded = configured ? getAllStatementEmbeddings().length : 0;
  const totalStatements = listStatements().length;
  return NextResponse.json({
    configured,
    embedded,
    totalStatements,
    needsEmbedding: configured && embedded < totalStatements,
  });
}
