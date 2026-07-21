# Reliability-Quantified Thematic Analyzer

A full-stack tool for **ensemble** LLM thematic analysis with quantified
reliability. Instead of trusting a single LLM run, it runs an independent
ensemble of reproducible seeded runs and measures how stable the resulting
themes are using **dual metrics**: Cohen's kappa (statistical agreement) and
cosine similarity (semantic consistency), plus **structure-agnostic consensus
extraction** with confidence tiers.

Inspired by the LLM-Thematic-Analysis-Tool methodology, with a methodological
scaffolding roadmap (paradigm-aware metrics, Braun & Clarke / grounded-theory
frameworks, COREQ) drawn from qualitative-research best practice.

## Features

- **Research design first** — select an epistemological paradigm (constructivist,
  post-positivist, critical, pragmatic) and analytical framework (Braun & Clarke
  reflexive TA, grounded theory, content analysis, phenomenology, Schön
  reflection, or custom). The paradigm drives which validity criteria are shown.
- **Ensemble runs** — 1–6 independent runs with fixed seeds for reproducible
  variation (quick mode with 1 seed, rigorous mode with 6).
- **Paradigm-aware reliability** — Cohen's kappa (Landis & Koch bands) +
  run-pair cosine similarity for post-positivist work; Lincoln & Guba
  trustworthiness criteria foregrounded for constructivist work (κ shown as
  supplementary, not mandated). Visualised as a similarity matrix heatmap.
- **Theoretical saturation curve** — distinct theme classes per accumulated run,
  indicating when new themes stop emerging.
- **Consensus themes** — semantic clustering groups paraphrased themes; themes
  appearing in ≥50% of runs become consensus themes, tiered high (≥83%) vs
  moderate (50–66%).
- **Explainability layer** — every theme is auditable: derivation lineage
  (which runs/seeds agreed), evidence grounding (LLM quotes + retrieved source
  spans), per-run provenance (raw output, rendered prompt, parse status), a
  pipeline trace, and researcher annotations (accept/reject/flag).
- **Multi-provider** — Fireworks, OpenAI, Anthropic, Google Gemini, and
  OpenRouter adapters behind a unified `ChatAdapter`. Add API keys in
  `.env.local` to enable providers; the UI surfaces only configured ones.
- **Cross-model comparison** — run the same corpus through multiple models
  simultaneously and compare κ / cosine / consensus counts head-to-head.
- **COREQ checklist** — self-check against the 32 reporting items, with local
  persistence and markdown export.
- **Demo mode** — without an LLM key the app generates deterministic themes so
  the dashboard stays fully explorable.
- **NLP preprocessing** — NLTK tokenization/lemmatization, VADER sentiment,
  readability, word frequency; supports `.txt`, `.pdf`, `.docx`, `.csv`.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, Recharts
- **Backend**: Next.js API Routes (TypeScript)
- **NLP / Reliability engine**: Python FastAPI, NLTK, scikit-learn

## Architecture

```
Browser  →  /api/analyze-ensemble  (orchestrator, server-side)
              ├─ Python /process     (NLTK clean, stats, VADER, keywords)
              ├─ N parallel LLM runs (one per seed; or demo generator if no key)
              └─ Python /reliability  (embed → cluster → consensus → κ + cosine)
```

- `src/lib/llm/` — `ChatAdapter` provider abstraction (Fireworks shipped;
  OpenAI/Anthropic/Gemini/OpenRouter slot in via the same interface in Phase 2).
- `src/lib/ensemble.ts` — runs the seeded ensemble in parallel.
- `src/lib/nlp.ts` — client for the Python `/process` and `/reliability` endpoints.
- `nlp_service/reliability.py` — embedding (sentence-transformers if installed,
  else TF-IDF), Union-Find clustering, Cohen's kappa, run-centroid cosine.

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Python NLP service

```bash
cd nlp_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python setup_nltk.py
python main.py          # serves http://localhost:8000
```

Optional: `pip install sentence-transformers` upgrades theme embeddings from
lexical TF-IDF to true semantic (paraphrase-aware) vectors.

### 3. Environment

Copy `.env.example` to `.env.local`. `FIREWORKS_API_KEY` is optional — leave it
empty to run in demo mode.

### 4. Run

The Next.js app is served on `http://localhost:3000` (see project dev rules).
Upload a document (or try a sample from `public/datasets/`), configure the
ensemble, and run.

## Demo datasets

`public/datasets/` contains synthetic corpora (interview, open-ended survey,
teaching reflection) with an `index.json` manifest for a future dataset gallery.

## Roadmap

See `.kilocode/roadmap.md` for the full phased plan. Phases 0–3 (foundation +
reliability core + multi-provider/model-compare + explainability +
methodology scaffolding) are complete; Phase 4 (dataset gallery, export
manifest, cross-model ensemble, adaptive runs) is next.
