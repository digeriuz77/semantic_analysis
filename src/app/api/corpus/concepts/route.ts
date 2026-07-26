import { NextRequest, NextResponse } from "next/server";
import { listConcepts, upsertConcept } from "@/db/repos";

export async function GET() {
  try {
    return NextResponse.json({ concepts: listConcepts() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = upsertConcept(String(body.name), {
      description: body.description,
      frameworkId: body.frameworkId,
      color: body.color,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
