import { NextRequest, NextResponse } from "next/server";
import { computeFacets } from "@/db/repos";
import type { StatementFilter, Stance } from "@/types/corpus";

const STANCES: Stance[] = ["agree", "disagree", "neutral", "undefined"];

function num(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /api/corpus/facets — aggregate counts for a filter (by actor, concept,
 * stance, date, location). Powers the comparison and temporal views.
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
    return NextResponse.json(computeFacets(filter));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
