/**
 * Default thematic-analysis prompt (Braun & Clarke reflexive TA) and the
 * variable-substitution engine for custom prompts. Supports {seed} and
 * {text_chunk}/{text} placeholders as described in the reference paper.
 */

export const DEFAULT_THEMATIC_PROMPT = `Analyze the following text using Braun and Clarke's reflexive thematic analysis approach.

Identify 3-5 key themes present in the data. For each theme provide:
- "name": a concise theme label
- "description": one or two sentences grounded in the text
- "keywords": an array of 2-4 representative keywords
- "prevalence": an integer from 0 to 100 estimating how prevalent the theme is
- "supporting_quotes": an array of 1-3 short verbatim quotes from the text that evidence this theme (preserve speaker and date context if present in the text)
- "date_reference": explicit date or time period associated with this theme in the text (e.g. "18 June 2026", "July 2026", or "Unstated")

Return ONLY a valid JSON array of these objects. Do not include markdown fences or any commentary.

Text:
{text_chunk}`;

export const DEFAULT_SYSTEM_PROMPT =
  "You are an expert qualitative researcher performing rigorous reflexive thematic analysis. Be faithful to the text, be concise, and keep internal reasoning brief.";

/**
 * Substitute {seed}, {text_chunk}, {text}, and optional {research_question} placeholders.
 * If researchQuestion is provided and not already in template, injects it before Text:.
 */
export function renderPrompt(
  template: string,
  seed: number,
  textChunk: string,
  researchQuestion?: string
): string {
  let rendered = template
    .replaceAll("{seed}", String(seed))
    .replaceAll("{text_chunk}", textChunk)
    .replaceAll("{text}", textChunk);

  if (researchQuestion && researchQuestion.trim()) {
    const q = researchQuestion.trim();
    if (rendered.includes("{research_question}")) {
      rendered = rendered.replaceAll("{research_question}", q);
    } else {
      const rqBlock = `\nPRIMARY RESEARCH QUESTION TO ADDRESS:\n"${q}"\nEnsure that all extracted themes, descriptions, and supporting quotes explicitly speak to and provide evidence for this research question.\n`;
      if (rendered.includes("Text:")) {
        rendered = rendered.replace("Text:", `${rqBlock}\nText:`);
      } else {
        rendered = `${rqBlock}\n${rendered}`;
      }
    }
  }

  return rendered;
}
