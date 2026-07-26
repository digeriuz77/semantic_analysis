import { NextRequest, NextResponse } from "next/server";
import {
  createDocument,
  listDocuments,
} from "@/db/repos";
import type { DocumentSourceType } from "@/types/corpus";
import { processFileViaNlp, NlpUnavailableError } from "@/lib/nlp";

const VALID_TYPES: DocumentSourceType[] = [
  "interview", "survey", "reflection", "transcript",
  "focus_group", "field_note", "feedback", "other",
];

/**
 * GET /api/corpus/documents — list all persisted documents (with statement counts).
 */
export async function GET() {
  try {
    return NextResponse.json({ documents: listDocuments() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/corpus/documents — ingest and persist a document.
 * Accepts a file (FormData) or raw text (JSON { content, fileName, ... }).
 * Cleaning via the Python NLP service is best-effort (raw content stored if down).
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
      const sourceType = (String(formData.get("sourceType") || "other") as DocumentSourceType);
      const title = (formData.get("title") as string | null) || null;
      const docDate = (formData.get("docDate") as string | null) || null;
      const rawContent = await file.text();

      let cleanedText: string | null = null;
      try {
        const nlp = await processFileViaNlp(file);
        cleanedText = nlp.cleaned_text ?? null;
      } catch (e) {
        if (!(e instanceof NlpUnavailableError)) throw e;
        // NLP service down — store raw content only. Cleaning can be retried later.
      }

      const doc = createDocument({
        fileName: file.name,
        sourceType: VALID_TYPES.includes(sourceType) ? sourceType : "other",
        title,
        content: rawContent,
        cleanedText,
        docDate,
      });
      return NextResponse.json(doc, { status: 201 });
    }

    // JSON body path.
    const body = await request.json();
    const sourceType = (String(body.sourceType || "other") as DocumentSourceType);
    const doc = createDocument({
      fileName: String(body.fileName ?? "untitled.txt"),
      sourceType: VALID_TYPES.includes(sourceType) ? sourceType : "other",
      title: body.title ?? null,
      content: String(body.content ?? ""),
      cleanedText: body.cleanedText ?? null,
      docDate: body.docDate ?? null,
      metadata: body.metadata,
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
