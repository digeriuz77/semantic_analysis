# Architecture & Roadmap: Rigorous LLM Thematic Analysis Platform

> Architect's master plan to take the current "Semantic & Thematic Analyzer" through to
> completion as a **methodologically rigorous, reliability-quantified** qualitative research tool.

---

## 1. Diagnosis: Where the App Is Today

The current app is a **single-shot LLM theme extractor** with a niche teaching-reflection lens:

| Layer | Today | Status |
|-------|-------|--------|
| Frontend | Next.js 16 (App Router) + Recharts + Tailwind | Upload → Dashboard → Specialist views |
| API | `/api/analyze`, `/api/specialist` | 1 LLM call each |
| LLM | Fireworks AI (Llama 3 70B) only | Single provider, single run |
| NLP | Python FastAPI + NLTK | Tokenize, lemmatize, freq, heuristic sentiment, Flesch |
| Lens | Schön double-loop reflection | Hardcoded specialty |

### Critical gaps vs. rigorous qualitative research
1. **No reliability quantification** — themes come from one run; no way to know if a theme is robust or a sampling artifact.
2. **No inter-rater / semantic consistency metrics** — no Cohen's κ, no cosine similarity.
3. **No ensemble / multi-seed runs** — single-point generation, as the article warns.
4. **No multi-model support** — locked to one provider.
5. **No methodological scaffolding** — no paradigm selection, no Braun & Clarke 6-step, no grounded-theory coding, no COREQ, no saturation reasoning.
6. **Heuristic sentiment** instead of a validated lexicon (VADER).
7. **No custom prompts** with reproducible variable substitution.
8. **No export / reproducibility manifest** for an audit trail.

---

## 2. The Three Sources of Knowledge — What to Extract

### Source A — The reliability paper (LLM-Thematic-Analysis-Tool)
**Role: the technical core.** This is the differentiator that turns a toy into a research-grade tool.

- **Ensemble validation (semantic Monte Carlo):** 6 independent runs with fixed seeds → 15 pairwise comparisons; ~41% lower variance than 3 runs.
- **Dual reliability metrics:**
  - **Cohen's κ** (Landis-Koch bands: >0.80 almost perfect, 0.60-0.80 substantial, 0.40-0.60 moderate).
  - **Cosine similarity** over sentence-embedding space (all-MiniLM-L6-v2, 384-d).
- **Configurable reproducibility:** seeds (1-6), temperature (0.0-2.0), `{seed}` / `{text_chunk}` prompt substitution.
- **Structure-agnostic consensus extraction:** dynamic schema detection → semantic clustering at cosine > 0.70 → keep themes in ≥ 50% of runs → confidence tiers (high 5-6/6, moderate 3-4/6).
- **Cross-model validation:** themes stable across architectures rank higher confidence.
- **Empirical baselines to target:** Gemini κ≈0.91 / cosine 95.3%, GPT-4o κ≈0.85 / 92.6%, Claude κ≈0.84 / 92.1%.

### Source B — qualitative-research-skill repo
**Role: the methodological backbone.** Gives the app academic legitimacy and structure (currently absent).

- **Paradigm-first logic:** constructivist → *trustworthiness* (Lincoln & Guba), not forced κ; post-positivist → κ appropriate. The app must not blindly demand κ.
- **Two coding methodologies:** Braun & Clarke reflexive TA (6-step) + Grounded Theory (open/axial/selective 3-level).
- **Content analysis** (three orientations) + policy-text frameworks.
- **Reliability/validity reference:** when to report ICR, theoretical saturation, Lincoln & Guba criteria.
- **Reusable assets:** offline **Cohen's κ calculator** (port its logic), **COREQ 32-item checklist**, templates (interview guide, codebook, focus group, consent).
- **Seven design principles** (method↔question match; saturation is a process not a number; quotes are evidence; reflexivity throughout) → encode as the app's methodology guardrails.

### Source C — Qualitative-Text-Datasets-for-UX-Research repo
**Role: demo corpus + test fixtures.**

- Synthetic-but-realistic datasets: user interviews, open-ended surveys, focus groups, diary studies, customer feedback, community forums.
- Use as: (a) in-app **Demo Gallery** so users can try the tool instantly, (b) **integration-test fixtures**, (c) **dataset-type awareness** (the app can hint at appropriate methodology per source type).

---

## 3. Target Architecture

