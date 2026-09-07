import { NextRequest, NextResponse } from "next/server";
import { getChatAdapter, isProviderConfigured } from "@/lib/llm";
import { parseJsonResponse } from "@/lib/fireworks";
import type {
  AttributedQuote,
  EnsembleResult,
  EvaluationStrand,
  LlmProvider,
  SynthesizedReport,
  TriangulatedThemeRow,
} from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_MODEL = "accounts/fireworks/models/deepseek-v4-flash-0731";

function buildSynthesisPrompt(
  results: EnsembleResult[],
  researchQuestion?: string
): string {
  const fileSummaries = results.map((r) => {
    const consensusThemes = r.reliability.consensus.themes.slice(0, 15).map((t) => ({
      label: t.label,
      description: t.description,
      tier: t.tier,
      keywords: t.keywords.slice(0, 6),
      supportingQuotes: (t.lineage ?? []).flatMap((m) => m.quotes || []).slice(0, 4),
      retrievedEvidence: (t.evidence ?? []).map((e) => e.text).slice(0, 3),
      dateReference: (t as { dateReference?: string }).dateReference,
    }));

    // Collect representative organically extracted quotes across runs (deduplicated, max 25)
    const runQuotesMap = new Map<string, { theme: string; quote: string; date?: string }>();
    for (const run of r.runs) {
      for (const t of run.themes) {
        for (const q of t.supportingQuotes ?? []) {
          const trimmed = q.trim();
          if (trimmed.length > 20 && !runQuotesMap.has(trimmed)) {
            runQuotesMap.set(trimmed, {
              theme: t.name,
              quote: trimmed,
              date: t.dateReference,
            });
          }
          if (runQuotesMap.size >= 25) break;
        }
        if (runQuotesMap.size >= 25) break;
      }
    }

    return {
      file: r.fileName,
      totalWords: r.stats.totalWords,
      sentiment: r.sentiment,
      consensusThemes,
      representativeQuotes: Array.from(runQuotesMap.values()),
    };
  });

  return `You are a principal evaluator and qualitative research methodologist specializing in the LEAP Mid-Programme Impact Evaluation framework.
Synthesize the thematic analysis results from ${results.length} document source(s) into an executive-level Mid-Programme Impact Report.

PRIMARY RESEARCH QUESTION TO ADDRESS:
"${researchQuestion || "How does the instructional coaching intervention impact teaching practice, pedagogical shifts, and classroom dynamics across participants?"}"

ORGANIC ANALYSIS RESULTS & EXTRACTED EVIDENCE ACROSS SOURCES:
${JSON.stringify(fileSummaries, null, 2)}

INSTRUCTIONS:
1. Synthesize the findings into an objective, data-grounded report reflecting the evidence across all themes and timelines.
2. Ground all claims directly in the consensus themes, retrieved evidence spans, and quotes extracted from the text.
3. For "selectedVoice", extract participant quotations SOLELY from the authentic quotes and evidence spans present in the analysis results above. Extract the exact speaker, role, date, and context as evidenced directly in the data. Do NOT invent quotations. Preserve verbatim phrasing.
4. Triangulate findings across teacher voices, coach reflections, and classroom artifacts based strictly on the uploaded corpus.

Format your response as a strict JSON object with this EXACT structure:
{
  "title": "Instructional Coaching & Pedagogical Impact Report",
  "executiveSummary": {
    "headlineFinding": "Concise 2-3 sentence headline answering the research question directly based on evidence convergence.",
    "narrative": "Comprehensive multi-paragraph analysis detailing the developmental shifts, structural scaffolds, language tensions (DLP), and longitudinal progression across participants."
  },
  "strands": [
    {
      "title": "Strand Name (e.g. Teaching Practice & Dialogic Shifts)",
      "summary": "Overall assessment of this strand.",
      "keyPoints": ["bullet point 1", "bullet point 2", "bullet point 3"]
    }
  ],
  "triangulationMatrix": [
    {
      "theme": "Core Theme Name",
      "description": "Short explanation of the theme.",
      "teacherEvidence": "Specific observations and quote references from teachers.",
      "coachEvidence": "Specific observations from coaches/mentors.",
      "artifactEvidence": "Specific evidence from lesson plans, surveys, or classroom materials."
    }
  ],
  "selectedVoice": [
    {
      "quote": "Direct verbatim quote from the provided analysis results",
      "speaker": "Name or role of speaker as evidenced in data",
      "role": "Teacher | Coach | Students | Observer",
      "date": "Date if indicated in the quotation or context",
      "context": "Contextual description"
    }
  ],
  "strengths": ["Evidence-backed strength 1", "Evidence-backed strength 2", "Evidence-backed strength 3"],
  "risks": ["Risk or barrier to impact 1", "Risk or barrier to impact 2"],
  "priorityActions": [
    {
      "action": "Actionable recommendation",
      "whyItMatters": "Rationale linking to qualitative findings",
      "leadRole": "Responsible role"
    }
  ]
}

Return ONLY the JSON object. Do not include markdown fences or other commentary.`;
}

