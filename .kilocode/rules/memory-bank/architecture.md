# System Patterns: Semantic & Thematic Analyzer

## Architecture Overview (after Phase 0–1)

```
src/
├── app/
│   ├── page.tsx                       # redirects to /analyzer
│   ├── analyzer/page.tsx              # flow: upload → configure → results (+ specialist)
│   ├── api/
│   │   ├── analyze-ensemble/route.ts  # PRIMARY orchestrator: NLP → ensemble → reliability
│   │   ├── analyze/route.ts           # legacy single-run (kept, unused by UI)
│   │   └── specialist/route.ts        # Schön double-loop reflection
│   ├── layout.tsx, globals.css        # Tailwind v4 @theme (navy/gold/system font)
├── components/
│   ├── FileUpload, ProcessingView, SpecialistView
│   ├── AnalysisConfigurator.tsx       # seeds/temp/threshold/model
│   └── EnsembleDashboard.tsx          # κ + cosine heatmap + consensus tiers + per-run
├── lib/
│   ├── llm/  (types.ts, fireworks.ts, index.ts)   # ChatAdapter abstraction
│   ├── ensemble.ts   prompts.ts   demo.ts   nlp.ts   kappa.ts
│   └── fireworks.ts                    # legacy client + shared JSON/theme sanitizers
└── types/index.ts                      # + RunConfig, ReliabilityReport, ConsensusTheme, EnsembleResult

nlp_service/
├── main.py          # /process (NLTK + VADER) /reliability /embed /health
├── reliability.py   # embed → Union-Find cluster → consensus → Cohen's κ + cosine
└── requirements.txt

public/datasets/     # synthetic corpora + index.json (demo gallery / fixtures)
```

## How a request flows now (primary path)
1. Browser uploads file(s) → `/api/analyze-ensemble` (server-side, keys never shipped).
2. API calls Python `/process` → cleaning, NLTK stats, **VADER** sentiment, keywords.
3. API runs the ensemble: N parallel LLM calls (one per seed) via `ChatAdapter`,
   or `generateDemoRuns` if no key is configured (demo mode).
4. API calls Python `/reliability` → embeddings → Union-Find clustering into
   equivalence classes → consensus themes (confidence tiers) → Cohen's κ
   (Landis-Koch bands) + run-centroid cosine matrix.
5. `EnsembleDashboard` renders reliability metrics, consensus themes, overview,
   and per-run themes.

## Reliability engine details (nlp_service/reliability.py)
- Embeddings: `sentence-transformers` all-MiniLM-L6-v2 if installed, else TF-IDF
  (sklearn) — surfaced as `embeddingBackend` so users know.
- Clustering: connected components (Union-Find) over cosine ≥ threshold.
- κ: `cohen_kappa_score` on theme presence/absence vectors per run pair.
- Cosine: run-centroid dot product (normalised embeddings).
- Returns null κ/cosine when <2 runs or insufficient themes.

## Known limitations remaining (drives Phases 3–5)
- Multi-provider works but no paradigm/methodology selection, COREQ, saturation (Phase 3).
- No export / reproducibility manifest (Phase 4).
- No DB persistence (Phase 5).

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
