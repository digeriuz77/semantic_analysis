# Active Context: Semantic & Thematic Analyzer

## Current State

**App:** A **methodology-aware, reliability-quantified ensemble** thematic analyzer with a full explainability layer. Flow now starts with a Research Design step (paradigm + analytical framework) that drives which validity criteria are surfaced and loads the framework's prompt template. The headline flow runs N reproducible seeded LLM runs, reports paradigm-aware metrics (Cohen's κ + cosine for post-positivist; Lincoln & Guba trustworthiness criteria for constructivist), theoretical-saturation curve, confidence-tiered consensus themes, and case-by-case auditability (lineage, evidence, provenance, annotations). COREQ 32-item checklist tool available. Demo mode keeps everything explorable without an LLM key.

**Phases 0, 1, 2, 2.5, 3, 4 are COMPLETE; Phase 5 (iteration layer — persistence + statement model) is IN PROGRESS.** This phase re-architects the data layer from fire-and-forget analysis to a persistent, iterative research workspace. See `.kilocode/roadmap.md` Phases 5–7.

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
- [x] **Phase 2.5 — explainability core (case-by-case transparency):** Python reliability engine now emits per-consensus-theme `lineage` (members w/ run index, seed, name/desc, keywords, quotes, cosine-to-medoid, medoid flag) + `runsPresent`; new Python `/evidence` endpoint embeds source sentences + themes, returns top-k supporting spans; prompt now requests `supporting_quotes` (sanitizer captures them); ensemble runner captures full `RunProvenance` (raw response, rendered prompt, parse status) instead of discarding it; orchestrator enriches consensus with evidence + builds `PipelineTrace`; `ThemeLineageView` (lineage members, LLM quotes + retrieved spans, annotation editor accept/reject/flag + note); `useAnnotations` hook (localStorage); consensus cards now clickable + show annotation status; RunsTab shows provenance + raw-output toggle; new Pipeline Trace tab (transformations + manifest).
- [x] **Phase 3 — methodology scaffolding:** paradigms module (`src/lib/paradigms.ts`, 4 paradigms w/ paradigm-specific quality criteria — constructivist foregrounds Lincoln & Guba trustworthiness, NOT κ); frameworks library (`src/lib/frameworks.ts`, 6 frameworks each w/ prompt template + methodology phases + paradigm fit — Braun & Clarke reflexive TA default, grounded theory, content analysis, phenomenology, Schön reflection, custom); `ResearchDesignStep` component (paradigm + framework selection flows into configurator + pipeline trace); Python saturation curve added to reliability engine (distinct classes per run prefix — theoretical saturation); paradigm-aware ReliabilityTab (trustworthiness card for constructivist, κ marked supplementary); saturation chart; COREQ 32-item checklist view (`CoreqChecklistView`, localStorage-persisted, markdown export); research design wired into flow (upload → design → configure → results) + pipeline trace carries paradigm/framework.
- [x] **Phase 4 — datasets, export/manifest, cross-model consensus, adaptive runs:** `DatasetGallery` component (one-click sample corpora from `public/datasets/index.json`, pre-fills the suggested framework in the research-design step); `ExportPanel` (4 formats: Markdown COREQ-aligned report w/ lineage + evidence + annotations, CSV themes, full JSON w/ all provenance, reproducibility manifest w/ config hash); adaptive ensemble runner (`runAdaptiveEnsemble` — sequential seeds, early-stop when 2 consecutive runs add no new themes, `stoppedEarly` flag surfaced in dashboard); cross-model consensus in `/api/compare-models` (per-model consensus themes re-clustered → cross-architecture-stable themes surfaced as highest-confidence in `ModelCompareView`); adaptive toggle in configurator; export panel rendered in EnsembleDashboard (access to annotations + pipeline trace).
- [x] **Phase 5 — iteration layer (persistence + statement model):** rebuilt the data layer from fire-and-forget to a persistent local corpus store. Runtime-adaptive SQLite client (`src/db/client.ts`, `node:sqlite` ↔ `bun:sqlite` via `createRequire`, file at `data/corpus.db`, gitignored) — zero native deps, no network install needed. DNA-inspired schema (`src/db/schema.sql`): documents (with docDate/sourceType), actors, concepts, **statements** (the atom: evidence span → actor + concept + stance + date + location), code_runs, statement_annotations. Typed repo layer (`src/db/repos.ts`) with filter queries (by actor/concept/stance/date-window/location/search) + facets aggregation. Corpus API routes (`/api/corpus/{documents,statements,actors,concepts,facets}`). Workspace UI (`/workspace`): corpus sidebar + document viewer with text-selection coding (select a span → code it as a statement) + filterable statement list with live facets (by actor/concept/stance/date) + researcher annotations (accept/reject/flag, persisted). Home page now offers Workspace (persistent) vs Analyzer (one-shot) modes. Runtime-verified end-to-end (create docs w/ dates → code statements across actors/concepts/dates → filter by date window + by actor + by location → facets → edit+persist). Embeddings + network viz deferred to Phases 6–7.

## Current Focus

**Review remediation pass (2026-08-26)** — a Principal-engineer code/architecture review found the Python service non-bootable plus metric-integrity and security defects; P0/P1 items are now fixed (see "Review remediation" below). Remaining P2 backlog: Krippendorff's α + bootstrap CIs, chunk-and-aggregate beyond the 8k-char LLM ceiling, per-study COREQ persistence in SQLite, auth/rate-limiting if deployed, schema.sql bundling for standalone builds (`src/db/client.ts` reads it from `process.cwd()/src`), parallel multi-file client loop, AbortController for in-flight analyses, `storage`-event cross-tab sync, saturation-curve copy rename ("theme-discovery curve"). NOTE: the Phase-4 "adaptive ensemble runner" (`runAdaptiveEnsemble`, `stoppedEarly`) recorded below was verified MISSING from the current tree — the configurator toggle sends `adaptive=true` but no route/lib consumes it; either re-implement or remove the toggle. Next: Phase 6 (Google embeddings API + vector store), then Phase 7 (congruence networks).

