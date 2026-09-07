/** Smoke test for the new ensemble TS logic. Run: bun run nlp_service/test_ensemble.ts */
import { chunkText, chunkSegments, filterSuccessfulRuns, runAdaptiveEnsemble } from "../src/lib/ensemble";
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

const words = Array.from({ length: 10000 }, (_, i) => `word${i}`).join(" ");
// ~70k chars -> at 8000/chunk, capped at 8 chunks
const long = chunkText(words);
check("70k chars -> 8 chunks (cap), truncated flagged",
  long.chunks.length === 8 && long.truncated, JSON.stringify({ n: long.chunks.length, t: long.truncated }));
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

// --- chunkSegments: whole-unit packing (tabular mode) ---
const mkUnit = (i: number, words = 40) =>
  `Response ${i}: ` + Array.from({ length: words }, (_, k) => `w${i}_${k}`).join(" ");

const seg1 = chunkSegments([mkUnit(1), mkUnit(2)], 8000, 4);
check("two small units pack into one chunk",
  seg1.chunks.length === 1 && !seg1.truncated
    && seg1.chunks[0].split("\n\n").length === 2,
  `n=${seg1.chunks.length}`);

const manyUnits = Array.from({ length: 120 }, (_, i) => mkUnit(i + 1)); // ~3.3k chars each
const seg2 = chunkSegments(manyUnits, 8000, 4);
check("120 units -> 4 chunks (cap), truncated flagged",
  seg2.chunks.length === 4 && seg2.truncated, `n=${seg2.chunks.length}`);
check("every chunk within limit", seg2.chunks.every((c) => c.length <= 8000));
check("no unit split across chunks (each line intact)",
  seg2.chunks.every((c) =>
    c.split("\n\n").every((unit) => unit.startsWith("Response ") || unit.startsWith("Response"))
  ),
  "split unit found");
const packedUnits = seg2.chunks.flatMap((c) => c.split("\n\n")).length;
const totalChars = manyUnits.join("\n\n").length;
check("packed unit count disclosed implicitly (analyzedChars < total)",
  seg2.analyzedChars < totalChars,
  `analyzed=${seg2.analyzedChars} total=${totalChars} packed=${packedUnits}`);

const overUnit = "x".repeat(9000);
const seg3 = chunkSegments([mkUnit(1), overUnit, mkUnit(2)], 8000, 4);
check("pathological unit hard-split, neighbors intact",
  seg3.chunks.every((c) => c.length <= 8000)
    && !seg3.truncated
    && seg3.chunks.join("").includes("Response 2:"),
  `lens=${seg3.chunks.map((c) => c.length)}`);

check("empty unit list -> no chunks", chunkSegments([]).chunks.length === 0);
check("blank units filtered", chunkSegments(["", "   ", mkUnit(9)]).chunks.length === 1);

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

// --- adaptive: all-failing runs must NOT trigger the saturation early-stop ---
// No API key in the test env -> every adapter call fails -> regression guard
// for the bug where 2 consecutive failures counted as a "discovery plateau".
delete process.env.FIREWORKS_API_KEY;
delete process.env.OPENAI_API_KEY;
const adaptive = await runAdaptiveEnsemble({
  text: "some corpus text here",
  config: {
    seeds: [1, 2, 3, 4, 5, 6],
    temperature: 0.7,
    model: "test-model",
    provider: "fireworks",
  },
});
check("all-failing runs: all seeds attempted (no false plateau)",
  adaptive.runs.length === 6 && !adaptive.stoppedEarly,
  `runs=${adaptive.runs.length} stoppedEarly=${adaptive.stoppedEarly}`);
check("all-failing runs: every run recorded as request_failed",
  adaptive.runs.every((r) => r.provenance?.status === "request_failed"));

console.log();
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
