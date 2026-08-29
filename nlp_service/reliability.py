"""Reliability engine for the ensemble thematic-analysis framework.

Implements the dual-metric validation approach (Cohen's kappa + cosine
similarity) and structure-agnostic consensus extraction described in the
LLM-Thematic-Analysis-Tool methodology.

Design notes
------------
* Embeddings default to a stateless hashed-lexical vectorizer (scikit-learn,
  already a dependency) so the service works out of the box. If
  ``sentence-transformers`` is installed, it is used automatically for true
  semantic (paraphrase-aware) matching with the all-MiniLM-L6-v2 model used in
  the reference paper.
* Theme equivalence classes are connected components over pairwise cosine
  (single-linkage): A-B and B-C above threshold merge even if A-C is below it.
  This is deliberately permissive for paraphrase detection but can chain
  semantically distinct themes; interpret cluster cohesion via lineage.
* The whole pipeline (embed -> cluster -> consensus -> kappa -> cosine) runs in
  one call so embeddings are computed only once.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.metrics import cohen_kappa_score

# ---------------------------------------------------------------------------
# Embedding backend (lazy-loaded, dependency-optional)
# ---------------------------------------------------------------------------

_EMBED_MODEL = None
_EMBED_BACKEND: Optional[str] = None
_ST_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
# Label reported when the semantic model is absent (lexical hashed vectors).
_FALLBACK_BACKEND = "hashed-lexical"
# Stateless lexical fallback: hashing is batch-independent, so the cosine
# between two themes does not change with the rest of the request payload
# (a per-batch TfidfVectorizer.fit_transform made it do so).
_FALLBACK_VECTORIZER = HashingVectorizer(n_features=2 ** 16, alternate_sign=False)


def get_embedding_backend() -> str:
    _ensure_embedder()
    return _EMBED_BACKEND or _FALLBACK_BACKEND


def _ensure_embedder() -> None:
    global _EMBED_MODEL, _EMBED_BACKEND
    if _EMBED_BACKEND is not None:
        return
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore

        _EMBED_MODEL = SentenceTransformer(_ST_MODEL_NAME)
        _EMBED_BACKEND = "sentence-transformers"
    except Exception:
        _EMBED_MODEL = None
        _EMBED_BACKEND = _FALLBACK_BACKEND


def embed_texts(texts: List[str]) -> Tuple[np.ndarray, str]:
    """Return L2-normalized embedding matrix (n x d) and the backend name."""
    _ensure_embedder()
    backend = _EMBED_BACKEND or _FALLBACK_BACKEND
    if len(texts) == 0:
        return np.zeros((0, 1), dtype=float), backend

    if _EMBED_MODEL is not None:
        vecs = np.asarray(
            _EMBED_MODEL.encode(texts, normalize_embeddings=True), dtype=float
        )
        return vecs, backend

    # Lexical fallback: hashed term counts, always available and identical
    # regardless of which other texts share the request.
    vecs = _FALLBACK_VECTORIZER.transform(texts).toarray().astype(float)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0.0] = 1.0
    return vecs / norms, backend


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _kappa_band(k: Optional[float]) -> str:
    """Landis & Koch (1977) interpretation bands."""
    if k is None or np.isnan(k):
        return "insufficient_data"
    if k >= 0.81:
        return "almost_perfect"
    if k >= 0.61:
        return "substantial"
    if k >= 0.41:
        return "moderate"
    if k >= 0.21:
        return "fair"
    return "poor"


class _UnionFind:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def _safe_mean(values: List[float], default: float = 0.0) -> float:
    return float(np.mean(values)) if values else default


def _mean_pairwise_binary_kappa(presence: np.ndarray) -> float:
    """Mean Cohen's kappa over all rater pairs for a binary presence matrix.

    ``presence`` is (n_units, n_raters) with 0/1 entries. Vectorized (no
    sklearn call overhead) so bootstrap resampling stays cheap. Returns NaN
    when no pair yields a defined kappa (e.g. constant raters).
    """
    cols = presence.T.astype(float)  # (n_raters, n_units)
    if cols.shape[0] < 2:
        return float("nan")
    eq = (cols[:, None, :] == cols[None, :, :]).mean(axis=2)  # observed agreement
    p = cols.mean(axis=1)  # per-rater prevalence of 1
    pe = p[:, None] * p[None, :] + (1 - p[:, None]) * (1 - p[None, :])
    with np.errstate(divide="ignore", invalid="ignore"):
        kmat = (eq - pe) / (1.0 - pe)
    iu = np.triu_indices(cols.shape[0], k=1)
    vals = kmat[iu]
    vals = vals[np.isfinite(vals)]
    return float(vals.mean()) if vals.size else float("nan")


def _nominal_alpha_binary(presence: np.ndarray) -> float:
    """Krippendorff's nominal alpha for a binary, no-missing-values matrix.

    Units = theme classes, raters = runs, values = present/absent. Returns
    NaN when undefined (all ratings identical -> D_e == 0).
    """
    m = presence.shape[1]  # raters per unit (all runs rate all classes)
    if m < 2 or presence.shape[0] == 0:
        return float("nan")
    n1 = presence.sum(axis=1).astype(float)
    n0 = m - n1
    # Observed disagreement: ordered disagreeing pairs within each unit,
    # normalized by (m_u - 1).
    d_o = float((2.0 * n1 * n0).sum() / (m - 1.0))
    # Expected disagreement: ordered disagreeing pairs across all ratings.
    n_total = float(presence.size)
    N1 = float(presence.sum())
    N0 = n_total - N1
    d_e = 2.0 * N1 * N0 / (n_total - 1.0)
    if d_e == 0.0:
        return float("nan")
    return 1.0 - d_o / d_e


def _bootstrap_run_ci(
    presence: np.ndarray,
    stat_fns: List[Any],
    n_boot: int = 400,
    seed: int = 0,
) -> List[Optional[List[float]]]:
    """Bootstrap CIs over run resamples (columns drawn with replacement).

    Conditional on the discovered theme classes: the class structure is held
    fixed and only the rater (run) dimension is resampled — the honest thing
    to do cheaply, since re-clustering per resample would change the units
    themselves. Returns a 95% percentile CI per stat fn, or None when too
    few resamples yield a defined statistic (tiny rater counts).
    """
    rng = np.random.default_rng(seed)
    n_runs = presence.shape[1]
    collected: List[List[float]] = [[] for _ in stat_fns]
    for _ in range(n_boot):
        idx = rng.integers(0, n_runs, n_runs)
        sub = presence[:, idx]
        for f_idx, fn in enumerate(stat_fns):
            v = fn(sub)
            if v is not None and np.isfinite(v):
                collected[f_idx].append(float(v))
    out: List[Optional[List[float]]] = []
    min_valid = max(20, int(0.1 * n_boot))
    for vals in collected:
        if len(vals) < min_valid:
            out.append(None)
        else:
            lo, hi = np.percentile(vals, [2.5, 97.5])
            out.append([round(float(lo), 4), round(float(hi), 4)])
    return out


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------


def compute_reliability(
    runs: List[Dict[str, Any]],
    cosine_threshold: float = 0.70,
    min_occurrence_ratio: float = 0.5,
    max_flat_themes: int = 800,
) -> Dict[str, Any]:
    """Compute consensus themes + dual reliability metrics across runs.

    ``runs`` is a list of ``{"themes": [{"name", "description", "keywords"}]}``.
    ``max_flat_themes`` caps the O(n^2) pairwise comparison workload.
    """
    n_runs = len(runs)

    # Flatten every theme from every run, remembering its origin.
    flat: List[Dict[str, Any]] = []
    truncated = False
    for run_index, run in enumerate(runs):
        if not isinstance(run, dict):
            continue
        if len(flat) >= max_flat_themes:
            truncated = True
            break
        seed = run.get("seed")
        for theme in run.get("themes", []) or []:
            if not isinstance(theme, dict):
                continue
            if len(flat) >= max_flat_themes:
                truncated = True
                break
            name = str(theme.get("name", "")).strip()
            description = str(theme.get("description", "")).strip()
            keywords = theme.get("keywords", []) or []
            quotes = theme.get("supporting_quotes") or theme.get("quotes") or []
            text = (name + ". " + description).strip(". ") or name or description
            if not text:
                continue
            flat.append(
                {
                    "run": run_index,
                    "seed": seed,
                    "name": name,
                    "description": description,
                    "keywords": [str(k) for k in keywords if str(k).strip()],
                    "quotes": [str(q) for q in quotes if str(q).strip()],
                    "text": text,
                }
            )

    not_enough = n_runs < 2 or len(flat) == 0
    if not_enough:
        return {
            "runCount": n_runs,
            "embeddingBackend": get_embedding_backend(),
            "cosineThreshold": cosine_threshold,
            "minOccurrenceRatio": min_occurrence_ratio,
            "consensus": {"themes": [], "totalRuns": n_runs},
            "kappa": None,
            "alpha": None,
            "cosine": None,
            "saturation": [],
            "truncated": truncated,
        }

    texts = [f["text"] for f in flat]
    vecs, backend = embed_texts(texts)
    sim = vecs @ vecs.T  # cosine (rows already unit-normalized)

    # --- Cluster themes into equivalence classes via connected components ---
    uf = _UnionFind(len(flat))
    for i in range(len(flat)):
        for j in range(i + 1, len(flat)):
            if float(sim[i, j]) >= cosine_threshold:
                uf.union(i, j)

    classes: Dict[int, List[int]] = {}
    for i in range(len(flat)):
        classes.setdefault(uf.find(i), []).append(i)
    class_lists = list(classes.values())

    # Presence/absence matrix: rows = classes, cols = runs.
    presence = np.zeros((len(class_lists), n_runs), dtype=int)
    for c_idx, members in enumerate(class_lists):
        for m in members:
            presence[c_idx, flat[m]["run"]] = 1

    # A theme seen in a single run is never "consensus", even at low ratios
    # (ceil(0.5 * 2) == 1 would otherwise admit 1-of-2 themes).
    min_occurrence = int(np.ceil(min_occurrence_ratio * n_runs))
    if n_runs >= 2:
        min_occurrence = max(min_occurrence, 2)

    consensus_themes: List[Dict[str, Any]] = []
    for members in class_lists:
        runs_present = sorted({flat[m]["run"] for m in members})
        occurrence = len(runs_present)
        if occurrence < min_occurrence:
            continue
        # Medoid = member whose embedding is most central within the class.
        if len(members) > 1:
            sub = sim[np.ix_(members, members)]
            medoid = members[int(np.argmax(sub.sum(axis=0)))]
        else:
            medoid = members[0]
        rep = flat[medoid]
        consistency = occurrence / n_runs
        keyword_set: List[str] = []
        seen = set()
        for m in members:
            for kw in flat[m]["keywords"]:
                key = kw.lower()
                if key not in seen:
                    seen.add(key)
                    keyword_set.append(kw)

        # Lineage: per-member provenance + the cosine that bound it to the cluster.
        # This is the audit trail that makes a consensus theme's derivation
        # inspectable case-by-case (which runs/seeds agreed, how strongly).
        member_lineage: List[Dict[str, Any]] = []
        for m in sorted(members, key=lambda x: flat[x]["run"]):
            cosine_to_medoid = round(float(sim[m, medoid]), 4) if m != medoid else 1.0
            member_lineage.append(
                {
                    "runIndex": flat[m]["run"],
                    "seed": flat[m].get("seed"),
                    "name": flat[m]["name"],
                    "description": flat[m]["description"],
                    "keywords": flat[m]["keywords"][:6],
                    "quotes": flat[m]["quotes"][:3],
                    "cosineToMedoid": cosine_to_medoid,
                    "isMedoid": m == medoid,
                }
            )

        consensus_themes.append(
            {
                "label": rep["name"] or rep["description"][:60] or "Untitled theme",
                "description": rep["description"],
                "keywords": keyword_set[:8],
                "occurrence": occurrence,
                "runCount": n_runs,
                "consistency": round(consistency, 4),
                "tier": (
                    "high"
                    if n_runs >= 3 and consistency >= 0.83
                    else "moderate"
                ),
                "memberCount": len(members),
                "runsPresent": runs_present,
                "lineage": member_lineage,
            }
        )
    consensus_themes.sort(
        key=lambda c: (c["occurrence"], c["memberCount"]), reverse=True
    )

    # --- Cohen's kappa across run pairs (presence/absence over classes) ---
    pairwise_kappa: List[Dict[str, Any]] = []
    if presence.shape[0] >= 2:
        for i in range(n_runs):
            for j in range(i + 1, n_runs):
                try:
                    k = cohen_kappa_score(presence[:, i], presence[:, j])
                except Exception:
                    k = float("nan")
                if k is None or np.isnan(k):
                    continue
                pairwise_kappa.append({"i": i, "j": j, "kappa": round(float(k), 4)})
    kappa_vals = [p["kappa"] for p in pairwise_kappa]
    kappa_result: Optional[Dict[str, Any]] = None
    if kappa_vals:
        mean_k = _safe_mean(kappa_vals)
        kappa_result = {
            "meanKappa": round(mean_k, 4),
            "minKappa": round(min(kappa_vals), 4),
            "maxKappa": round(max(kappa_vals), 4),
            "pairwise": pairwise_kappa,
            "band": _kappa_band(mean_k),
        }

    # --- Krippendorff's alpha + bootstrap CIs over run resamples ---
    # Alpha handles multiple raters directly (unlike pairwise-mean kappa) and
    # tolerates degenerate rater profiles. Presence/absence over classes is a
    # binary nominal metric. CIs are conditional on the discovered classes.
    alpha_value = _nominal_alpha_binary(presence)
    alpha_result: Optional[Dict[str, Any]] = None
    if np.isfinite(alpha_value):
        alpha_result = {
            "value": round(float(alpha_value), 4),
            "ci95": None,
        }
    if presence.shape[0] >= 2 and presence.shape[1] >= 2:
        kappa_ci, alpha_ci = _bootstrap_run_ci(
            presence,
            [_mean_pairwise_binary_kappa, _nominal_alpha_binary],
            n_boot=400,
        )
        if kappa_result is not None:
            kappa_result["ci95"] = kappa_ci
        if alpha_result is not None:
            alpha_result["ci95"] = alpha_ci

    # --- Cosine similarity between run centroids (semantic consistency) ---
    dim = vecs.shape[1]
    centroids = np.zeros((n_runs, dim), dtype=float)
    for r in range(n_runs):
        idxs = [k for k, f in enumerate(flat) if f["run"] == r]
        if idxs:
            c = vecs[idxs].mean(axis=0)
            nrm = np.linalg.norm(c)
            if nrm > 0:
                c = c / nrm
            centroids[r] = c
    cmatrix = centroids @ centroids.T
    np.clip(cmatrix, -1.0, 1.0, out=cmatrix)
    pairwise_cos: List[Dict[str, Any]] = []
    for i in range(n_runs):
        for j in range(i + 1, n_runs):
            pairwise_cos.append({"i": i, "j": j, "cosine": round(float(cmatrix[i, j]), 4)})
    cos_vals = [p["cosine"] for p in pairwise_cos]
    cosine_result: Optional[Dict[str, Any]] = None
    if cos_vals:
        cosine_result = {
            "meanCosine": round(_safe_mean(cos_vals), 4),
            "minCosine": round(min(cos_vals), 4),
            "maxCosine": round(max(cos_vals), 4),
            "pairwise": pairwise_cos,
            "matrix": [[round(float(v), 4) for v in row] for row in cmatrix],
        }

    # --- Saturation curve: distinct theme classes per run prefix ---
    # For each prefix k (runs 0..k-1), re-cluster using only those runs and
    # count distinct equivalence classes. The marginal increase ("new classes")
    # shows when new themes stop emerging — theoretical saturation (Source B:
    # "saturation is a process not a number").
    saturation_curve: List[Dict[str, Any]] = []
    prev_classes = 0
    for k in range(1, n_runs + 1):
        member_idx = [i for i, f in enumerate(flat) if f["run"] < k]
        if not member_idx:
            saturation_curve.append(
                {"runsIncluded": k, "distinctClasses": 0, "newClasses": 0}
            )
            prev_classes = 0
            continue
        uf_sub = _UnionFind(len(member_idx))
        idx_map = {orig: pos for pos, orig in enumerate(member_idx)}
        for a_pos, a_orig in enumerate(member_idx):
            for b_orig in member_idx[a_pos + 1:]:
                if float(sim[a_orig, b_orig]) >= cosine_threshold:
                    uf_sub.union(a_pos, idx_map[b_orig])
        distinct = len({uf_sub.find(p) for p in range(len(member_idx))})
        saturation_curve.append(
            {
                "runsIncluded": k,
                "distinctClasses": distinct,
                "newClasses": max(0, distinct - prev_classes),
            }
        )
        prev_classes = distinct

    return {
        "runCount": n_runs,
        "embeddingBackend": backend,
        "cosineThreshold": cosine_threshold,
        "minOccurrenceRatio": min_occurrence_ratio,
        "consensus": {"themes": consensus_themes, "totalRuns": n_runs},
        "kappa": kappa_result,
        "alpha": alpha_result,
        "cosine": cosine_result,
        "saturation": saturation_curve,
        "truncated": truncated,
    }
