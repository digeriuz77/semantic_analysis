import { NextRequest, NextResponse } from "next/server";
import { getCoreqResponses, upsertCoreqResponse } from "@/db/repos";

/**
 * GET  /api/coreq?study=<key> — load persisted COREQ responses for a study.
 * POST /api/coreq — upsert one item: { study, itemId, checked, detail }.
 * Server-side persistence for the reporting audit trail; the client keeps a
 * localStorage cache for offline use.
 */
export async function GET(request: NextRequest) {
  try {
    const study = request.nextUrl.searchParams.get("study") ?? "default";
    return NextResponse.json({ responses: getCoreqResponses(study) });
  } catch {
    return NextResponse.json({ error: "Could not load COREQ responses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const itemId = Number(body.itemId);
    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ error: "itemId must be an integer" }, { status: 400 });
    }
    const study = typeof body.study === "string" ? body.study : "default";
    const checked = Boolean(body.checked);
    const detail = typeof body.detail === "string" ? body.detail : "";
    return NextResponse.json(
      upsertCoreqResponse(study, itemId, checked, detail),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Could not save COREQ response" }, { status: 500 });
  }
}
