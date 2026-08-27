# WP-1: Tabular (CSV) Data Support — Work Package

> **Status:** APPROVED FOR IMPLEMENTATION · **Created:** 2026-08-27 · **Owner:** —
> **Priority:** P1 · **Effort estimate:** 3.5–4.5 engineering days
> **Depends on:** nothing (post-dates remediation passes `f7329ae`…`0127d60`)

---

## 1. Problem statement

The pipeline accepts `.csv` uploads (`FileUpload.tsx` allow-list, `/process` dispatch at
`nlp_service/main.py:116`) but treats them as prose: raw UTF-8 decode, then
`clean_text()` strips `[^a-zA-Z\s]` (commas, digits, quotes), destroying row/column
structure. Consequences, end to end:

1. Headers, ID/Likert columns, and timestamps become comma-soup tokens in the LLM prompt.
2. Prose-only statistics (Flesch, lexical density, whole-doc VADER, `sent_tokenize`
   evidence) produce confident-looking nonsense on tabular input.
3. Themes can aggregate metadata columns (job titles, dates) as if respondents said them.
4. Word-boundary chunking can split mid-row; the header row only reaches chunk 1.
5. Evidence spans cannot cite a row — the audit trail is meaningless for survey data.

**Prose path (txt/pdf/docx) is runtime-verified and stays untouched.** This package makes
CSV a first-class, honestly-reported input mode.

---

## 2. Goals / Non-goals

**Goals**
- G1: Structured CSV parsing (delimiter sniffing, encoding ladder, malformed rejection).
- G2: Free-text column detection + researcher override (column picker UI).
- G3: Row-index provenance: evidence spans cite `row N, column "feedback"`.
- G4: Honest statistics: per-row VADER aggregate; prose stats labeled/suppressed in tabular mode.
- G5: Row-aware chunking (no cell split across chunks; header repetition per chunk).
- G6: Full test coverage on the four existing suites' pattern (`nlp_service/test_*`).

**Non-goals (explicit)**
- Native `.xlsx` (user exports CSV; revisit post-Phase 7).
- Multi-file mixed-mode choreography (each file is independently prose or tabular).
- CSV → corpus statement auto-import (the `/workspace` manual coding flow stays manual).
- Changing the reliability engine (it only ever sees theme objects — mode-agnostic).

---

## 3. Design decisions (locked)

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Parse with Python stdlib `csv` + `csv.Sniffer` (`,`, `;`, `\t`, `\|`) | No new deps; Sniffer failures fall back to comma with the delimiter surfaced in the UI |
| D2 | Encoding ladder: `utf-8-sig` → `utf-8` → `latin-1` (reported) | BOM is the #1 real-world survey export issue; never fail on legacy Excel encodings |
| D3 | New lightweight `POST /inspect` returns column metadata; full processing stays in `/process` | Column picker needs metadata before analysis; overloading `/process` with `dry_run` entangles validation paths |
| D4 | Column classifier is a scoring heuristic, always researcher-overridable; auto-select is only the default | Heuristics will be wrong on edge data; the researcher is the methodological authority |
| D5 | Analysis document assembled per-row as pre-split **units**; new `chunkSegments()` packs whole units into chunks (existing `chunkText` untouched) | Zero regression risk to the prose path; guarantees G5 by construction |
| D6 | `/evidence` gains a `units` mode; `EvidenceSpan` gains optional `rowIndex`/`columnName` | Backward-compatible additive contract |
| D7 | `mode: "prose" \| "tabular"` flows into `PipelineTrace` and the dashboard labels/suppresses prose-only stats in tabular mode | Honesty of the transparency layer (same principle as the `hashed-lexical` warning) |
| D8 | Caps: 5,000 rows, 1,000 chars/cell, 2,000 units sent to `/evidence` (FIFO with disclosed skip count) | Consistent with existing `MAX_UPLOAD_BYTES`/`MAX_PDF_PAGES` hardening posture |

---

## 4. API contracts (exact)

### 4.1 `POST /inspect` (multipart `file`) — new

```json
{
  "fileName": "survey.csv",
  "mode": "tabular",                  // "prose" for txt/pdf/docx
  "delimiter": ",",
  "encoding": "utf-8-sig",
  "rowCount": 412,
  "truncated": false,                 // true when row cap applied
  "columns": [
    { "index": 0, "name": "respondent_id", "type": "numeric",
      "meanLength": 4.1, "distinctRatio": 1.0, "alphaRatio": 0.02, "isText": false },
    { "index": 5, "name": "feedback", "type": "text",
      "meanLength": 187.3, "distinctRatio": 0.93, "alphaRatio": 0.86, "isText": true }
  ],
  "suggestedTextColumns": [5]
}
```

### 4.2 `POST /process` — additive fields (both modes)

Form field `text_columns` (JSON int array). Absent → auto-detect.

