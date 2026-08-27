/**
 * WP-1 end-to-end: exercises the real lib functions against the live Python
 * service (uvicorn on 127.0.0.1:8000) — the exact call chain the orchestrator
 * route uses: inspect -> process(text_columns) -> chunkSegments ->
 * reliability(demo runs) -> evidence(units).
 */
import { readFileSync } from "node:fs";
import { inspectFile, processFileViaNlp, callReliability, enrichConsensusWithEvidence } from "../src/lib/nlp";
import { chunkSegments } from "../src/lib/ensemble";

const csvFile = (path: string, name: string) =>
  new File([readFileSync(path)], name, { type: "text/csv" });

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

const file = csvFile("public/datasets/csv-fixtures/survey-comma.csv", "survey-comma.csv");

// 1. inspect
const insp = await inspectFile(file);
check("inspect: tabular, feedback suggested",
  insp.mode === "tabular" && JSON.stringify(insp.suggestedTextColumns) === "[3]",
  JSON.stringify(insp.suggestedTextColumns));

// 2. process with explicit override [3]
const nlp = await processFileViaNlp(file, [3]);
check("process: tabular mode with units",
  nlp.mode === "tabular" && Array.isArray(nlp.units) && nlp.units.length > 50,
  `units=${nlp.units?.length}`);
check("process: csv metadata present",
  nlp.csv?.textColumns?.[0] === 3 && nlp.csv?.rowCount === 60,
  JSON.stringify(nlp.csv));
check("process: sentiment basis per-row-mean", nlp.sentiment?.basis === "per-row-mean");

// 3. segments -> chunk packing
const segments = (nlp.units ?? []).map((u) => u.text);
const plan = chunkSegments(segments);
check("segments packed within chunk cap",
  plan.chunks.length >= 1 && plan.chunks.every((c) => c.length <= 8000),
  `n=${plan.chunks.length}`);

// 4. reliability on deterministic pseudo-runs (demo generator semantics)
const seeds = [42, 123, 456, 789];
const runs = seeds.map((seed) => ({
  seed,
  themes: [
    { name: "Onboarding confusion", description: "Setup and verification confused users.", keywords: ["onboarding"], prevalence: 70 },
    { name: "Trust in support", description: "Support responsiveness built trust.", keywords: ["support"], prevalence: 55 },
  ].slice(0, seed % 2 === 0 ? 2 : 1),
}));
const rel = await callReliability(runs, { cosineThreshold: 0.7, minOccurrenceRatio: 0.5 });
check("reliability: runCount 4 + kappa", rel.runCount === 4 && rel.kappa !== null,
  JSON.stringify(rel.kappa?.meanKappa));

// 5. evidence in units mode with row provenance
await enrichConsensusWithEvidence("unused-in-units-mode", rel.consensus.themes, nlp.units);
const theme0 = rel.consensus.themes[0];
check("evidence: spans cite rowIndex + columnName",
  (theme0.evidence ?? []).some((s) => typeof s.rowIndex === "number" && s.columnName === "feedback"),
  JSON.stringify((theme0.evidence ?? []).slice(0, 2)));

// 6. error contract: malformed CSV surfaces as 400 (not 503)
const bad = csvFile("public/datasets/csv-fixtures/malformed.csv", "malformed.csv");
try {
  await processFileViaNlp(bad);
  check("malformed CSV raises", false);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number }).status;
  check("malformed CSV -> client error 400 citing row",
    status === 400 && msg.includes("37"), `status=${status} msg=${msg}`);
}

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
