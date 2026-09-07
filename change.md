# Semantic Analysis Platform: Architectural Goals & Change Log

## 1. Overall Goal of the Application

The **Semantic & Thematic Analysis Platform** is an enterprise-grade, methodology-aware qualitative research engine designed to perform scientific, reproducible, and reliability-quantified thematic analysis on unstructured qualitative corpora (such as teacher reflections, coaching logs, interview transcripts, classroom observation notes, and survey responses).

### Core Capabilities & Objectives:
1. **Elimination of Research Hallucination & Confirmation Bias**:
   - Instead of a single, subjective AI query that might generate synthetic or biased impressions, the app executes an **ensemble of independent seeded LLM runs** (e.g. seeds 42, 123, 456).
   - It quantifies inter-rater agreement using mathematical reliability metrics (**Cohen's kappa**, **Krippendorff's alpha**, and **pairwise cosine similarity**) computed over dense sentence embeddings.
2. **Consensus Extraction & Traceable Lineage**:
   - Themes are only accepted as "consensus" if they recur across independent runs above a defined similarity threshold and occurrence ratio.
   - Every consensus theme maintains a rigorous audit trail (**lineage**), recording which seeds generated it, the exact verbatim quotes extracted from the text, and retrieved source evidence spans.
3. **Triangulated Impact Synthesis (LEAP Framework)**:
   - Aggregates multi-source evidence (e.g., Teacher reflections, Instructional Coach observations, and Classroom Artifacts) into structured, executive-level evaluation reports.
   - Reports include headline findings, thematic evaluation strands, cross-role triangulation matrices, grounded participant voices, strengths, systemic risks, and prioritized recommendations.
4. **Zero-Hardcoding Guarantee**:
   - Every analysis starts completely fresh from raw data. There are no pre-populated quotation banks, hardcoded participant personas, or artificial outcomes.

---

## 2. Comprehensive Log of Changes Made

### A. Elimination of Hardcoded Shortcuts
- **Purged Static Quotation Banks**:
  - Removed `CHRONOLOGICAL_QUOTATION_BANK` and static quote arrays from `src/app/api/synthesize-report/route.ts`.
  - Both the LLM prompt and deterministic fallback functions now pull participant quotes dynamically and exclusively from the analysis results and retrieved evidence spans.
- **Strict Organic Extraction**:
  - Prompt templates in `src/lib/prompts.ts` and `src/app/api/synthesize-report/route.ts` were re-engineered to instruct the models to extract verbatim participant quotes, speaker names, roles, and dates solely from the provided text.

### B. Full Longitudinal & Date Preservation
- **Preserved Date and Numerical Tokens**:
  - Previously, `clean_text` in `nlp_service/main.py` stripped all digits and punctuation (`re.sub(r"[^a-zA-Z\s]", "", text)`), which removed all date markers (e.g., `[2026-05-08]`) and participant attributions before the LLM could read them.
  - Modified `src/app/api/analyze-ensemble/route.ts` to feed punctuation-and-number-preserving `extracted_text` directly into the thematic LLM prompts.
- **Expanded Corpus Capacity**:
  - Increased `MAX_CHUNKS` in `src/lib/ensemble.ts` from 8 to 24 (capacity up to 192,000 characters / ~36,000 words per run).
  - The complete 83-record longitudinal coaching corpus (March through November 2026) is now processed in full across 10 chunks with `inputTruncated: false`.

### C. Overhaul of Clustering Engine (Python NLP Microservice)
- **Root Cause Identification**:
  - The original clustering in `nlp_service/reliability.py` used connected components via Union-Find (`_UnionFind`). Because dense sentence embeddings (`all-MiniLM-L6-v2`) for educational texts share high baseline similarity, transitive closure chained 129 out of 130 themes into a single monster cluster (`lineage.length: 129`), leaving only 1 consensus theme.
- **Complete-Linkage Hierarchical Clustering**:
  - Replaced Union-Find single-linkage clustering with **complete-linkage hierarchical clustering** using `scipy.cluster.hierarchy.linkage(..., method="complete")`.
  - Complete linkage guarantees that *every* pair of themes within a cluster satisfies `similarity >= cosineThreshold`, completely eliminating transitive chaining.
  - The 130 extracted themes now cleanly cluster into **25 distinct, coherent consensus themes** across seeds.
  - Updated the prefix saturation curve calculation to use the same complete-linkage clustering.

### D. Synthesis Route & Socket Timeout Optimization
- **Payload Compaction**:
  - Updated `buildSynthesisPrompt` in `src/app/api/synthesize-report/route.ts` to compact the payload: bounding consensus themes to the top 15 and slicing supporting quotes (max 4 per theme) and retrieved evidence (max 3 per theme).
- **Socket Timeout Resolution**:
  - Under Next.js (Turbopack / Node runtime), the undici fetch client has a default 30-second socket timeout. When large reasoning prompts took >30s, the socket closed with `UND_ERR_SOCKET: other side closed`.
  - Tuned the synthesis prompt system instruction to minimize unneeded internal reasoning overhead and set `maxTokens: 3500`.
  - Report synthesis now completes directly via the LLM in **29.4 seconds** with HTTP status 200 without falling back to deterministic synthesis.

### E. Infrastructure, Resilience & Port Fixes
- **Port Conflict Resolution**:
  - Configured Next.js to run on port 4000 via package script to avoid Windows OS-reserved port exclusions on port 3000 (`EACCES: permission denied 0.0.0.0:3000`).
- **Python NLP Syllable Counter Fix**:
  - In `nlp_service/main.py`, patched `count_syllables()` to guard against empty strings and avoid `IndexError`.
- **API Rate-Limit Resilience**:
  - Added exponential backoff retry logic (handling HTTP 429) to `src/lib/llm/fireworks.ts`.
  - Added a safety delay between ensemble analysis and report synthesis in the runner script.

---

## 3. Verified Deliverables & Current Artifacts

- **Synthesized Impact Report**: `Reports/All_In_One_Impact_Report.md`
  - Evaluates the core inquiry regarding dialogic teaching, student English talk (DLP), and pedagogical barriers across Sarawak primary schools.
  - Triangulates evidence from teachers (Joshua, Habib, Anthony, Carolyne, Anis), instructional coaches, and classroom artifacts across the entire 2026 timeline.
- **Consensus Themes CSV**: `Reports/All_In_One_Themes.csv` (25 consensus themes with occurrence, consistency, keywords, and descriptions).
- **Full Provenance JSON**: `Reports/All_In_One_Analysis.json` (complete audit record with prompt traces, seeds, and kappa reliability statistics).
- **Trackers**: `TODO.md` and `.kilocode/rules/memory-bank/context.md`.
