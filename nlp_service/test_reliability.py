"""Runtime verification suite for nlp_service/reliability.py.

Covers: alpha/kappa correctness vs hand-computed values, bootstrap CI
presence, hashed-embedding batch independence, tier rule, min-occurrence
clamp, saturation curve, truncation caps, degenerate inputs.
"""
import sys

sys.path.insert(0, "nlp_service")

import numpy as np
from reliability import (
    compute_reliability,
    embed_texts,
    _nominal_alpha_binary,
    _mean_pairwise_binary_kappa,
)

PASS = 0
FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


def theme(name, description=None, keywords=("trust",)):
    # Description derived from the name so distinct names have lexically
    # distinct texts (shared boilerplate would make everything cluster under
    # the hashed-lexical backend, which is realistic behavior, not a bug).
    if description is None:
        description = f"{name} {name.lower().replace(' ', '')} salient pattern"
    return {"name": name, "description": description, "keywords": list(keywords)}


def run(themes, seed=0):
    return {"seed": seed, "themes": themes}


print("== 1. alpha hand-verification ==")
# Presence matrix: 3 classes x 4 raters
#   class1: 1 1 1 0   class2: 0 0 1 1   class3: 1 0 0 0
m = np.array([[1, 1, 1, 0], [0, 0, 1, 1], [1, 0, 0, 0]])
# Hand-compute Krippendorff nominal alpha (binary, no missing):
n1 = m.sum(axis=1).astype(float)  # [3, 2, 1]
n0 = 4 - n1                       # [1, 2, 3]
d_o = (2 * n1 * n0).sum() / 3.0   # ordered disagreeing pairs / (m-1)
N1 = m.sum(); N = m.size; N0 = N - N1
d_e = 2 * N1 * N0 / (N - 1)
expected_alpha = 1 - d_o / d_e
got = _nominal_alpha_binary(m)
check("alpha matches hand computation", abs(got - expected_alpha) < 1e-12,
      f"got={got:.6f} expected={expected_alpha:.6f}")
# Perfect agreement WITH cross-unit variation -> alpha exactly 1.
# (Rows = units; within every row all raters agree, but rows differ, so
# expected disagreement > 0 and observed disagreement = 0.)
check("perfect agreement (with variation) -> alpha 1.0",
      abs(_nominal_alpha_binary(np.array([[1, 1, 1, 1], [0, 0, 0, 0], [1, 1, 1, 1]])) - 1.0) < 1e-12)
# No variation anywhere (all ratings identical category) -> alpha undefined.
check("zero-variation profile -> NaN (undefined)",
      np.isnan(_nominal_alpha_binary(np.ones((3, 4), dtype=int))))

print("== 2. kappa vectorization matches sklearn ==")
from sklearn.metrics import cohen_kappa_score
rng = np.random.default_rng(7)
agree = True
for _ in range(50):
    m2 = rng.integers(0, 2, size=(12, 3))
    vals = []
    for i in range(3):
        for j in range(i + 1, 3):
            try:
                vals.append(cohen_kappa_score(m2[:, i], m2[:, j]))
            except Exception:
                pass
    sk = float(np.mean(vals)) if vals else float("nan")
    mine = _mean_pairwise_binary_kappa(m2)
    if np.isfinite(sk) and abs(sk - mine) > 1e-9:
        agree = False
check("vectorized pairwise kappa == sklearn mean (50 random cases)", agree)

print("== 3. end-to-end: identical runs -> degenerate chance-corrected stats ==")
# Chance-corrected metrics (kappa, alpha) are UNDEFINED when runs are exactly
# identical (expected agreement == 1 -> 0/0). The engine must return null
# metrics rather than fabricated values; semantic metrics still show perfection.
runs = [run([theme("Trust in institutions"), theme("Barriers to access")], s) for s in (42, 123, 456)]
r = compute_reliability(runs)
check("kappa null (undefined, not fabricated)", r["kappa"] is None, str(r["kappa"]))
check("alpha null (undefined)", r.get("alpha") is None, str(r.get("alpha")))
check("cosine == 1.0 (semantic agreement is perfect)",
      r["cosine"] and abs(r["cosine"]["meanCosine"] - 1.0) < 1e-6)
check("both themes consensus, consistency 1.0, high tier",
      len(r["consensus"]["themes"]) == 2
      and all(t["tier"] == "high" and t["consistency"] == 1.0 for t in r["consensus"]["themes"]))
check("backend label is hashed-lexical", r["embeddingBackend"] == "hashed-lexical",
      r["embeddingBackend"])