```
┌──────────────────────────── Browser (Next.js 16, App Router) ────────────────────────────┐
│  Flow: ResearchDesign → Upload/Gallery → Configure(seeds,temp,model,prompt) →            │
│        RunEnsemble → ReliabilityDashboard → ConsensusThemes → Export                      │
│                                                                                           │
│  src/components/                 src/lib/                                                  │
│   ├ ResearchDesignStep.tsx        ├ llm/types.ts          (ChatAdapter interface)         │
│   ├ AnalysisConfigurator.tsx      ├ llm/providers/*.ts    (openai, anthropic, gemini,     │
│   ├ ReliabilityDashboard.tsx      │                         fireworks, openrouter)        │
│   ├ ConsensusThemesView.tsx       ├ reliability/kappa.ts  (client-side math on server     │
│   ├ FrameworkPicker.tsx           │                         embeddings, or pure server)   │
│   ├ DatasetGallery.tsx            ├ frameworks/index.ts   (Schön, Braun&Clarke, GT, …)    │
│   └ ExportPanel.tsx               └ prompts/template.ts   ({seed}/{text_chunk} engine)    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                 │ fetch (API keys server-side only — never shipped to client)
                 ▼
┌──────────────────────── Next.js API Routes (server, TS) ─────────────────────────────────┐
│  /api/analyze-ensemble   multi-run thematic analysis (seeds × temp × model × prompt)     │
│  /api/reliability         κ + cosine across runs                                          │
│  /api/consensus           structure-agnostic semantic clustering                          │
│  /api/frameworks          list analytical frameworks + prompt templates                   │
│  /api/export              JSON/CSV/Markdown + COREQ + reproducibility manifest            │
│  /api/analyze (legacy)    kept for backwards-compat during migration                      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────── Python NLP Service (FastAPI, existing + extended) ─────────────────┐
│  Existing:  /process   (extract, clean, NLTK stats, heuristic sentiment)                 │
│  New:       /embed     (sentence-transformers all-MiniLM-L6-v2 → 384-d vectors)           │
│  New:       /kappa     (pairwise + mean Cohen's κ via sklearn)                            │
│  New:       /sentiment (VADER — replaces heuristic)                                       │
│  New:       /consensus (semantic clustering, equivalence classes, frequency)             │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                 ▲
                 │  public/datasets/        Demo gallery (Source C) + benchmark transcript
                 │  .kilocode/methodology/  Distilled methodology refs (Source B)
```

### Key architectural decisions (decisive)

| # | Fork | Decision & rationale |
|---|------|----------------------|
| D1 | Compute location for κ / cosine | **Server-side in the Python service.** Reuses existing FastAPI infra, keeps the browser light (no ~80MB WASM model download), and `sentence-transformers` + `sklearn` are native there. The paper's client-side Transformers.js is an option only if we later want a fully offline/local demo. |
| D2 | Multi-provider | **Unified `ChatAdapter` interface in `src/lib/llm/`** with one module per provider. All keys resolved server-side from env. Start with Fireworks (present) + OpenAI + Anthropic + Google; add OpenRouter as a meta-provider. |
| D3 | Teaching-reflection lens | **Generalize, don't delete.** Schön double-loop becomes one entry in an **Analytical Frameworks** library alongside Braun & Clarke TA, Grounded Theory, Content Analysis, and a Custom Prompt builder. Preserves existing behavior while unifying with the paper's custom-prompt feature. |
| D4 | Paradigm handling | **Paradigm-aware.** Add a Research Design step (paradigm + methodology). If constructivist → surface Lincoln & Guba trustworthiness criteria and *offer* κ without forcing it. If post-positivist → κ front-and-center. Encodes Source B's core principle. |
| D5 | Persistence | **Defer DB.** Start with in-session state + `localStorage` for configs/manifests. The existing add-database recipe stays available for a later "saved projects" phase. Avoid scope creep. |
| D6 | Single-run vs ensemble default | **Ensemble is the headline feature, single-run the fallback.** A "quick mode" (1 run, no reliability) remains for cheap exploration; "rigorous mode" (≥6 runs, dual metrics) is the default for exportable research. |

---

## 4. Phased Roadmap

Each phase is independently shippable. Phases are ordered by **impact ÷ effort** and by dependency.

### Phase 0 — Foundation & hardening  *(no UX behavior change)*
**Goal:** make the codebase safe to build on.
- [ ] Reconcile Tailwind setup (project mixes `tailwind.config.ts` v3-style with Tailwind v4 `@tailwind` directives — verify classes like `navy-800`/`gold-400` resolve; standardize).
- [ ] Normalize env handling: documented `.env.local`, server-only key access, graceful "no key → demo mode" everywhere.
- [ ] NLP-service-down resilience (timeout + clear error UI, not a blank alert).
- [ ] Add `bun typecheck` + `bun lint` as the gate before any commit.
- [ ] Seed `public/datasets/` with a few Source-C samples + the paper's benchmark transcript for consistent testing.

### Phase 1 — Reliability core  *(the paper's contribution = the differentiator)*
**Goal:** the app can finally *quantify* how trustworthy its themes are.
- Python: `/embed` (all-MiniLM-L6-v2), `/kappa` (pairwise + aggregate, Landis-Koch band), `/sentiment` (VADER).
- API: `/api/analyze-ensemble` — runs N times (seeds), per-run themes stored; `/api/reliability` — κ + cosine; `/api/consensus` — semantic clustering (>0.70), ≥50% threshold, confidence tiers.
- UI: **AnalysisConfigurator** (seeds add/remove, temperature slider, run count) + **ReliabilityDashboard** (κ with interpretation band, cosine similarity heatmap via Recharts, per-theme consistency %) + **ConsensusThemesView** (high/moderate tiers, occurrence counts).
- Types: extend `Theme` with `consistency`/`occurrence`; add `ReliabilityReport`, `ConsensusTheme`, `RunConfig`.

