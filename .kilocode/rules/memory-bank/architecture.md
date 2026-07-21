# System Patterns: Semantic & Thematic Analyzer

## Architecture Overview (current)

```
src/
├── app/
│   ├── page.tsx                 # redirects to /analyzer
│   ├── analyzer/page.tsx        # client view-router: upload | dashboard | specialist
│   ├── api/
│   │   ├── analyze/route.ts     # file → NLP service → Fireworks (single LLM theme run)
│   │   └── specialist/route.ts  # Schön double-loop reflection via Fireworks
│   ├── layout.tsx, globals.css
├── components/                  # FileUpload, Dashboard, ProcessingView, SpecialistView
├── lib/fireworks.ts             # single-provider LLM client + JSON/theme sanitizers
└── types/index.ts               # AnalysisResult, Theme, SpecialistResult, NLPStats

nlp_service/                     # Python FastAPI + NLTK
└── main.py                      # /process (extract/clean/stats/heuristic sentiment), /health
```

## How a request flows today
1. Browser uploads file(s) → `/api/analyze`.
2. API forwards file to Python `/process` (NLTK stats + heuristic sentiment + cleaned text).
3. API calls Fireworks **once** for 3-5 themes (falls back to keyword-derived "themes" if no key).
4. Dashboard renders stats, word-frequency chart, sentiment rings, themes, cleaned text.
5. Optional `/api/specialist` runs a second single LLM call for Schön reflection analysis.

## Known limitations (drives the roadmap)
- Single LLM run → no reliability signal (is a theme robust or an artifact?).
- No Cohen's κ, no cosine/semantic consistency.
- One provider (Fireworks/Llama 3 70B); keys env-resolved server-side ✓.
- Heuristic sentiment (word-list), not a validated lexicon.
- Teaching lens hardcoded; no paradigm/methodology selection, no COREQ, no saturation.
- No export / reproducibility manifest.

## Target architecture (see `.kilocode/roadmap.md` for full plan)

```
Browser (Next.js 16 App Router)
  ResearchDesign → Upload/Gallery → Configure(seeds,temp,model,prompt)
    → RunEnsemble → ReliabilityDashboard → ConsensusThemes → Export
  src/lib/llm/        ChatAdapter interface + per-provider modules (server-only keys)
  src/lib/frameworks  analytical frameworks library (Schön is one of many)
  src/lib/prompts     {seed}/{text_chunk} template engine

Next.js API (server)
  /api/analyze-ensemble  /api/reliability  /api/consensus
  /api/frameworks        /api/export      (/api/analyze kept for migration)

Python NLP Service (existing /process + /health)
  NEW /embed (sentence-transformers all-MiniLM-L6-v2)
  NEW /kappa (sklearn pairwise + aggregate, Landis-Koch bands)
  NEW /sentiment (VADER)   NEW /consensus (semantic clustering)

public/datasets/         Demo gallery + benchmark transcript
.kilocode/methodology/   Distilled methodology references (paradigms, COREQ, saturation)
```

## Key design patterns
- **Server-only secrets:** all LLM keys read from env in API routes; never shipped to the browser.
- **Graceful degradation:** no key → deterministic demo/mock output (already used in specialist route; standardize).
- **Provider abstraction:** one `ChatAdapter` interface so multi-provider (Phase 2) is additive, not a rewrite.
- **Ensemble + dual metrics:** configurable seeds/temp/model → multiple runs → κ (categorical) + cosine (semantic) → structure-agnostic consensus with confidence tiers.
- **Paradigm-aware:** metrics surfaced depend on chosen paradigm (constructivist → trustworthiness; post-positivist → κ).

## File naming & conventions
- Components: PascalCase; utilities: camelCase; routes: lowercase `page.tsx`/`route.ts`.
- Server Components by default; `"use client"` only where interactivity is required.
- Styling: Tailwind utilities directly on elements; shared card/section classes composed where repeated.

## State management
- Today: local `useState` in the analyzer page; no global store, no persistence.
- Target: in-session + `localStorage` for configs/manifests (Phase 4); optional DB via add-database recipe only in Phase 5.
