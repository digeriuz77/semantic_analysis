import { NextRequest, NextResponse } from "next/server";
import { upsertAnnotation } from "@/db/repos";

/** POST /api/corpus/statements/[id]/annotation — persist researcher judgement. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const status = body.status as "accepted" | "rejected" | "flagged";
    if (!["accepted", "rejected", "flagged"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const note = body.note ? String(body.note) : null;
    return NextResponse.json(upsertAnnotation(Number(id), status, note));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
