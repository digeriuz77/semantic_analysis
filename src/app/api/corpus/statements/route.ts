import { NextRequest, NextResponse } from "next/server";
import { createStatement, listStatements } from "@/db/repos";
import type { CreateStatementInput, StatementFilter, Stance } from "@/types/corpus";

const STANCES: Stance[] = ["agree", "disagree", "neutral", "undefined"];

function num(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /api/corpus/statements — list with optional filters:
 *   documentId, actorId, conceptId, stance, location, dateFrom, dateTo, search
 * These are the iterative-workspace queries (by name/actor, by date window, etc.).
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    const stance = q.get("stance") as Stance | null;
    const filter: StatementFilter = {
      documentId: num(q.get("documentId")),
      actorId: num(q.get("actorId")),
      conceptId: num(q.get("conceptId")),
      stance: stance && STANCES.includes(stance) ? stance : undefined,
      location: q.get("location") ?? undefined,
      dateFrom: q.get("dateFrom") ?? undefined,
      dateTo: q.get("dateTo") ?? undefined,
      search: q.get("search") ?? undefined,
    };
    return NextResponse.json({ statements: listStatements(filter) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/corpus/statements — create (code) a statement. Resolves/creates
 * actor and concept by name if ids not supplied.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.documentId || !body.text) {
      return NextResponse.json({ error: "documentId and text required" }, { status: 400 });
    }
    const input: CreateStatementInput = {
      documentId: Number(body.documentId),
      text: String(body.text),
      startOffset: body.startOffset ?? null,
      endOffset: body.endOffset ?? null,
      actorId: body.actorId ?? null,
      actorName: body.actorName,
      actorType: body.actorType,
      conceptId: body.conceptId ?? null,
      conceptName: body.conceptName,
      stance: body.stance ?? "undefined",
      stmtDate: body.stmtDate ?? null,
      location: body.location ?? null,
      notes: body.notes ?? null,
      source: body.source ?? "manual",
      codeRunId: body.codeRunId ?? null,
    };
    return NextResponse.json(createStatement(input), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
