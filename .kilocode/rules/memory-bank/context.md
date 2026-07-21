# Active Context: Semantic & Thematic Analyzer

## Current State

**App:** Evolved from a single-shot theme extractor into a **reliability-quantified ensemble** thematic analyzer. The headline flow now runs N reproducible seeded LLM runs per document and reports dual reliability metrics (Cohen's κ + cosine) with confidence-tiered consensus themes. The legacy single-run `/api/analyze` route is kept but unused by the UI; the new `/api/analyze-ensemble` is the primary path. A demo mode (deterministic mock themes) keeps the dashboard explorable without an LLM key.

**Phases 0, 1, and 2 are COMPLETE** (see `.kilocode/roadmap.md`). Next: Phase 3 (methodology: paradigm selection, frameworks library, COREQ, saturation).

## What the three sources contribute

| Source | Contribution |
|--------|--------------|
| **Reliability paper** (LLM-Thematic-Analysis-Tool) | Technical core: ensemble of 6 seeded runs, dual metrics (Cohen's κ + cosine over all-MiniLM-L6-v2), configurable seeds/temp, `{seed}`/`{text_chunk}` prompts, structure-agnostic consensus, multi-model. Baselines: κ≈0.84-0.91, cosine≈92-95%. |
| **qualitative-research-skill repo** | Methodological backbone: paradigm-first logic (don't force κ for constructivist work → use Lincoln & Guba trustworthiness), Braun & Clarke 6-step TA + grounded-theory 3-level coding, COREQ 32-item checklist, theoretical saturation, reusable κ calculator + templates. |
| **Qualitative-Text-Datasets-for-UX-Research repo** | Demo corpus + test fixtures: interviews, surveys, focus groups, diary studies, feedback, forums → in-app gallery + integration tests + dataset-type methodology hints. |

## Recently Completed

- [x] Reviewed current codebase (API routes, components, fireworks.ts, nlp_service/main.py)
- [x] Reviewed both GitHub repos and the reliability article
- [x] Authored master plan → `.kilocode/roadmap.md` (target architecture + 5-phase roadmap + decisions + risks + definition of done)
- [x] Updated `architecture.md` to capture current + target patterns
- [x] **Phase 0 — foundation:** migrated Tailwind to v4 `@theme` (navy/gold colors now compile; removed v3 `tailwind.config.ts`); seeded `public/datasets/` (interview, survey, teaching-reflection + `index.json`); removed build-time Google Fonts dependency (system font stack); NLP-down resilience via structured 503 `NLP_UNAVAILABLE` error.
- [x] **Phase 1 — reliability core:** Python `reliability.py` (embed → Union-Find cluster → consensus → Cohen's κ + run-centroid cosine); `/reliability` + `/embed` endpoints; VADER sentiment (NLTK built-in); TS `ChatAdapter` abstraction (`src/lib/llm/`) + ensemble runner (`ensemble.ts`) + prompt engine (`prompts.ts`) + demo generator (`demo.ts`) + NLP client (`nlp.ts`); orchestrator `/api/analyze-ensemble`; UI `AnalysisConfigurator` + `EnsembleDashboard` (κ band, cosine heatmap, consensus tiers, per-run view); rewired analyzer page (upload → configure → results); retired legacy `Dashboard.tsx`.
- [x] Verified: `bun typecheck` ✓, `bun lint` ✓, `bun build` ✓ (all routes register incl. `ƒ /api/analyze-ensemble`); demo engine smoke-tested (6 runs → 4 consensus themes).
- [x] **Phase 2 — multi-provider + custom prompts + model compare:** 4 new `ChatAdapter` modules (OpenAI, Anthropic Messages API, Gemini, OpenRouter) + provider metadata (`src/lib/providers.ts`); `/api/providers` endpoint reports configured providers (keys never leak); custom prompt editor with live `{seed}`/`{text_chunk}` preview in `AnalysisConfigurator`; cross-model `/api/compare-models` endpoint (process file once → run ensemble per model in parallel → per-model κ/cosine/consensus); `ModelCompareView` with comparison table (best-model highlight, κ bands, consensus counts); wired Compare view + nav into analyzer page.

## Current Focus

Phases 0–2 complete and verified. Next is **Phase 3** (methodology: paradigm selection — constructivist vs post-positivist; analytical frameworks library with Braun & Clarke reflexive TA, grounded theory, content analysis; COREQ 32-item checklist; theoretical-saturation heuristic).

## Verification notes (sandbox limitations)
- No `pip` in the sandbox → the Python reliability engine (`reliability.py`) is syntax-verified + logic-reviewed but not runtime-tested here; it runs in its own venv per the README. It degrades gracefully (TF-IDF when `sentence-transformers` absent).
- Port 3000 is served by the sandbox proxy which 404s API POST routes (even pre-existing `/api/analyze`), so API routes can't be curl-tested here. Build output confirms `ƒ /api/analyze-ensemble` is registered; the pure-TS demo engine was smoke-tested directly.

## Phase Summary (full detail in `.kilocode/roadmap.md`)
- **Phase 0** — Foundation: reconcile Tailwind, normalize env/keys, NLP-resilience, lint/typecheck gate, seed demo datasets.
- **Phase 1** — Reliability core: Python `/embed` `/kappa` `/sentiment` `/consensus`; `/api/analyze-ensemble` `/api/reliability` `/api/consensus`; ReliabilityDashboard + ConsensusThemes + AnalysisConfigurator.
- **Phase 2** — Multi-provider `ChatAdapter` + custom prompts + ModelCompare.
- **Phase 3** — Methodology: ResearchDesign (paradigm+method), frameworks library, COREQ, saturation.
- **Phase 4** — DatasetGallery, Export/manifest, cross-model ensemble, adaptive runs.
- **Phase 5** — Persistence via add-database recipe (optional).

## Decisions locked in the plan
- D1: κ/cosine computed **server-side** in the Python service (reuse FastAPI; no heavy WASM in browser).
- D2: **Unified `ChatAdapter`**; all keys server-side only.
- D3: Schön lens **kept and generalized** into a frameworks library; not deleted.
- D4: **Paradigm-aware** metrics (trustworthiness vs κ).
- D5: **Defer DB** to Phase 5; use session + localStorage meanwhile.

## Key files to know
| File | Purpose |
|------|---------|
| `src/app/api/analyze-ensemble/route.ts` | **primary** orchestrator: NLP → ensemble runs → reliability |
| `src/app/api/compare-models/route.ts` | cross-model comparison: process once → per-model ensemble in parallel |
| `src/app/api/providers/route.ts` | reports configured providers (no key leakage) |
| `src/lib/ensemble.ts` | runs N seeded LLM calls in parallel |
| `src/lib/llm/` | `ChatAdapter` abstraction + 5 adapters (fireworks/openai/anthropic/gemini/openrouter) + registry |
| `src/lib/providers.ts` | provider metadata: default model, label, seed-support flag |
| `src/lib/nlp.ts` | Python `/process` + `/reliability` client (raises `NlpUnavailableError`) |
| `src/lib/demo.ts` | deterministic no-key demo ensemble |
| `src/lib/kappa.ts` | Landis-Koch band labels/colors + helpers |
| `src/components/AnalysisConfigurator.tsx` | seeds/temp/threshold/model/provider + custom prompt editor |
| `src/components/EnsembleDashboard.tsx` | reliability + consensus + per-run dashboard |
| `src/components/ModelCompareView.tsx` | cross-model comparison table (κ/cosine/consensus per model) |
| `src/types/index.ts` | RunConfig, ReliabilityReport, ConsensusTheme, EnsembleResult, ModelComparisonResult |
| `nlp_service/reliability.py` | embed + cluster + consensus + κ + cosine |
| `nlp_service/main.py` | `/process` `/reliability` `/embed` `/health`; VADER sentiment |
| `src/app/api/analyze/route.ts` | legacy single-run route (kept, unused by UI) |
| `src/lib/fireworks.ts` | legacy single-provider client + JSON/theme sanitizers (still reused) |
| `.kilocode/roadmap.md` | **master plan** |

## Session History

| Date | Changes |
|------|---------|
| 2026-07-21 | Architect review: diagnosed current app, synthesized 3 sources, authored roadmap + updated architecture/context memory banks. |
| 2026-07-21 | Implemented Phase 0 (Tailwind v4 migration, datasets, font/resilience hardening) and Phase 1 (reliability core: Python engine + orchestrator route + configurator/dashboard UI + ensemble flow). typecheck/lint/build green. |
| 2026-07-21 | Implemented Phase 2 (4 new provider adapters + custom prompt editor with live preview + cross-model compare endpoint + ModelCompareView). typecheck/lint/build green; 2 new routes registered. |
