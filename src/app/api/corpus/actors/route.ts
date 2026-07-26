import { NextResponse } from "next/server";
import { listActors } from "@/db/repos";

export async function GET() {
  try {
    return NextResponse.json({ actors: listActors() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