### Phase 2 — Multi-provider + custom prompts  *(flexibility & reproducibility)*
- `src/lib/llm/` adapter + provider modules (OpenAI, Anthropic, Gemini, Fireworks, OpenRouter) with `{seed}`/`{text_chunk}` substitution engine.
- UI: **FrameworkPicker** (built-in frameworks + custom prompt editor with live `{seed}`/`{text_chunk}` preview) + **ModelCompareView** (paper's Table 1/2: κ + cosine + consensus count per model on the same corpus).

### Phase 3 — Methodological scaffolding  *(Source B = academic rigor)*
- **ResearchDesignStep:** paradigm (constructivist/post-positivist/critical/pragmatic) + methodology (reflexive TA / grounded theory / content analysis / phenomenology) → drives which metrics/outputs are shown.
- **Analytical Frameworks library:** port the Schön lens as one framework; add Braun & Clarke 6-step, GT 3-level coding scaffolds, and a codebook editor.
- **Paradigm-aware reliability:** trustworthiness (credibility/transferability/dependability/confirmability) view for constructivist work; κ optional not mandated.
- **COREQ 32-item** self-check + **theoretical-saturation** heuristic (new-theme rate per run; recommend stopping per Source B's "saturation is a process").
- Distill Source B references into `.kilocode/methodology/` (short, citable cards shown in-app).

### Phase 4 — UX, datasets, export, polish  *(completion & credibility)*
- **DatasetGallery** (Source C): one-click load sample corpus by type (interview/survey/focus group/diary/feedback/forum), with methodology hints.
- **ExportPanel:** JSON, CSV (themes), Markdown report, **COREQ-aligned report**, and a **reproducibility manifest** (model, seeds, temperature, prompt hash, timestamp) so analyses are citable/replicable.
- **Cross-model ensemble** (paper's future work): run the same corpus across providers simultaneously, surface cross-architecture-stable themes as highest confidence.
- **Adaptive run count** via saturation signal (paper's future work): stop early when new themes plateau.
- Accessibility + responsive pass; copy/empty-states; loading skeletons.

### Phase 5 (optional) — Persistence & collaboration
- Apply the add-database recipe: saved projects, run history, shareable report links.

### Work packages (post-phase execution units)
- **WP-1 — Tabular (CSV) data support** *(COMPLETE 2026-08-27)*: structured CSV parsing,
  free-text column detection + researcher override (`CsvColumnPicker` + `/inspect`),
  row-index evidence provenance (units mode in `/evidence`), per-row VADER with prose
  stats suppressed, whole-row `chunkSegments` packing. 63 new checks green incl.
  live-service e2e. Spec: [`.kilocode/work-packages/wp-1-csv-analysis.md`](work-packages/wp-1-csv-analysis.md).

---

## 5. Definition of "Done" (completion criteria)

The app is complete when a researcher can:
1. Pick a **paradigm + methodology** and get outputs appropriate to that choice.
2. Run an **ensemble** (configurable seeds/temp/model/prompt) and see **dual reliability metrics** (κ + cosine) with interpretation.
3. Read **consensus themes** with confidence tiers and occurrence counts.
4. **Compare models** head-to-head on the same corpus.
5. Try it instantly via a **demo gallery**, then load their own data.
6. **Export** a citable report + reproducibility manifest (COREQ-aligned where relevant).
7. Pass `bun typecheck` + `bun lint` clean; NLP service resilient to absence/timeouts.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Cost of 6×N runs × models | "Quick mode" (1 run) default for exploration; show estimated cost before rigorous runs; cache embeddings. |
| Provider API drift / CORS in browser | All calls server-side via `ChatAdapter`; one place to fix per provider. |
| κ on free-text themes is noisy | Pair κ (categorical presence/absence) with cosine (semantic) — exactly the paper's dual approach; surface *both* always. |
| Over-claiming validity | UI copy makes the paper's caveat explicit: high inter-run consistency ≠ ground-truth accuracy; human oversight required. |
| Scope creep from DB/auth | Phases 0-4 are serverless-friendly; persistence deferred to Phase 5. |
| License of source datasets | Source C is educational/synthetic — fine for demo; never ship the paper's real transcript without attribution/consent. |

---

## 7. Recommended immediate next step

**Begin Phase 0**, then Phase 1 — because Phase 1 (reliability core) is the single highest-leverage change and is what converts this from "LLM theme toy" to "research-grade tool." Everything else layers on top of the ensemble + reliability primitives.