```json
{
  "mode": "tabular",
  "csv": { "delimiter": ",", "encoding": "utf-8-sig", "rowCount": 412,
           "textColumns": [5], "skippedShortCells": 18, "truncatedRows": false },
  "units": [ { "text": "The onboarding was confusing…", "rowIndex": 47,
               "columnName": "feedback" } ],
  "sentiment": { "positive": 21.4, "neutral": 68.1, "negative": 10.5,
                 "basis": "per-row-mean" },        // tabular: mean of per-cell VADER
  "stats": { "...existing fields…",
             "flesch_reading_ease": null,          // null + basis note in tabular mode
             "mode": "tabular" },
  "...existing cleaned_text / top_keywords / extracted_text…"
}
```

`cleaned_text` for tabular = cleaned concatenation of selected cells (keeps the LLM path
working unchanged); `extracted_text` = raw-cell concatenation (punctuation preserved,
same role as today).

### 4.3 `POST /evidence` — `units` request mode (preferred over `text` when present)

```json
// request
{ "units": [ { "text": "…", "rowIndex": 47, "columnName": "feedback" } ],
  "themes": [ { "name": "…", "description": "…" } ], "top_k": 3 }
// response span (additive)
{ "text": "…", "cosine": 0.71, "unitIndex": 12, "rowIndex": 47, "columnName": "feedback" }
```

### 4.4 TypeScript type changes

- `NlpProcessResponse` (src/lib/nlp.ts): `mode`, `csv?`, `units?`, `sentiment.basis?`
- `EvidenceSpan` (src/types/index.ts): `rowIndex?: number`, `columnName?: string`
- `PipelineTrace`: `csv?: { delimiter; encoding; rowCount; textColumns: string[] }`
- `RunConfig`: `csvTextColumns?: Record<string, number[]>` (fileName → indices)
- New `chunkSegments(units: string[], maxChunkChars?, maxChunks?)` in `src/lib/ensemble.ts`

---

## 5. Task breakdown

### WP-1.1 — Python: parse + validate + `/inspect`  *(0.75 d)*
**Files:** `nlp_service/main.py`, new `nlp_service/tabular.py`
- `tabular.py`: `read_tabular(bytes) -> RawTable` (Sniffer, encoding ladder, malformed →
  `ValueError` with 1-based row number, caps from D8, ragged-row tolerance policy:
  rows with more/fewer fields than the header are rejected with the row number).
- Column classifier `classify_columns(rows) -> List[ColumnMeta]`:
  `isText = meanLength ≥ 25 AND alphaRatio ≥ 0.70 AND distinctRatio ≥ 0.50 AND
  not datetime-like`. `suggestedTextColumns` = all `isText`, ordered by meanLength.
- `POST /inspect` endpoint; same upload size/magic-byte caps as `/process`.
**AC:** `/inspect` on the golden fixtures returns expected mode/delimiter/columns
(fixture list in §6); malformed CSV → 400 citing row; 6k-row file → `truncated: true`.

### WP-1.2 — Python: tabular `/process`  *(1 d)*
**Files:** `nlp_service/main.py`, `tabular.py`
- Branch `extract_text_from_file` on `mode`: prose → unchanged path; tabular →
  unit assembly from selected/auto text columns (`text_columns` form field honored,
  invalid indices → 400).
- `sentiment`: per-cell VADER on non-empty selected cells, mean the three scores
  (`basis: "per-row-mean"`); `flesch_reading_ease`/`lexical_density` → null in tabular mode.
- `units` in response (cap D8; skip-count disclosed).
**AC:** service tests §6 rows 1–8 pass; prose regression suite (`test_service.py`
existing cases) still green byte-identical.

### WP-1.3 — Python: `/evidence` units mode  *(0.5 d)*
**Files:** `nlp_service/main.py`
- When `units` present: embed unit texts, retrieve per theme, attach
  `rowIndex`/`columnName`; unit-length filter uses cell length not sentence length.
**AC:** evidence for fixture 1 cites correct `rowIndex` (spot-check 3 rows by content).

### WP-1.4 — TS: client, orchestrator, chunker  *(0.75 d)*
**Files:** `src/lib/nlp.ts`, `src/lib/ensemble.ts`, `src/app/api/analyze-ensemble/route.ts`, `src/types/index.ts`
- `inspectFile(file)` client fn; `/process` call sends `text_columns` when configured.
- `chunkSegments()` (whole-unit packing, same caps/`truncated` semantics as `chunkText`);
  orchestrator selects by `nlp.mode`; evidence call passes `units` when present.
