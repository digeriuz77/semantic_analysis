import fs from "fs";
import { chunkText } from "../src/lib/ensemble";
import { renderPrompt, DEFAULT_THEMATIC_PROMPT } from "../src/lib/prompts";
import { fireworksAdapter } from "../src/lib/llm/fireworks";

async function testChunk() {
  const text = fs.readFileSync(".kilocode/data/processed/Complete_Coaching_Corpus_Dated.txt", "utf-8");
  const plan = chunkText(text);
  console.log(`Chunks: ${plan.chunks.length}`);
  const template = DEFAULT_THEMATIC_PROMPT;
  const prompt = renderPrompt(template, 42, plan.chunks[0], "How does instructional coaching support STEM teachers?");
  console.log(`Prompt length: ${prompt.length} chars. Calling Fireworks...`);
  const t0 = Date.now();
  try {
    const res = await fireworksAdapter.complete({
      user: prompt,
      seed: 42,
      model: "accounts/fireworks/models/deepseek-v4-flash-0731",
      temperature: 0.7,
      maxTokens: 2000,
    });
    console.log(`Done in ${((Date.now() - t0)/1000).toFixed(1)}s! Response length: ${res.length}`);
    console.log(`Preview:`, res.slice(0, 500));
  } catch (err) {
    console.error(`Error:`, err);
  }
}

testChunk();
