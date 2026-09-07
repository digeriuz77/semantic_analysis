import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("=================================================================");
  console.log("RUNNING COMPLETE ALL-IN-ONE SARAWAK COACHING THEMATIC ANALYSIS");
  console.log("=================================================================");

  const corpusPath = path.resolve(".kilocode/data/processed/Complete_Coaching_Corpus_Dated.txt");
  if (!fs.existsSync(corpusPath)) {
    throw new Error(`Corpus file not found: ${corpusPath}`);
  }

  const fileBytes = fs.readFileSync(corpusPath);
  const blob = new Blob([fileBytes], { type: "text/plain" });

  const researchQuestion =
    "How does instructional coaching support primary STEM teachers in adopting dialogic strategies and managing student talk in English (DLP), and what pedagogical barriers emerge across participants?";

  const formData = new FormData();
  formData.append("file", blob, "Complete_Coaching_Corpus_Dated.txt");
  formData.append("seeds", "42,123,456");
  formData.append("temperature", "0.7");
  formData.append("model", "accounts/fireworks/models/deepseek-v4-flash-0731");
  formData.append("provider", "fireworks");
  formData.append("cosineThreshold", "0.68");
  formData.append("minOccurrenceRatio", "0.5");
  formData.append("paradigm", "pragmatic");
  formData.append("framework", "reflexive_ta");
  formData.append("researchQuestion", researchQuestion);

  console.log("\n1. Sending corpus to /api/analyze-ensemble (seeds: 42, 123, 456)...");
  console.log(`Corpus size: ${(fileBytes.length / 1024).toFixed(1)} KB`);
  const t0 = Date.now();

  const res = await fetch("http://localhost:4000/api/analyze-ensemble", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Analysis failed (${res.status}): ${err}`);
  }

  const ensembleResult = await res.json();
  const durSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Ensemble analysis complete in ${durSec}s!`);
  console.log(`Discovered Consensus Themes: ${ensembleResult.reliability.consensus.themes.length}`);
  for (const r of ensembleResult.runs) {
    console.log(`  Seed ${r.seed}: ${r.themes.length} themes (status: ${r.provenance?.status})`);
  }
  const meanCos = ensembleResult.reliability.consensus.meanCosine;
  console.log(`Mean Cosine Consistency: ${Number.isFinite(meanCos) ? (meanCos * 100).toFixed(1) + "%" : "N/A"}`);
  console.log(`Cohen's Kappa: ${ensembleResult.reliability.kappa?.meanKappa !== undefined ? ensembleResult.reliability.kappa.meanKappa.toFixed(3) : "N/A"}`);

  // 2. Synthesize Impact Report
  console.log("\n2. Calling /api/synthesize-report to produce LEAP-style impact report...");
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const synthRes = await fetch("http://localhost:4000/api/synthesize-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      results: [ensembleResult],
      researchQuestion,
      provider: "fireworks",
      model: "accounts/fireworks/models/deepseek-v4-flash-0731",
    }),
  });

  if (!synthRes.ok) {
    const err = await synthRes.text();
    throw new Error(`Report synthesis failed (${synthRes.status}): ${err}`);
  }

  const report = await synthRes.json();
  console.log("Report synthesis complete!");

  // 3. Save artifacts to Reports/
  const reportsDir = path.resolve("Reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const jsonPath = path.join(reportsDir, "All_In_One_Analysis.json");
  fs.writeFileSync(jsonPath, JSON.stringify(ensembleResult, null, 2), "utf-8");
  console.log(`Saved analysis JSON: ${jsonPath}`);

  // Save themes CSV
  const csvRows = [
    ["theme_label", "tier", "occurrence", "consistency", "keywords", "description"],
  ];
  for (const t of ensembleResult.reliability.consensus.themes) {
    csvRows.push([
      `"${t.label.replace(/"/g, '""')}"`,
      t.tier,
      t.occurrence,
      t.consistency,
      `"${t.keywords.join("; ")}"`,
      `"${t.description.replace(/"/g, '""')}"`,
    ]);
  }
  const themesCsvPath = path.join(reportsDir, "All_In_One_Themes.csv");
  fs.writeFileSync(themesCsvPath, csvRows.map((r) => r.join(",")).join("\n"), "utf-8");
  console.log(`Saved themes CSV: ${themesCsvPath}`);

  // Save Full Markdown Report
  const mdPath = path.join(reportsDir, "All_In_One_Impact_Report.md");
  fs.writeFileSync(mdPath, report.markdown, "utf-8");
  console.log(`Saved complete Impact Report: ${mdPath}`);

  console.log("\n=================================================================");
  console.log("ALL-IN-ONE ANALYSIS & REPORT GENERATION FINISHED SUCCESSFULLY!");
  console.log("=================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
