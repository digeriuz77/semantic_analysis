import { NextRequest, NextResponse } from "next/server";
import { inspectFile, NlpUnavailableError } from "@/lib/nlp";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/nlp-inspect — proxy the column inspection to the Python service.
 * The browser never talks to the NLP service directly (topology-independent),
 * and structural CSV errors surface as 400s rather than opaque outages.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File exceeds the 10 MB size limit" }, { status: 413 });
    }
    return NextResponse.json(await inspectFile(file));
  } catch (error) {
    if (error instanceof NlpUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Inspect error:", error);
    return NextResponse.json({ error: "Inspect failed" }, { status: 500 });
  }
}
