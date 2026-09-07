# Quick Start & Practical Calibration Guide

A straightforward, no-nonsense guide to running the **Thematic Analyzer**, selecting the right data files, tweaking calibration settings, and producing qualitative impact reports without getting bogged down in theoretical options.

---

## 1. Quick Start: The 2 Commands

The app requires two background processes running simultaneously on your machine:

### Terminal 1: Python NLP Service (Port 8000)
Open PowerShell and run:
```powershell
cd c:\builds\semantic-analysis\semantic_analysis\nlp_service
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 127.0.0.1 --port 8000
```
> *Expected output:* `Application startup complete. Uvicorn running on http://127.0.0.1:8000`

### Terminal 2: Web Interface (Port 4000)
Open a second PowerShell window and run:
```powershell
cd c:\builds\semantic-analysis\semantic_analysis
bun run dev
```
> Open your browser to: **`http://localhost:4000/analyzer`**

---

## 2. Your Ready-to-Use Data Files

All raw data in `.kilocode/data` has been parsed and organized into **[`.kilocode/data/processed/`](file:///c:/builds/semantic-analysis/semantic_analysis/.kilocode/data/processed)**. 

Every single file in this directory already includes **all 4 original data streams** (not just reflections):
- ✅ **Teacher Reflections** (*what worked, what failed, internal shifts*)
- ✅ **Coach Logs** (*T-GROW notes from Gary, Shamim, Eddy*)
- ✅ **Coaching Conversation Notes** (*session minutes & targets*)
- ✅ **Submitted Materials & Artifacts** (*lesson plans, baseline mappings, student survey quotes*)

### Recommended Run Options:

| Run Mode | File(s) to Upload | What It Does |
| :--- | :--- | :--- |
| **Option A: Multi-Teacher Comparison** *(Recommended)* | Drag all 6 dossiers from [`.kilocode/data/processed/teachers/`](file:///c:/builds/semantic-analysis/semantic_analysis/.kilocode/data/processed/teachers/) (`Habib`, `Healery`, `Anis`, `Carolyne`, `Anthony`, `Joshua`) | Analyzes each teacher independently, then enables the **Synthesized Impact Report** across all 6 cases. |
| **Option B: Full Corpus Single Pass** | [`Complete_Coaching_Corpus_Dated.txt`](file:///c:/builds/semantic-analysis/semantic_analysis/.kilocode/data/processed/Complete_Coaching_Corpus_Dated.txt) | Analyzes all 68 records across all teachers and coaches as a single unified dataset. |
| **Option C: Structured Tabular (CSV)** | [`sarawak_coaching_corpus.csv`](file:///c:/builds/semantic-analysis/semantic_analysis/.kilocode/data/processed/sarawak_coaching_corpus.csv) | Uses row-by-row units (`row 12 · content`) for precise spreadsheet-style evidence citations. |

*(Optional: If you ever want to isolate just one perspective, use `All_Teacher_Reflections_Dated.txt`, `All_Coach_Reflections_Dated.txt`, or `All_Instructional_Materials_Dated.txt`.)*

---

## 3. The "No-Nonsense" Golden Path

Skip the novelty features and academic debates. Use this exact sequence every time:

```
[ 1. Upload ]
  • Drag either the 6 teacher files from teachers/ OR Complete_Coaching_Corpus_Dated.txt
       │
       ▼
[ 2. Research Design ]
  • Paradigm: "Pragmatic" (Focuses strictly on real-world, actionable findings)
  • Framework: "Reflexive Thematic Analysis (Braun & Clarke)"
  • Research Question: Type your question or click a preset (e.g. "DLP & Dialogic Practice")
       │
       ▼
[ 3. Configure & Run ]
  • Seeds: 3 (Standard)
  • Temperature: 0.7 (or 0.3 for strict literal grounding)
  • Click "Run Ensemble"
       │
       ▼
[ 4. Synthesized Impact Report ]
  • Review the consensus themes and dated evidence
  • Click the "Synthesized Impact Report" button in the top bar
  • Download the LEAP-style report (.md) with dated quotes and triangulated tables
```

---

## 4. How to Tweak & Calibrate Performance

When you reach the **Configure** step, use these guidelines to calibrate your run:

### A. Number of Seeds (Speed vs. Reliability)
- **1 Seed** (Sanity Check): Runs in ~10–15s. Single pass, good for testing that a file parses.
- **3 Seeds** (*Recommended Standard*): Runs 3 independent seeded passes (`42, 123, 456`). Only themes that multiple runs agree on become Consensus Themes. This filters out random LLM hallucinations.
- **6 Seeds** (Publication Grade): Maximum consistency and rigorous agreement verification.

### B. Sampling Temperature (Creativity vs. Strictness)
- **0.2 – 0.4** (*Strict & Grounded*): Keeps the model tightly bound to verbatim evidence. Best if you want direct quotes with minimal extrapolation.
- **0.7** (*Default Balanced*): Good balance between identifying broader pedagogical patterns and verbatim evidence.
- **Avoid > 1.0**: Causes erratic, fragmented theme extraction.

### C. Cosine Similarity Threshold (Theme Merging Sensitivity)
Controls how similar two differently phrased themes must be to merge into the same equivalence class:
- **0.70** (*Default*): Groups paraphrased themes (e.g. *"Wait time for student thinking"* and *"Pausing after questions"*).
- **Raise to 0.75 – 0.80**: If themes are merging too broadly and losing specific nuances.
- **Lower to 0.60 – 0.65**: If the model gives duplicate themes that say almost the exact same thing.

### D. Occurrence Ratio (Consensus Threshold)
- **0.50** (*Default*): A theme must appear in at least 50% of the runs to become a Consensus Theme.
  - **High Tier**: Appeared in $\ge 83\%$ of runs (core, undeniable pattern).
  - **Moderate Tier**: Appeared in $50\% - 66\%$ of runs (emerging pattern).

---

## 5. What to Look Out For (Common Gotchas)

1. **Python Service Disconnected**:
   - If you see `NLP_UNAVAILABLE (503)`, check Terminal 1. The Python Uvicorn server must be active on port 8000.
2. **Text Document Length**:
   - The app now parses up to **8 chunks (64,000 characters / ~12,000 words)** per file.
   - All individual dossiers and the complete coaching corpus are well within this limit.
3. **CSV Column Picker**:
   - When uploading `.csv` files, the app displays a **Column Picker**. Simply verify that `content` and `key_quote` are checked, then click Continue.
4. **Quotation Dates**:
   - The processed files contain explicit date headers (e.g., `### [2026-05-15] Teacher Reflection: Carolyne`). The report generator automatically pulls these timestamps into your quotation callout cards.

---

## 6. What the Synthesized Impact Report Produces

Clicking **"Synthesized Impact Report"** emulates the **LEAP Mid-Programme Impact Report** format and produces:
1. **Executive Summary**: Headline finding directly answering your Research Question.
2. **Evaluation Strands**: Structured breakdowns (*Classroom Practice*, *Coaching Cadence*, *Language Context*).
3. **Triangulated Cross-Role Matrix**: Direct comparison of `Teacher Evidence | Coach Evidence | Classroom Artifact Evidence`.
4. **Attributed Participant Voice**: Quoted callout cards with speaker names, roles, exact dates, and context.
5. **Strengths & Risks**: Key enabling factors vs. emerging bottlenecks.
6. **Action Plan**: Prioritized recommendations for the next coaching phase.
7. **Export Options**: 1-click **Copy Markdown** or **Download (.md)**.
