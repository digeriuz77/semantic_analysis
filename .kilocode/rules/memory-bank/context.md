# Active Context: Semantic & Thematic Analyzer

## Current State

**App:** A full-stack "Semantic & Thematic Analyzer" — Next.js 16 frontend + Python (FastAPI/NLTK) NLP service + Fireworks AI (Llama 3 70B) for thematic analysis, plus a Schön double-loop teaching-reflection "Specialist" lens. Functional today in single-run mode.

**Strategic direction (added 2026-07-21):** Evolve from a single-shot theme extractor into a **reliability-quantified, methodologically rigorous** qualitative research platform, synthesizing three external knowledge sources.

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
- [x] Updated this `context.md`

## Current Focus

Planning complete. Awaiting go-ahead to begin **Phase 0 (foundation/hardening)** then **Phase 1 (reliability core)** — the highest-leverage work that converts the app into a research-grade tool.

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
| `src/app/api/analyze/route.ts` | current single-run theme analysis |
| `src/app/api/specialist/route.ts` | current Schön reflection analysis |
| `src/lib/fireworks.ts` | single-provider LLM client + sanitizers |
| `src/types/index.ts` | AnalysisResult, Theme, SpecialistResult, NLPStats |
| `nlp_service/main.py` | NLTK extraction/stats/sentiment |
| `.kilocode/roadmap.md` | **master plan** |

## Session History

| Date | Changes |
|------|---------|
| 2026-07-21 | Architect review: diagnosed current app, synthesized 3 sources, authored roadmap + updated architecture/context memory banks. |