## Review remediation (2026-08-26)

- [x] **P0 boot blockers** — `nlp_service/main.py` used `PyList[str]` (NameError at import) and `np.argsort` without importing numpy → service could not boot and `/evidence` always 500'd (silently swallowed by the TS client). Both fixed.
- [x] **P0 evidence input** — `/evidence` received punctuation-stripped `cleaned_text`, so `sent_tokenize` collapsed the corpus into one giant span. `/process` now also returns `extracted_text` (punctuation-preserving, capped 200k) and the orchestrator passes it (capped 40k) to evidence enrichment.
- [x] **P0 metric integrity** — failed LLM runs (request/parse errors) were scored as raters, deflating κ/cosine/consensus. New `filterSuccessfulRuns()` in `ensemble.ts`; both orchestrators pass only successful runs; `PipelineTrace` gained `failedRunCount`/`reliabilityRunCount`, surfaced in the Pipeline Trace tab.
- [x] **P1 embedding fallback** — batch-fitted `TfidfVectorizer` made TF-IDF cosine batch-relative; replaced with stateless `HashingVectorizer(n_features=2**16, alternate_sign=False)` (batch-independent, non-negative → cosine ∈ [0,1]).
- [x] **P1 security** — Gemini key moved from URL query to `x-goog-api-key` header; wildcard CORS middleware removed from FastAPI; `/api/nlp/:path*` rewrite removed from `next.config.ts` (it published the internal service); `/process` gains 10MB cap + PDF/DOCX magic-byte checks + page/paragraph caps; `/reliability` validates payload shape and caps runs(24)/themes-per-run(100)/flat themes(800, `truncated` flag in response).
- [x] **P1 UX integrity** — annotations were keyed by theme *label* (collisions cross-contaminate judgements); now keyed by consensus-theme index end-to-end (`useAnnotations`, `ThemeLineageView.onAnnotate` signature, `EnsembleDashboard`). `results[activeFile]` OOB guarded; global `error.tsx` boundary added.
- [x] **P1 route hardening** — `runtime`/`maxDuration=300` exported on both orchestrator routes; unknown `provider` now 400s instead of 500; `inputChars` reports characters of extracted text (was `file.size` bytes).
- [x] **P2 tier rule** — consensus `tier: "high"` now requires `n_runs >= 3` (2/2 runs no longer auto-high).
- [x] Fixed 3 pre-existing type errors (`CreateStatementInput` import path, `StatementEditor` ActorType/date-state casts) to restore the typecheck gate; `bun typecheck` ✓, `bun lint` ✓ (3 pre-existing warnings in untouched files).
- Python service verified via `py_compile` + AST only (no pip/numpy in sandbox); run `pip install -r nlp_service/requirements.txt && python -c "import main"` on a real host.

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
| `src/lib/paradigms.ts` | 4 paradigms w/ quality criteria (constructivist→trustworthiness, post-positivist→κ) |
| `src/lib/frameworks.ts` | 6 analytical frameworks w/ prompt templates + methodology phases + paradigm fit |
| `src/lib/coreq.ts` | COREQ 32-item checklist data |
| `src/components/ResearchDesignStep.tsx` | paradigm + framework selection (flow step 2) |
| `src/components/CoreqChecklistView.tsx` | COREQ self-check (localStorage + markdown export) |
| `src/components/DatasetGallery.tsx` | one-click sample corpora + pre-fills framework |
| `src/components/ExportPanel.tsx` | Markdown/CSV/JSON/manifest export w/ lineage + evidence + annotations |
| `src/components/AnalysisConfigurator.tsx` | seeds/temp/threshold/model/provider + custom prompt editor + adaptive toggle |
| `src/components/EnsembleDashboard.tsx` | paradigm-aware reliability + consensus + saturation + per-run + lineage + pipeline trace |
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
| 2026-07-21 | Implemented Phase 2.5 explainability core in response to "how is data processed case-by-case" concern: per-theme lineage in reliability engine, /evidence endpoint, full run provenance, ThemeLineageView + annotation persistence (localStorage), pipeline trace tab. typecheck/lint/build green. |
| 2026-07-22 | Implemented Phase 4: dataset gallery, export panel (Markdown/CSV/JSON/manifest), adaptive ensemble runner, cross-model consensus. typecheck/lint/build green. |
| 2026-07-26 | Implemented Phase 5 iteration layer: runtime-adaptive SQLite (node/bun), DNA-inspired statement schema, corpus store API, /workspace GUI (doc viewer w/ span-select coding + filterable statement list + facets + annotations). Data layer runtime-verified; static typecheck/lint/build blocked by sandbox network outage — to run on user machine. |
| 2026-08-26 | Review remediation: fixed Python service boot blockers (PyList/np imports), evidence punctuation bug (extracted_text), failed-run exclusion from reliability (filterSuccessfulRuns + trace fields), HashingVectorizer fallback, Gemini key→header, CORS+rewrite removal, /process + /reliability hardening (magic bytes, caps, validation), annotation keying label→index, maxDuration/runtime + provider 400 + inputChars chars-not-bytes, high-tier n≥3, error.tsx, OOB guard, 3 pre-existing type errors. typecheck/lint green. |