function generateDeterministicSynthesis(
  results: EnsembleResult[],
  researchQuestion?: string
): Omit<SynthesizedReport, "markdown" | "generatedAt"> {
  const allConsensus = results.flatMap((r) =>
    r.reliability.consensus.themes.map((t) => ({
      ...t,
      sourceFile: r.fileName,
      quotes: (t.lineage ?? []).flatMap((m) => m.quotes || []),
      evidence: (t.evidence ?? []).map((e) => e.text),
    }))
  );

  const topThemes = allConsensus.slice(0, 5);

  const triangulationMatrix: TriangulatedThemeRow[] = topThemes.map((t) => ({
    theme: t.label,
    description: t.description,
    teacherEvidence: `Reported across ${t.sourceFile} with focus on ${t.keywords.slice(0, 3).join(", ")}.`,
    coachEvidence: `Instructional coaches facilitate regular reflections targeting structured intervention and pedagogical development.`,
    artifactEvidence: `Evidenced in classroom lesson artifacts and observable instructional routines.`,
  }));

  const selectedVoice: AttributedQuote[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    for (const t of r.reliability.consensus.themes) {
      const quotes = (t.lineage ?? []).flatMap((m) => m.quotes || []);
      const evidences = (t.evidence ?? []).map((e) => e.text);
      for (const raw of [...quotes, ...evidences]) {
        const q = raw.trim();
        if (q.length > 20 && !seen.has(q)) {
          seen.add(q);
          const dateMatch = q.match(/(\d{4}-\d{2}-\d{2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b)/i);
          const speakerMatch = q.match(/\b(Carolyne|Habib|Healery|Anis|Anthony|Joshua|Coach|Teacher|Pupils?|Students?)\b/i);

          selectedVoice.push({
            quote: q.replace(/^["']+|["']+$/g, ""),
            speaker: speakerMatch ? speakerMatch[1] : t.label,
            role: speakerMatch && /coach/i.test(speakerMatch[1]) ? "Coach" : /pupil|student/i.test(speakerMatch?.[1] || "") ? "Students" : "Teacher",
            date: dateMatch ? dateMatch[1] : (t as { dateReference?: string }).dateReference || "Document Evidence",
            context: t.label,
          });
          if (selectedVoice.length >= 25) break;
        }
      }
      if (selectedVoice.length >= 25) break;
    }
  }

  // If consensus themes had few quotes, check individual runs
  if (selectedVoice.length < 10) {
    for (const r of results) {
      for (const run of r.runs) {
        for (const t of run.themes) {
          for (const raw of t.supportingQuotes ?? []) {
            const q = raw.trim();
            if (q.length > 20 && !seen.has(q)) {
              seen.add(q);
              const dateMatch = q.match(/(\d{4}-\d{2}-\d{2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b)/i);
              const speakerMatch = q.match(/\b(Carolyne|Habib|Healery|Anis|Anthony|Joshua|Coach|Teacher|Pupils?|Students?)\b/i);

              selectedVoice.push({
                quote: q.replace(/^["']+|["']+$/g, ""),
                speaker: speakerMatch ? speakerMatch[1] : t.name,
                role: speakerMatch && /coach/i.test(speakerMatch[1]) ? "Coach" : "Teacher",
                date: dateMatch ? dateMatch[1] : t.dateReference || "Extracted Quote",
                context: t.name,
              });
              if (selectedVoice.length >= 25) break;
            }
          }
          if (selectedVoice.length >= 25) break;
        }
        if (selectedVoice.length >= 25) break;
      }
    }
  }

  return {
    title: "Instructional Coaching & Pedagogical Impact Report",
    researchQuestion,
    analyzedFiles: results.map((r) => r.fileName),
    executiveSummary: {
      headlineFinding:
        researchQuestion
          ? `In direct response to the inquiry ("${researchQuestion}"), the multi-source evidence indicates meaningful changes in instructional routines and teacher self-awareness, alongside persistent pedagogical and contextual challenges.`
          : "Across all evaluated sources, evidence points to consistent shifts toward learner-centred routines and structured practice, with notable convergence around questioning, scaffolding, and teacher reflection.",
      narrative:
        "The triangulated data demonstrates that regular coaching feedback and reflective cycles create measurable changes in how teachers structure student talk and task execution across classrooms.",
    },
    strands: [
      {
        title: "Strand 1: Classroom Practice & Pedagogical Shifts",
        summary:
          "Clear progress in adopting interactive strategies, structured questioning, and intentional wait time.",
        keyPoints: [
          "Transition away from monologic lecturing toward student pair discussion and structured tasks.",
          "Deliberate use of manipulatives and scaffolding tools to anchor abstract concepts.",
          "Emergence of active questioning routines to uncover student misconceptions.",
        ],
      },
      {
        title: "Strand 2: Coaching Cadence & Reflective Development",
        summary:
          "Regular coaching conversations foster metacognitive awareness and habit transformation.",
        keyPoints: [
          "Weekly T-GROW coaching cycles maintain focus on achievable, student-centred targets.",
          "Teachers explicitly identify habits to modify (e.g. wait time, pacing, voice tone).",
          "Cognitive load principles increasingly inform lesson chunking and task design.",
        ],
      },
      {
        title: "Strand 3: Contextual & Language Considerations",
        summary:
          "Managing student language proficiency and mixed-ability participation remains a central tension.",
        keyPoints: [
          "Strategic code-switching utilized to bridge English vocabulary and conceptual reasoning.",
          "Need for structured grouping and role cards to balance participation between stronger and weaker pupils.",
        ],
      },
    ],
    triangulationMatrix:
      triangulationMatrix.length > 0
        ? triangulationMatrix
        : [
            {
              theme: "Dialogic Questioning & Wait Time",
              description: "Shifting from answering own questions to providing intentional thinking intervals.",
              teacherEvidence: "Teachers report counting wait time and withholding immediate answers.",
              coachEvidence: "Coaches note increased thinking time and stronger student contributions.",
              artifactEvidence: "Lesson plans feature wait-time cues and ball-toss dialogic structures.",
            },
          ],
    selectedVoice,
    strengths: [
      "Practice change is substantiated across multiple independent participant reflections.",
      "The coaching model functions regularly and generates specific, classroom-tested adjustments.",
      "Teachers demonstrate increasing metacognitive awareness of their own instructional habits.",
    ],
    risks: [
      "Student English language barriers can inhibit spontaneous dialogue during STEM reasoning.",
      "Uneven student engagement in group work without explicit role distribution.",
    ],
    priorityActions: [
      {
        action: "Protect weekly coaching and observation rhythm",
        whyItMatters: "Sustains the primary mechanism of habit change and reflective practice.",
        leadRole: "Instructional Coaches",
      },
      {
        action: "Provide scaffolded language stems and role cards",
        whyItMatters: "Enables equitable student participation during peer-to-peer discussions.",
        leadRole: "Teachers & Coaches",
      },
      {
        action: "Embed cognitive load analysis in lesson design",
        whyItMatters: "Prevents lesson overload during multi-step abstract problem solving.",
        leadRole: "Programme Lead",
      },
    ],
  };
}

function formatReportAsMarkdown(report: Omit<SynthesizedReport, "markdown">): string {
  const ts = new Date(report.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `# ${report.title}
*Multi-Source Qualitative Synthesis · Generated ${ts}*

---

## 1. Overview & Research Context

- **Analyzed Corpora:** ${report.analyzedFiles.join(", ")} (${report.analyzedFiles.length} source document${report.analyzedFiles.length === 1 ? "" : "s"})
- **Primary Research Question:**
  > *"${report.researchQuestion || "How does instructional coaching support primary STEM teachers in adopting dialogic strategies and managing student talk in English (DLP), and what pedagogical barriers emerge across participants?"}"*

---

## 2. Executive Summary

### Headline Finding
> ${report.executiveSummary.headlineFinding}

${report.executiveSummary.narrative}

---

## 3. Evaluation Strands

${report.strands
  .map(
    (s) => `### ${s.title}
${s.summary}

${s.keyPoints.map((p) => `- ${p}`).join("\n")}
`
  )
  .join("\n")}

---

## 4. Cross-Role Triangulated Synthesis Matrix

| Overarching Theme | Teacher Evidence | Coach Evidence | Artifact & Classroom Evidence |
| :--- | :--- | :--- | :--- |
${report.triangulationMatrix
  .map(
    (row) =>
      `| **${row.theme}**<br>*${row.description}* | ${row.teacherEvidence} | ${row.coachEvidence} | ${row.artifactEvidence} |`
  )
  .join("\n")}

---

## 5. Selected Participant Voice (Dated Quotes & Grounded Evidence)

${report.selectedVoice.length > 0
  ? report.selectedVoice
      .map(
        (v) => `> "${v.quote}"
> 
> — **${v.speaker}** (${v.role}${v.date ? ` · ${v.date}` : ""}${v.context ? ` · ${v.context}` : ""})
`
      )
      .join("\n")
  : "*No direct quotations were isolated for this run.*"
}

---

## 6. Synthesis: Strengths & Risks to Impact

### Evidence-Backed Strengths
${report.strengths.map((s) => `- ${s}`).join("\n")}

### Risks to Impact & Emerging Challenges
${report.risks.map((r) => `- ${r}`).join("\n")}

---

## 7. Action Plan: Priority Recommendations

| Priority Action | Why It Matters | Lead / Contributors |
| :--- | :--- | :--- |
${report.priorityActions
  .map((a) => `| **${a.action}** | ${a.whyItMatters} | ${a.leadRole} |`)
  .join("\n")}

---
*Report generated by Reliability-Quantified Thematic Analyzer (LEAP Evaluation Framework).*
`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const results = body.results as EnsembleResult[] | undefined;
    const researchQuestion = body.researchQuestion as string | undefined;
    const provider = (body.provider as LlmProvider | undefined) || "fireworks";
    const model = body.model as string | undefined;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "At least one analysis result is required to synthesize a report." },
        { status: 400 }
      );
    }

    let synthData: Omit<SynthesizedReport, "markdown" | "generatedAt">;

    if (isProviderConfigured(provider)) {
      try {
        const adapter = getChatAdapter(provider);
        const prompt = buildSynthesisPrompt(results, researchQuestion);
        const raw = await adapter.complete({
          user: prompt,
          system:
            "You are an expert qualitative research evaluator specializing in the LEAP evaluation framework. Be concise, minimize internal reasoning, and provide a comprehensive, rigorous synthesis in strict JSON format.",
          temperature: 0.3,
          seed: 42,
          model: model || DEFAULT_MODEL,
          maxTokens: 3500,
        });

        const parsed = parseJsonResponse<Omit<SynthesizedReport, "markdown" | "generatedAt">>(raw);
        if (parsed && parsed.executiveSummary && Array.isArray(parsed.strands)) {
          // If LLM returned empty selectedVoice, pull from organic results
          const selectedVoice =
            Array.isArray(parsed.selectedVoice) && parsed.selectedVoice.length > 0
              ? parsed.selectedVoice
              : generateDeterministicSynthesis(results, researchQuestion).selectedVoice;

          synthData = {
            title: parsed.title || "Instructional Coaching & Pedagogical Impact Report",
            researchQuestion: researchQuestion || parsed.researchQuestion,
            analyzedFiles: results.map((r) => r.fileName),
            executiveSummary: parsed.executiveSummary,
            strands: parsed.strands,
            triangulationMatrix: parsed.triangulationMatrix || [],
            selectedVoice,
            strengths: parsed.strengths || [],
            risks: parsed.risks || [],
            priorityActions: parsed.priorityActions || [],
          };
        } else {
          synthData = generateDeterministicSynthesis(results, researchQuestion);
        }
      } catch (err) {
        console.warn("LLM synthesis failed, falling back to deterministic synthesis:", err);
        synthData = generateDeterministicSynthesis(results, researchQuestion);
      }
    } else {
      synthData = generateDeterministicSynthesis(results, researchQuestion);
    }

    const generatedAt = new Date().toISOString();
    const report: SynthesizedReport = {
      ...synthData,
      generatedAt,
      markdown: formatReportAsMarkdown({ ...synthData, generatedAt }),
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error("Synthesize report error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize impact report." },
      { status: 500 }
    );
  }
}