- `PipelineTrace.csv` + trace-tab UI row ("Source: tabular · delimiter `,` · 412 rows ·
  analyzed column(s): feedback"); `inputTruncated` semantics extended to row cap.
**AC:** `test_ensemble.ts` gains 4 segment-chunker cases (incl. >cap unit hard-split);
typecheck/lint green.

### WP-1.5 — UI: column picker + honest stats  *(1 d)*
**Files:** new `src/components/CsvColumnPicker.tsx`, `src/app/analyzer/page.tsx`, `src/components/EnsembleDashboard.tsx`
- New step between design and configure, rendered **only** when ≥1 file is CSV:
  `/inspect` per CSV → column table (type badge, mean length, distinct ratio, text
  checkbox pre-checked on `suggestedTextColumns`) → writes `csvTextColumns` into state.
- `handleRun` appends `text_columns` (per current file) to the FormData.
- Dashboard Overview tab: tabular mode → "Sentiment (VADER, per-response mean)" label,
  Flesch/lexical cards suppressed, evidence chips show `row 47 · feedback`.
**AC:** manual pass on fixture 1: full flow upload→pick→run shows row-cited evidence;
prose files never render the picker (regression check on teaching-reflection.txt).

### WP-1.6 — Tests & fixtures  *(0.5 d, interleaved with 1.1–1.4)*
**Files:** `nlp_service/test_tabular.py`, extensions to `test_service.py`, `test_ensemble.ts`
- Fixture set §6 checked in under `public/datasets/csv-fixtures/` (also becomes a
  DatasetGallery sample entry).
**AC:** all new tests green in CI-equivalent run (`python3 nlp_service/test_*.py`,
`bun run nlp_service/test_*.ts`); total suite count grows by ≥ 25 checks.

### WP-1.7 — Docs  *(0.25 d)*
- README "Supported inputs" table (prose vs tabular capabilities); roadmap phase note;
  memory bank `context.md` + this file's status flip.

---

## 6. Test fixtures & golden cases

| # | Fixture | Assertions |
|---|---------|-----------|
| 1 | `survey-comma.csv` — 60 rows, quoted cells, one multiline cell, id/likert/date/text cols | mode tabular; delimiter `,`; suggested = feedback col only; units skip likert; multiline row index correct |
| 2 | `survey-semicolon.csv` — EU export, `;`, `latin-1` encoded | delimiter `;`, encoding `latin-1` reported |
| 3 | `survey-bom.csv` — utf-8-sig | encoding `utf-8-sig`; header has no leading BOM in column name |
| 4 | `malformed.csv` — ragged row at line 37 | 400 with "row 37" in detail |
| 5 | `numeric-only.csv` | no `isText` columns → 400 "no free-text column detected" |
| 6 | `single-text-col.csv` | auto-select that column without override |
| 7 | `wide.csv` — 5,001 rows | `truncated: true`, rowCount 5000, skip count disclosed |
| 8 | `mixed-case-header.csv` — `Feedback`, `FEEDBACK` duplicates | names deduplicated with suffixes, indices stable |
| 9 | Prose regression — existing `teaching-reflection.txt` | `/inspect` mode prose; `/process` response byte-equal on existing fields |
| 10 | `empty-cells.csv` — 40% empty text cells | `skippedShortCells` counts; sentiment basis excludes empties |

Chunker golden cases (TS): units never split; unit > cap hard-splits; `truncated` only
when units dropped; header repetition per chunk when >1 chunk.

---

## 7. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Sniffer mis-detects delimiter | Med | Researcher override + delimiter shown in picker/trace; comma fallback |
| Classifier picks wrong column (short-coded answers) | Med | Override UI is one click; `suggestedTextColumns` is advisory only; meanLength threshold conservative |
| Multiline quoted cells shift row numbers | Low | `csv.reader` enumeration handles embedded newlines natively — golden test 1 pins it |
| LLM confusion from concatenated rows | Med | Per-row blank-line separation + prompt unchanged (tested via fixture-1 e2e); monitor parse-fail rate |
| Row cap skews analysis on large exports | Med | `truncated` flag + trace disclosure + picker shows full rowCount (honest limitation, same policy as chunk cap) |
| Evidence unit length filter drops short but valid cells | Low | Cell-length filter ≥ 15 (not 25) in units mode; disclosed count |

---

## 8. Definition of Done

- [ ] All fixtures §6 pass; ≥ 25 new automated checks across suites; zero prose-path regressions.
- [ ] End-to-end manual: `survey-comma.csv` → picker → 6-seed ensemble → evidence citing
      `row N · feedback`; pipeline trace shows tabular source metadata.
- [ ] `bun typecheck` / `bun lint` / `bun build` / `py_compile` + import smoke green.
- [ ] README, roadmap, memory bank updated; this file's status → `COMPLETE`.
- [ ] Committed with fixture files ≤ 200 KB total.

## 9. Open questions (resolve at kickoff)

1. Should multi-text-column selection join cells per row (`"; "` separator) or analyze
   columns as separate documents? — **Default:** join per row (single shared ensemble).
2. Per-column ensemble runs (compare columns like models)? — Deferred; note in roadmap.
3. Should `/inspect` also serve the corpus/workspace ingestion flow? — Deferred to Phase 6+.
