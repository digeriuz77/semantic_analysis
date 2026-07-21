/**
 * Analytical frameworks library.
 *
 * Each framework provides a prompt template (which feeds the existing custom
 * prompt editor), the methodology's named phases (for in-app scaffolding), and
 * which paradigms it suits. The Schön reflective lens is one entry here — the
 * specialist route remains, but is unified conceptually as a framework.
 */

import type { ParadigmId } from "./paradigms";

export type FrameworkId =
  | "reflexive_ta"
  | "grounded_theory"
  | "content_analysis"
  | "phenomenology"
  | "schon_reflection"
  | "custom";

export interface FrameworkPhase {
  name: string;
  description: string;
}

export interface AnalyticalFramework {
  id: FrameworkId;
  label: string;
  summary: string;
  /** Paradigms this methodology commonly suits. */
  suitsParadigms: ParadigmId[];
  /** Named phases/steps of the methodology, for in-app scaffolding. */
  phases: FrameworkPhase[];
  /**
   * Prompt template using {seed} and {text_chunk} placeholders. This feeds the
   * configurator's prompt editor so the user can inspect and modify it.
   */
  promptTemplate: string;
  /** Whether this framework is the reflexive default. */
  isDefault?: boolean;
}

export const FRAMEWORKS: Record<FrameworkId, AnalyticalFramework> = {
  reflexive_ta: {
    id: "reflexive_ta",
    label: "Reflexive Thematic Analysis (Braun & Clarke)",
    summary:
      "Six-phase inductive approach emphasising researcher subjectivity and reflexivity. The most flexible entry point for qualitative data.",
    suitsParadigms: ["constructivist", "post_positivist", "pragmatic"],
    phases: [
      { name: "1. Familiarisation", description: "Immerse in the data; note initial observations." },
      { name: "2. Coding", description: "Generate initial codes across the full dataset." },
      { name: "3. Generating themes", description: "Cluster codes into candidate themes." },
      { name: "4. Reviewing themes", description: "Check themes against coded extracts and full dataset." },
      { name: "5. Defining themes", description: "Define and name each theme clearly." },
      { name: "6. Writing up", description: "Produce the report with vivid extract examples." },
    ],
    promptTemplate: `Analyze the following text using Braun and Clarke's reflexive thematic analysis approach.

Identify 3-5 key themes present in the data. For each theme provide:
- "name": a concise theme label
- "description": one or two sentences grounded in the text
- "keywords": an array of 2-4 representative keywords
- "prevalence": an integer from 0 to 100 estimating how prevalent the theme is
- "supporting_quotes": an array of 1-3 short verbatim quotes from the text that evidence this theme

Return ONLY a valid JSON array of these objects. Do not include markdown fences or any commentary.

Text:
{text_chunk}`,
    isDefault: true,
  },
  grounded_theory: {
    id: "grounded_theory",
    label: "Grounded Theory (Charmaz constructivist)",
    summary:
      "Iterative coding toward a theoretical model: open → axial → selective coding, with constant comparison. Aims to generate theory grounded in data.",
    suitsParadigms: ["constructivist", "pragmatic"],
    phases: [
      { name: "Open coding", description: "Line-by-line coding naming actions and concepts." },
      { name: "Axial coding", description: "Relate categories to sub-categories; identify properties." },
      { name: "Selective coding", description: "Integrate around a core category." },
      { name: "Theoretical sorting", description: "Build the conditional matrix / model." },
      { name: "Memoing", description: "Reflexive memos throughout." },
    ],
    promptTemplate: `Analyze the following text using constructivist grounded theory (Charmaz). Perform open and axial coding.

Identify 3-5 core categories present in the data. For each category provide:
- "name": the category label (an action or concept, not a topic)
- "description": the category's properties and the conditions/actions it captures
- "keywords": an array of 2-4 in vivo or theoretical codes
- "prevalence": an integer from 0 to 100 estimating how prevalent the category is
- "supporting_quotes": an array of 1-3 short verbatim quotes from the text

Return ONLY a valid JSON array of these objects. Do not include markdown fences or any commentary.

Text:
{text_chunk}`,
  },
  content_analysis: {
    id: "content_analysis",
    label: "Content Analysis (directed)",
    summary:
      "Systematic, often quantifying coding of manifest content into categories. Directed content analysis starts from a theory-derived coding frame.",
    suitsParadigms: ["post_positivist", "pragmatic"],
    phases: [
      { name: "Define frame", description: "Establish categories (theory-driven or data-driven)." },
      { name: "Unitise", description: "Define the unit of analysis." },
      { name: "Code", description: "Apply the coding frame systematically." },
      { name: "Tally", description: "Count category frequencies / co-occurrence." },
      { name: "Interpret", description: "Interpret frequencies in context." },
    ],
    promptTemplate: `Analyze the following text using directed content analysis. Identify manifest content categories and estimate their frequency.

Identify 3-5 content categories. For each category provide:
- "name": the category label
- "description": what kind of content falls under this category
- "keywords": an array of 2-4 indicator terms
- "prevalence": an integer from 0 to 100 estimating how frequently this category appears
- "supporting_quotes": an array of 1-3 short verbatim quotes from the text

Return ONLY a valid JSON array of these objects. Do not include markdown fences or any commentary.

Text:
{text_chunk}`,
  },
  phenomenology: {
    id: "phenomenology",
    label: "Phenomenology (descriptive)",
    summary:
      "Describes the lived essence of an experience. Focuses on what participants experience and how, bracketing preconceptions.",
    suitsParadigms: ["constructivist"],
    phases: [
      { name: "Bracketing", description: "Set aside preconceptions about the phenomenon." },
      { name: "Horizonalization", description: "List every significant statement." },
      { name: "Clusters of meaning", description: "Group statements into meaning units." },
      { name: "Essence", description: "Write the structural description of the experience." },
    ],
    promptTemplate: `Analyze the following text using descriptive phenomenology. Identify the essential structures of the lived experience described.

Identify 3-5 experiential meaning structures. For each provide:
- "name": the structure label
- "description": the essence of this aspect of the experience as lived
- "keywords": an array of 2-4 experiential descriptors
- "prevalence": an integer from 0 to 100 estimating how prominent this structure is
- "supporting_quotes": an array of 1-3 short verbatim quotes from the text

Return ONLY a valid JSON array of these objects. Do not include markdown fences or any commentary.

Text:
{text_chunk}`,
  },
  schon_reflection: {
    id: "schon_reflection",
    label: "Reflective Practice (Schön)",
    summary:
      "Assesses the quality of reflection — single-loop (technical) vs double-loop (assumption-challenging). Designed for teaching/practice reflection texts.",
    suitsParadigms: ["constructivist", "pragmatic"],
    phases: [
      { name: "Describe", description: "What happened? (the teaching/practice episode)" },
      { name: "Analyse", description: "Why did it happen? Single vs double-loop reasoning." },
      { name: "Theorise", description: "Connect to pedagogical or practice theory." },
      { name: "Action", description: "What will change next time?" },
    ],
    promptTemplate: `Analyze the following reflective text using Donald Schön's reflective practice framework. Identify themes about the quality and depth of reflection.

Identify 3-5 themes. For each provide:
- "name": the theme label
- "description": how this theme appears in the reflection, noting single-loop (technical) vs double-loop (assumption-challenging) reasoning
- "keywords": an array of 2-4 keywords
- "prevalence": an integer from 0 to 100
- "supporting_quotes": an array of 1-3 short verbatim quotes from the text

Return ONLY a valid JSON array of these objects. Do not include markdown fences or any commentary.

Text:
{text_chunk}`,
  },
  custom: {
    id: "custom",
    label: "Custom Prompt",
    summary:
      "Write your own analysis prompt. Use {seed} and {text_chunk} for per-run substitution. Output must be a JSON array of theme objects.",
    suitsParadigms: ["constructivist", "post_positivist", "critical", "pragmatic"],
    phases: [
      { name: "Define", description: "State your analytical question and output schema." },
      { name: "Substitute", description: "Use {seed} and {text_chunk} placeholders." },
      { name: "Validate", description: "Ensure output is a JSON array of theme objects." },
    ],
    promptTemplate: `Analyze the following text.

Identify 3-5 key themes. For each theme provide:
- "name": a concise theme label
- "description": one or two sentences grounded in the text
- "keywords": an array of 2-4 representative keywords
- "prevalence": an integer from 0 to 100
- "supporting_quotes": an array of 1-3 short verbatim quotes from the text

Return ONLY a valid JSON array of these objects. Do not include markdown fences or any commentary.

Text:
{text_chunk}`,
  },
};

export const FRAMEWORK_LIST: AnalyticalFramework[] = Object.values(FRAMEWORKS);

export const DEFAULT_FRAMEWORK: FrameworkId = "reflexive_ta";

export function frameworkForParadigm(paradigm: ParadigmId): FrameworkId {
  if (paradigm === "constructivist") return "reflexive_ta";
  if (paradigm === "post_positivist") return "content_analysis";
  return "reflexive_ta";
}