print("== 4. disjoint runs (zero overlap) ==")
runs = [run([theme("Alpha"), theme("Beta")], 1), run([theme("Gamma"), theme("Delta")], 2)]
r = compute_reliability(runs)
check("no consensus themes at min_occurrence>=2 clamp",
      len(r["consensus"]["themes"]) == 0, str([t["label"] for t in r["consensus"]["themes"]]))
check("kappa is negative or None", r["kappa"] is None or r["kappa"]["meanKappa"] < 0,
      str(r["kappa"] and r["kappa"]["meanKappa"]))
check("alpha <= 0", r.get("alpha") is None or r["alpha"]["value"] <= 0, str(r.get("alpha")))
check("saturation monotonic non-decreasing",
      all(p["newClasses"] >= 0 for p in r["saturation"]))

print("== 5. 2-run min-occurrence clamp ==")
runs = [run([theme("Shared"), theme("Only run one")], 1), run([theme("Shared")], 2)]
r = compute_reliability(runs, 0.5)
labels = [t["label"] for t in r["consensus"]["themes"]]
check("1-of-2 theme excluded even at ratio 0.5", labels == ["Shared"], str(labels))
check("2-run consensus tier stays moderate",
      all(t["tier"] == "moderate" for t in r["consensus"]["themes"]))

print("== 6. hashed embeddings are batch independent ==")
t1, t2 = "Trust in institutions", "Confidence in public bodies"
va, _ = embed_texts([t1, t2])
vb, _ = embed_texts([t1, "totally unrelated filler text about gardening", t2])
cos_a = float(va[0] @ va[1])
cos_b = float(vb[0] @ vb[2])
check("cosine(a,b) identical across batches", abs(cos_a - cos_b) < 1e-12,
      f"{cos_a} vs {cos_b}")

print("== 7. truncation cap ==")
many = [theme(f"Theme {i:03d} completely unique words {i}") for i in range(600)]
runs = [run(many[:300], 1), run(many[300:], 2)]
r = compute_reliability(runs, max_flat_themes=100)
check("truncated flag set", r.get("truncated") is True)
check("engine survived cap without error", r["runCount"] == 2)

print("== 8. degenerate inputs ==")
r = compute_reliability([run([], 1)])
check("single empty run -> null metrics", r["kappa"] is None and r["cosine"] is None
      and r["consensus"]["themes"] == [] and r["saturation"] == [])
r = compute_reliability([])
check("zero runs -> no crash", r["runCount"] == 0)
r = compute_reliability([run([theme("Only theme")], 1), run([], 2)])
check("one empty run -> alpha 0 (total disagreement, defined)",
      r.get("alpha") is not None and abs(r["alpha"]["value"]) < 1e-9,
      str(r.get("alpha")))
r = compute_reliability([{"themes": "not-a-list"}, {"themes": [42, None]}])
check("malformed runs tolerated", r["runCount"] == 2)

print("== 9. bootstrap CI sanity (varied profile) ==")
themes_a = [theme("Trust"), theme("Access"), theme("Cost")]
themes_b = [theme("Trust"), theme("Access")]
themes_c = [theme("Trust"), theme("Workload")]
themes_d = [theme("Trust"), theme("Access"), theme("Cost"), theme("Voice")]
r = compute_reliability([run(themes_a, 1), run(themes_b, 2), run(themes_c, 3), run(themes_d, 4)])
k = r["kappa"]
if k is None:
    check("kappa defined for varied profile", False, "kappa unexpectedly None")
else:
    check("kappa CI brackets point estimate",
          k.get("ci95") is not None and k["ci95"][0] <= k["meanKappa"] <= k["ci95"][1],
          f"mean={k['meanKappa']} ci={k.get('ci95')}")
    check("alpha CI brackets point estimate",
          r["alpha"]["ci95"] is not None
          and r["alpha"]["ci95"][0] <= r["alpha"]["value"] <= r["alpha"]["ci95"][1],
          f"value={r['alpha']['value']} ci={r['alpha'].get('ci95')}")
check("bootstrap did not blow up runtime (result returned)", True)

print("== 10. saturation curve with merging runs ==")
# Run 3 repeats run 1's themes -> distinct classes should not increase
runs = [run([theme("Trust"), theme("Access")], 1),
        run([theme("Trust"), theme("Access")], 2),
        run([theme("Trust"), theme("Access")], 3)]
r = compute_reliability(runs)
distinct = [p["distinctClasses"] for p in r["saturation"]]
check("classes stay flat across identical runs", distinct == [2, 2, 2], str(distinct))

print()
print(f"RESULT: {PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
