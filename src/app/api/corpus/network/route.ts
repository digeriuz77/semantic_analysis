import { NextRequest, NextResponse } from "next/server";
import { listStatements } from "@/db/repos";
import { buildNetwork, bucketByWindow, buildActorProfile, type NetworkType, type WindowSize } from "@/lib/networks";
import type { StatementFilter, Stance } from "@/types/corpus";

const STANCES: Stance[] = ["agree", "disagree", "neutral", "undefined"];

function num(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /api/corpus/network?type=congruence|co_occurrence&window=day|week|month|year&compare=1,2
 *
 * Returns a DNA-style network graph (nodes + edges) from filtered statements.
 * Supports temporal snapshots and side-by-side actor comparison.
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    const networkType = (q.get("type") as NetworkType) ?? "congruence";
    const window = (q.get("window") as WindowSize | null);
    const compare = q.get("compare");
    const stance = q.get("stance") as Stance | null;

    const filter: StatementFilter = {
      documentId: num(q.get("documentId")),
      actorId: num(q.get("actorId")),
      conceptId: num(q.get("conceptId")),
      stance: stance && STANCES.includes(stance) ? stance : undefined,
      location: q.get("location") ?? undefined,
      dateFrom: q.get("dateFrom") ?? undefined,
      dateTo: q.get("dateTo") ?? undefined,
    };

    if (compare) {
      const ids = compare.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
      const allStmts = listStatements();
      const profiles = ids
        .map((id) => buildActorProfile(allStmts, id))
        .filter((p): p is NonNullable<typeof p> => p !== null);
      return NextResponse.json({ mode: "compare", profiles });
    }

    const statements = listStatements(filter);

    if (window) {
      const buckets = bucketByWindow(statements, window);
      const snapshots = buckets.map((b) => ({
        bucket: b.bucket,
        count: b.statements.length,
        network: buildNetwork(b.statements, networkType),
      }));
      return NextResponse.json({ mode: "temporal", type: networkType, window, snapshots });
    }

    const graph = buildNetwork(statements, networkType);
    return NextResponse.json({ mode: "static", type: networkType, network: graph, statementCount: statements.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
