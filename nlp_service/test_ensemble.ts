/** Smoke test for the new ensemble TS logic. Run: bun run nlp_service/test_ensemble.ts */
import { chunkText, filterSuccessfulRuns } from "../src/lib/ensemble";
import type { ThemeRun } from "../src/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

// --- chunkText ---
const short = chunkText("hello world");
check("short text -> single chunk, not truncated",
  short.chunks.length === 1 && !short.truncated && short.analyzedChars === 11);

const words = Array.from({ length: 5000 }, (_, i) => `word${i}`).join(" ");
// ~35k chars -> at 8000/chunk, capped at 4 chunks
const long = chunkText(words);
check("35k chars -> 4 chunks (cap), truncated flagged",
  long.chunks.length === 4 && long.truncated, JSON.stringify({ n: long.chunks.length, t: long.truncated }));
check("each chunk within limit", long.chunks.every((c) => c.length <= 8000));
check("analyzedChars == sum of chunk lengths",
  long.analyzedChars === long.chunks.reduce((s, c) => s + c.length, 0));

const mid = chunkText(Array.from({ length: 2000 }, (_, i) => `w${i}`).join(" ")); // ~11k chars
check("11k chars -> 2 chunks, not truncated",
  mid.chunks.length === 2 && !mid.truncated, `n=${mid.chunks.length}`);

check("empty text -> no chunks", chunkText("   ").chunks.length === 0);

// word longer than the limit must be hard-split, not passed through over cap
const pathological = chunkText("a".repeat(9000), 8000, 4);
check("single over-long word hard-split within cap",
  pathological.chunks.every((c) => c.length <= 8000)
    && pathological.chunks.join("") === "a".repeat(9000)
    && !pathological.truncated,
  `lens=${pathological.chunks.map((c) => c.length)}`);

// --- filterSuccessfulRuns ---
const mk = (status?: "ok" | "parse_failed" | "request_failed"): ThemeRun => ({
  seed: 1,
  themes: status === "ok" || status === undefined ? [{ name: "T", description: "d", keywords: [], prevalence: 1 }] : [],
  provenance: status
    ? { seed: 1, renderedPrompt: "", rawResponse: "", status, textChunkLength: 10 }
    : undefined,
});
const filtered = filterSuccessfulRuns([mk("ok"), mk("parse_failed"), mk("request_failed"), mk(undefined)]);
check("failed runs filtered, ok + provenance-less kept", filtered.length === 2);

console.log();
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
