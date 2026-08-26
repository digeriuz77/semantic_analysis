/** Smoke test for the COREQ repo layer + schema migration. Run with bun. */
process.env.CORPUS_DB_PATH = process.env.CORPUS_DB_PATH || "./data/coreq-smoke.db";
import { getCoreqResponses, upsertCoreqResponse, createDocument, listDocuments } from "../src/db/repos";

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, d = "") => {
  if (c) pass++;
  else fail++;
  console.log(`  ${c ? "PASS" : "FAIL"}  ${n} ${d}`);
};

upsertCoreqResponse("study-a", 1, true, "Reported in methods section");
upsertCoreqResponse("study-a", 2, false, "");
upsertCoreqResponse("study-b", 1, false, "different study");
const a = getCoreqResponses("study-a");
check("study-a item 1 round-trips", a[1]?.checked === true && a[1]?.detail === "Reported in methods section");
check("study-a item 2 round-trips", a[2]?.checked === false);
check("study-b isolated", Object.keys(getCoreqResponses("study-b")).length === 1);
upsertCoreqResponse("study-a", 1, false, "updated note");
const a2 = getCoreqResponses("study-a");
check("upsert overwrites", a2[1]?.checked === false && a2[1]?.detail === "updated note");
upsertCoreqResponse("   ", 3, true, "x");
check("blank study key falls back to default", getCoreqResponses("default")[3]?.checked === true);
let threw = false;
try {
  upsertCoreqResponse("s", 99, true, "");
} catch {
  threw = true;
}
check("itemId out of range rejected", threw);

// Existing tables still initialize from the bundled schema.
const doc = createDocument({ fileName: "t.txt", sourceType: "interview", content: "hello world" });
check("documents table intact", listDocuments().some((d) => d.id === doc.id));

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
