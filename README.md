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

- **Ensemble runs** — 1–6 independent runs with fixed seeds for reproducible
  variation (quick mode with 1 seed, rigorous mode with 6).
- **Dual reliability metrics** — Cohen's kappa (Landis & Koch bands) + run-pair
  cosine similarity, visualised as a similarity matrix heatmap.
- **Consensus themes** — semantic clustering groups paraphrased themes; themes
  appearing in ≥50% of runs become consensus themes, tiered high (≥83%) vs
  moderate (50–66%).
- **Multi-provider** — Fireworks, OpenAI, Anthropic, Google Gemini, and
  OpenRouter adapters behind a unified `ChatAdapter`. Add API keys in
  `.env.local` to enable providers; the UI surfaces only configured ones.
- **Cross-model comparison** — run the same corpus through multiple models
  simultaneously and compare κ / cosine / consensus counts head-to-head.
- **Custom prompts** — editor with live `{seed}` / `{text_chunk}` substitution
  preview; defaults to Braun & Clarke reflexive TA.
- **Configurable** — seeds, temperature, cosine threshold, occurrence ratio,
  model, and provider.
- **Demo mode** — without an LLM key the app generates deterministic themes so
  the reliability dashboard stays fully explorable.
- **NLP preprocessing** — NLTK tokenization/lemmatization, VADER sentiment,
  readability, word frequency; supports `.txt`, `.pdf`, `.docx`, `.csv`.
- **Specialist lens** — Schön double-loop reflection analysis (kept as one
  analytical framework; generalised into a frameworks library in Phase 3).

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

See `.kilocode/roadmap.md` for the full phased plan. Phases 0–2 (foundation +
reliability core + multi-provider/model-compare) are complete; Phase 3
(methodology scaffolding) is next.
