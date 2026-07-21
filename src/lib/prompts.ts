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

Return ONLY a valid JSON array of these objects. Do not include markdown fences or any commentary.

Text:
{text_chunk}`;

export const DEFAULT_SYSTEM_PROMPT =
  "You are an expert qualitative researcher performing rigorous reflexive thematic analysis. Be faithful to the text and avoid fabricating content.";

/**
 * Substitute {seed}, {text_chunk}, and {text} placeholders in a prompt template.
 */
export function renderPrompt(template: string, seed: number, textChunk: string): string {
  return template
    .replaceAll("{seed}", String(seed))
    .replaceAll("{text_chunk}", textChunk)
    .replaceAll("{text}", textChunk);
}
